"""Queue and voting routes + track search."""

import asyncio
import logging
import re
import time

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import yt_dlp
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.room import Room
from backend.models.queue_item import QueueItem
from backend.models.user import User
from backend.middleware.auth import get_current_user_id
from backend.services.queue_manager import queue_manager
from backend.services.music_search import music_search_service as lastfm_service
from backend.services.invidious import get_stream_url as get_invidious_stream_url
from backend.schemas import QueueTrackRequest
from backend.routes.rooms import check_room_access

logger = logging.getLogger(__name__)
router = APIRouter(tags=["queue"])


@router.post("/rooms/{room_id}/queue")
async def add_to_queue(
    room_id: str,
    track: QueueTrackRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")
    room = db.query(Room).filter(Room.id == room_id, Room.is_active == True).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    user_id = user_data["id"]
    if not check_room_access(room, user_id):
        raise HTTPException(status_code=403, detail="Room access denied. Password verification required.")
    user_name = user_data["display_name"]

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, display_name=user_name)
        db.add(user)
        db.commit()

    track_data = track.model_dump() if hasattr(track, "model_dump") else track.dict()
    
    uri = track_data.get("uri")
    if uri and (" " in uri or len(uri) != 11):
        resolved_id = await asyncio.to_thread(lastfm_service.resolve_youtube, uri)
        if resolved_id:
            track_data["uri"] = resolved_id

    item = queue_manager.add_track(db, room_id, track_data, user_id, user_name)

    # Pre-resolve stream URL in background so playback starts instantly
    if track_data.get("uri") and len(track_data.get("uri", "")) == 11:
        asyncio.create_task(pre_resolve_url(track_data["uri"]))

    return {"item": item.to_dict()}


