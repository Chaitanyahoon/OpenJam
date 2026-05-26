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
from backend.services.invidious import get_stream_url as get_invidious_stream_url, report_stream_failure
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


# ── Cookie support for yt-dlp ───────────────────────────────────────
_cookie_path: str | None = None

def _get_cookie_path() -> str | None:
    """Write YOUTUBE_COOKIES env var to a temp file and return its path."""
    global _cookie_path
    if _cookie_path:
        import os as _os
        if _os.path.exists(_cookie_path):
            return _cookie_path
    
    import os as _os
    cookie_str = _os.getenv("YOUTUBE_COOKIES", "").strip()
    if not cookie_str:
        return None
    
    try:
        import tempfile
        # Replace literal \n with actual newlines
        cookie_content = cookie_str.replace("\\n", "\n")
        fd, path = tempfile.mkstemp(suffix=".txt", prefix="ytcookies_")
        with _os.fdopen(fd, "w") as f:
            f.write(cookie_content)
        _cookie_path = path
        logger.info(f"YouTube cookies written to {path}")
        return path
    except Exception as e:
        logger.warning(f"Failed to write YouTube cookies: {e}")
        return None


def _extract_ytdlp_sync(video_id: str, low: bool = False) -> str | None:
    ydl_opts = {
        "format": "worstaudio/bestaudio/best" if low else "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best",
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "geo_bypass": True,
        "extractor_retries": 3,
        "socket_timeout": 12,
        "source_address": "0.0.0.0",
        "nocheckcertificate": True,
        # Use web player client — less restricted than default
        "extractor_args": {"youtube": {"player_client": ["web"]}},
    }

    # Browser impersonation (requires curl-cffi)
    try:
        from yt_dlp.networking.impersonate import ImpersonateTarget
        ydl_opts["impersonate"] = ImpersonateTarget.from_str("chrome")
    except (ImportError, Exception) as e:
        logger.debug(f"yt-dlp impersonation not available: {e}")

    # Cookie support for bypassing bot detection
    cookie_file = _get_cookie_path()
    if cookie_file:
        ydl_opts["cookiefile"] = cookie_file

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            url = info.get("url")
            if not url and info.get("formats"):
                # Fallback: pick the best audio format manually
                audio_fmts = [f for f in info["formats"] if f.get("acodec") != "none" and f.get("url")]
                if audio_fmts:
                    audio_fmts.sort(key=lambda f: f.get("abr") or f.get("tbr") or 0, reverse=not low)
                    url = audio_fmts[0]["url"]
            if url:
                logger.info(f"yt-dlp resolved stream URL for {video_id}")
            return url
    except Exception as e:
        logger.error(f"yt-dlp failed for {video_id} (low={low}): {e}")
        return None


async def _resolve_audio_url(video_id: str, low: bool = False) -> str | None:
    """Race all extraction methods — Invidious, Piped, yt-dlp, Cobalt.
    
    Uses whichever resolves first. Results cached in _url_cache.
    """
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

    async def _try_cobalt() -> str | None:
        try:
            from backend.services.cobalt import get_cobalt_stream_url
            return await get_cobalt_stream_url(video_id)
        except Exception as e:
            logger.warning(f"Cobalt failed for {video_id}: {e}")
            return None

    # Race all methods in parallel — first success wins
    tasks = [_try_invidious(), _try_ytdlp(), _try_cobalt()]
    url = None
    for coro in asyncio.as_completed(tasks):
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

    cache_key = f"{video_id}_low" if low else video_id
    max_attempts = 2
    last_error_detail = "Could not extract stream"

    for attempt in range(1, max_attempts + 1):
        url = await _resolve_audio_url(video_id, low=low)
        if not url:
            raise HTTPException(status_code=404, detail="Could not extract stream")

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        range_header = request.headers.get("Range")
        if range_header:
            headers["Range"] = range_header

        client = _get_stream_client()
        try:
            logger.info(f"Streaming from url: {url} (attempt {attempt}/{max_attempts})")
            req = client.build_request("GET", url, headers=headers)
            r = await client.send(req, stream=True)

            if r.status_code not in (200, 206):
                await r.aclose()
                logger.warning(f"Upstream returned status {r.status_code} for {video_id} on attempt {attempt}")
                report_stream_failure(url)
                if cache_key in _url_cache:
                    del _url_cache[cache_key]
                last_error_detail = f"Upstream returned status {r.status_code}"
                continue

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

            return StreamingResponse(
                generate(),
                status_code=206 if r.status_code == 206 else 200,
                headers=resp_headers,
            )
        except Exception as e:
            logger.warning(f"Connection or stream failure for {video_id} on attempt {attempt}: {e}")
            report_stream_failure(url)
            if cache_key in _url_cache:
                del _url_cache[cache_key]
            last_error_detail = f"Upstream connection failed: {e}"
            continue

    raise HTTPException(status_code=502, detail=last_error_detail)


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
            match = re.search(r"/playlist/([a-zA-Z0-9]+)", url_clean)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid Spotify playlist URL")
            playlist_id = match.group(1)
            
            sp_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://open.spotify.com/",
            }
            client = _get_stream_client()
            
            # ── Tier 1: Parse embed page __NEXT_DATA__ ──
            embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
            r = await client.get(embed_url, headers=sp_headers, follow_redirects=True)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Spotify playlist not found or inaccessible")
            
            html = r.text
            tracks = []
            embed_had_404 = False
            anon_token = None
            
            next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
            if next_data_match:
                try:
                    next_data = json.loads(next_data_match.group(1))
                    page_props = next_data.get("props", {}).get("pageProps", {})
                    
                    if page_props.get("status") == 404:
                        embed_had_404 = True
                    else:
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
            
            # ── Tier 2: Anonymous token + Web API fallback ──
            if not tracks and embed_had_404:
                logger.info(f"Spotify embed returned 404 for {playlist_id}, trying anonymous API fallback")
                try:
                    # Fetch a known-working embed to extract an anonymous access token
                    seed_url = "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO"
                    seed_r = await client.get(seed_url, headers=sp_headers, follow_redirects=True)
                    token_match = re.search(r'"accessToken"\s*:\s*"([^"]+)"', seed_r.text)
                    if token_match:
                        anon_token = token_match.group(1)
                        api_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
                        api_params = {
                            "limit": 100,
                            "fields": "items(track(name,artists(name),duration_ms)),total,next"
                        }
                        api_r = await client.get(
                            api_url,
                            headers={"Authorization": f"Bearer {anon_token}"},
                            params=api_params
                        )
                        if api_r.status_code == 200:
                            api_data = api_r.json()
                            for item in api_data.get("items", []):
                                t = item.get("track")
                                if t and t.get("name"):
                                    artists = ", ".join(a["name"] for a in t.get("artists", []))
                                    tracks.append({
                                        "name": t["name"],
                                        "artist": artists,
                                        "uri": f"{t['name']} {artists} official audio",
                                        "duration_ms": t.get("duration_ms", 0)
                                    })
                        else:
                            logger.warning(f"Spotify API fallback returned {api_r.status_code} for {playlist_id}")
                except Exception as api_err:
                    logger.error(f"Spotify API fallback error: {api_err}")
            
            # ── Tier 3: Regex fallback on raw HTML ──
            if not tracks:
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
            
            if not deduped:
                raise HTTPException(
                    status_code=404,
                    detail="Could not extract tracks from this playlist. Make sure the playlist is set to Public on Spotify and try again."
                )
            
            return {"tracks": deduped[:100]}
            
        except HTTPException:
            raise
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


@router.get("/stream/health")
async def stream_health():
    """Diagnostic: test all extraction methods against a known video.
    
    Use this to check which methods are working on your deployment.
    """
    test_id = "dQw4w9WgXcQ"  # Rick Astley — always available on YouTube
    results = {}

    # Test yt-dlp
    try:
        url = await asyncio.to_thread(_extract_ytdlp_sync, test_id)
        results["ytdlp"] = {
            "status": "ok" if url else "no_url",
            "url_preview": (url[:80] + "...") if url else None,
        }
    except Exception as e:
        results["ytdlp"] = {"status": "error", "error": str(e)[:200]}

    # Test Invidious/Piped
    try:
        url = await get_invidious_stream_url(test_id)
        results["invidious_piped"] = {
            "status": "ok" if url else "no_url",
            "url_preview": (url[:80] + "...") if url else None,
        }
    except Exception as e:
        results["invidious_piped"] = {"status": "error", "error": str(e)[:200]}

    # Test Cobalt
    try:
        from backend.services.cobalt import get_cobalt_stream_url
        url = await get_cobalt_stream_url(test_id)
        results["cobalt"] = {
            "status": "ok" if url else "no_url_or_not_configured",
            "url_preview": (url[:80] + "...") if url else None,
        }
    except Exception as e:
        results["cobalt"] = {"status": "error", "error": str(e)[:200]}

    # Summary
    working = [k for k, v in results.items() if v.get("status") == "ok"]
    results["summary"] = {
        "working_methods": working,
        "total_working": len(working),
        "recommendation": (
            "All methods working!" if len(working) == 3
            else f"{len(working)}/3 methods working. " + (
                "Consider adding YOUTUBE_COOKIES or COBALT_API_URL env vars."
                if len(working) < 2 else "Acceptable reliability."
            )
        ),
    }

    return results