@router.post("/rooms/{room_id}/queue/{item_id}/vote")
async def vote_track(room_id: str, item_id: str, request: Request, db: Session = Depends(get_db)):
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not check_room_access(room, user_data["id"]):
        raise HTTPException(status_code=403, detail="Room access denied. Password verification required.")

    item = db.query(QueueItem).filter(
        QueueItem.id == item_id,
        QueueItem.room_id == room_id,
        QueueItem.status != "played",
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    success = queue_manager.vote_track(db, item_id, user_data["id"])
    if not success:
        raise HTTPException(status_code=409, detail="Already voted")
    queue = queue_manager.get_queue(db, room_id)
    return {"queue": queue}


@router.get("/search/tracks")
async def search_tracks(q: str = ""):
    if not q.strip():
        return {"tracks": []}
    tracks = await asyncio.to_thread(lastfm_service.search_tracks, q.strip())
    return {"tracks": tracks}


@router.get("/queue/{room_id}")
async def get_queue(room_id: str, request: Request, db: Session = Depends(get_db)):
    """Lightweight queue fetch — used by the frontend 3s poll fallback."""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    user_id = get_current_user_id(request)
    if not check_room_access(room, user_id):
        raise HTTPException(status_code=403, detail="Room access denied. Password verification required.")
    queue = queue_manager.get_queue(db, room_id, user_id)
    return {"queue": queue}



@router.get("/search/resolve")
async def resolve_youtube(q: str = ""):
    """Resolve a YouTube video ID from a search query using ytmusicapi (No API key needed)."""
    if not q.strip():
        return {"video_id": None}

    video_id = await asyncio.to_thread(lastfm_service.resolve_youtube, q.strip())
    return {"video_id": video_id}


@router.get("/search/recommendations")
async def get_recommendations():
    """Return trending/popular tracks as search starting suggestions (no key needed)."""
    tracks = await asyncio.to_thread(lastfm_service.get_recommendations)
    return {"tracks": tracks}


# ── Stream URL cache & pre-resolution ──────────────────────────────
# YouTube CDN URLs expire after ~6 hours. Cache for 5 hours to be safe.
_URL_CACHE_TTL = 5 * 3600
_URL_CACHE_MAX = 500  # Max entries to prevent unbounded growth
_url_cache: dict[str, tuple[str, float]] = {}
_resolving: set[str] = set()  # Track in-flight resolutions to avoid duplicates

# Reusable httpx client for stream proxying (connection pooling)
_stream_client: httpx.AsyncClient | None = None

def _get_stream_client() -> httpx.AsyncClient:
    global _stream_client
    if _stream_client is None or _stream_client.is_closed:
        _stream_client = httpx.AsyncClient(follow_redirects=True, timeout=60.0)
    return _stream_client

# Regex for valid YouTube video IDs
_VIDEO_ID_RE = re.compile(r'^[a-zA-Z0-9_-]{11}$')

def _is_valid_video_id(video_id: str) -> bool:
    return bool(_VIDEO_ID_RE.match(video_id))

def _prune_url_cache():
    """Remove expired entries and cap cache size."""
    now = time.time()
    expired = [k for k, (_, exp) in _url_cache.items() if now >= exp]
    for k in expired:
        del _url_cache[k]
    # If still over limit, remove oldest entries
    if len(_url_cache) > _URL_CACHE_MAX:
        by_expiry = sorted(_url_cache.items(), key=lambda x: x[1][1])
        for k, _ in by_expiry[:len(_url_cache) - _URL_CACHE_MAX]:
            del _url_cache[k]


def _extract_ytdlp_sync(video_id: str, low: bool = False) -> str | None:
    ydl_opts = {
        "format": "139/bestaudio" if low else "251/140/bestaudio",
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            return info.get("url")
    except Exception as e:
        logger.error(f"yt-dlp Python API failed for {video_id} (low={low}): {e}")
        return None


async def _resolve_audio_url(video_id: str, low: bool = False) -> str | None:
    """Race Invidious vs yt-dlp — use whichever resolves first. Cached in _url_cache."""
    if not _is_valid_video_id(video_id):
        logger.warning(f"Invalid video_id rejected: {video_id!r}")
        return None

    cache_key = f"{video_id}_low" if low else video_id

    if cache_key in _url_cache:
        url, expiry = _url_cache[cache_key]
        if time.time() < expiry:
            return url
        del _url_cache[cache_key]

    async def _try_invidious() -> str | None:
        try:
            return await get_invidious_stream_url(video_id)
        except Exception as e:
            logger.warning(f"Invidious failed for {video_id}: {e}")
            return None

    async def _try_ytdlp() -> str | None:
        return await asyncio.to_thread(_extract_ytdlp_sync, video_id, low)

    # Run both in parallel, take the first success
    url = None
    for coro in asyncio.as_completed([_try_invidious(), _try_ytdlp()]):
        result = await coro
        if result:
            url = result
            break

    if url:
        _prune_url_cache()
        _url_cache[cache_key] = (url, time.time() + _URL_CACHE_TTL)
    return url


async def pre_resolve_url(video_id: str):
    """Resolve a stream URL in the background so it's cached when needed."""
    if video_id in _url_cache:
        _, expiry = _url_cache[video_id]
        if time.time() < expiry:
            return  # Already cached and valid
    if video_id in _resolving:
        return  # Already in flight
    _resolving.add(video_id)
    try:
        url = await _resolve_audio_url(video_id)
        if url:
            logger.info(f"Pre-resolved stream URL for {video_id}")
    except Exception as e:
        logger.warning(f"Pre-resolve failed for {video_id}: {e}")
    finally:
        _resolving.discard(video_id)


@router.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request, low: bool = False):
    if not _is_valid_video_id(video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    url = await _resolve_audio_url(video_id, low=low)
    if not url:
        raise HTTPException(status_code=404, detail="Could not extract stream")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    client = _get_stream_client()
    try:
        req = client.build_request("GET", url, headers=headers)
        r = await client.send(req, stream=True)

        if r.status_code not in (200, 206):
            await r.aclose()
            raise HTTPException(status_code=502, detail=f"Upstream returned {r.status_code}")

        resp_headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": r.headers.get("Content-Type", "audio/webm"),
        }
        if "Content-Range" in r.headers:
            resp_headers["Content-Range"] = r.headers["Content-Range"]
        if "Content-Length" in r.headers:
            resp_headers["Content-Length"] = r.headers["Content-Length"]

        async def generate():
            try:
                async for chunk in r.aiter_bytes(chunk_size=65536):
                    yield chunk
            finally:
                await r.aclose()

        return StreamingResponse(generate(), status_code=206 if r.status_code == 206 else 200, headers=resp_headers)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Upstream connection failed")


@router.get("/search/playlist")
async def import_playlist(url: str):
    """Import tracks from a Spotify or YouTube/YouTube Music playlist."""
    if not url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    url_clean = url.strip()
    
    # 1. Spotify Playlist
    if "spotify.com" in url_clean:
        try:
            import json
            # Parse Spotify Playlist (scraped fallback)
            match = re.search(r"/playlist/([a-zA-Z0-9]+)", url_clean)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid Spotify playlist URL")
            playlist_id = match.group(1)
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://open.spotify.com/",
            }
            client = _get_stream_client()
            embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
            r = await client.get(embed_url, headers=headers, follow_redirects=True)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Spotify playlist not found or inaccessible")
            
            html = r.text
            tracks = []
            
            # Parse Next.js pageProps data from embed
            next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
            if next_data_match:
                try:
                    next_data = json.loads(next_data_match.group(1))
                    page_props = next_data.get("props", {}).get("pageProps", {})
                    state = page_props.get("state", {})
                    if "data" in state and "entity" in state["data"]:
                        entity = state["data"]["entity"]
                        track_list = entity.get("trackList", [])
                        for track in track_list:
                            title = track.get("title")
                            artist = track.get("subtitle", "Unknown Artist")
                            if title:
                                artist = artist.replace("\xa0", " ").strip()
                                title = title.strip()
                                tracks.append({
                                    "name": title,
                                    "artist": artist,
                                    "uri": f"{title} {artist} official audio",
                                    "duration_ms": track.get("duration", 0)
                                })
                except Exception as parse_err:
                    logger.error(f"Error parsing Spotify embed __NEXT_DATA__: {parse_err}")
            
            # Fallback patterns if __NEXT_DATA__ did not yield tracks
            if not tracks:
                # Scrape tracks with regex pattern matching "name":"..." and "artists":[...]
                matches = re.findall(r'"name"\s*:\s*"([^"]+)"\s*,\s*"artists"\s*:\s*\[\s*\{\s*"name"\s*:\s*"([^"]+)"', html)
                if matches:
                    for name, artist in matches:
                        try:
                            name = name.encode().decode('unicode_escape', errors='ignore')
                            artist = artist.encode().decode('unicode_escape', errors='ignore')
                        except Exception:
                            pass
                        tracks.append({"name": name, "artist": artist, "uri": f"{name} {artist} official audio"})
                
                if not tracks:
                    # Alternate pattern
                    matches = re.findall(r'"title"\s*:\s*"([^"]+)"\s*,\s*"subtitle"\s*:\s*"([^"]+)"', html)
                    for title, subtitle in matches:
                        if title and subtitle and subtitle != "Playlist":
                            tracks.append({"name": title, "artist": subtitle, "uri": f"{title} {subtitle} official audio"})
                        
            # Deduplicate
            seen = set()
            deduped = []
            for t in tracks:
                key = (t["name"].lower(), t["artist"].lower())
                if key not in seen:
                    seen.add(key)
                    deduped.append(t)
            
            return {"tracks": deduped[:100]}
            
        except Exception as e:
            logger.error(f"Spotify playlist import error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
    # 2. YouTube/YouTube Music Playlist
    elif "youtube.com" in url_clean or "youtu.be" in url_clean:
        def _extract_yt_playlist(url_to_parse):
            ydl_opts = {
                "extract_flat": True,
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url_to_parse, download=False)
                if not info:
                    return []
                entries = info.get("entries", [])
                extracted = []
                for entry in entries:
                    if not entry:
                        continue
                    title = entry.get("title", "")
                    artist = "Unknown"
                    name = title
                    if " - " in title:
                        parts = title.split(" - ", 1)
                        artist = parts[0].strip()
                        name = parts[1].strip()
                    elif " | " in title:
                        parts = title.split(" | ", 1)
                        artist = parts[0].strip()
                        name = parts[1].strip()
                    
                    video_id = entry.get("id")
                    uri = video_id if (video_id and len(video_id) == 11) else title
                    extracted.append({
                        "name": name,
                        "artist": artist,
                        "uri": uri,
                    })
                return extracted

        try:
            tracks = await asyncio.to_thread(_extract_yt_playlist, url_clean)
            return {"tracks": tracks[:100]}
        except Exception as e:
            logger.error(f"YouTube playlist import error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
    else:
        raise HTTPException(status_code=400, detail="Unsupported playlist URL format (must be Spotify or YouTube)")
