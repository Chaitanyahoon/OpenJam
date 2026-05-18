"""Queue and voting routes + track search."""

import asyncio
import logging
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
from backend.services.lastfm import lastfm_service
from backend.schemas import QueueTrackRequest

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
    user_name = user_data["display_name"]

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, display_name=user_name)
        db.add(user)
        db.commit()

    track_data = track.model_dump() if hasattr(track, "model_dump") else track.dict()
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
async def get_queue(room_id: str, db: Session = Depends(get_db)):
    """Lightweight queue fetch — used by the frontend 3s poll fallback."""
    queue = queue_manager.get_queue(db, room_id, None)
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
_url_cache: dict[str, tuple[str, float]] = {}
_resolving: set[str] = set()  # Track in-flight resolutions to avoid duplicates

# Reusable yt-dlp instance (expensive to create)
_ydl = None

def _get_ydl():
    global _ydl
    if _ydl is None:
        _ydl = yt_dlp.YoutubeDL({
            "format": "bestaudio/best",
            "quiet": True,
            "no_warnings": True,
            "extract_flat": False,
            "noplaylist": True,
            "skip_download": True,
            "socket_timeout": 10,
        })
    return _ydl


def _get_audio_url(video_id: str) -> str:
    """Get cached or freshly extracted YouTube stream URL."""
    if video_id in _url_cache:
        url, expiry = _url_cache[video_id]
        if time.time() < expiry:
            return url
        del _url_cache[video_id]

    ydl = _get_ydl()
    info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    url = info["url"]
    _url_cache[video_id] = (url, time.time() + _URL_CACHE_TTL)
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
        await asyncio.to_thread(_get_audio_url, video_id)
        logger.info(f"Pre-resolved stream URL for {video_id}")
    except Exception as e:
        logger.warning(f"Pre-resolve failed for {video_id}: {e}")
    finally:
        _resolving.discard(video_id)


@router.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request):
    try:
        url = await asyncio.to_thread(_get_audio_url, video_id)
    except Exception as e:
        logger.error(f"yt-dlp extraction failed for {video_id}: {e}")
        raise HTTPException(status_code=404, detail="Could not extract stream")

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    range_header = request.headers.get("Range")
    if range_header:
        headers["Range"] = range_header

    client = httpx.AsyncClient(follow_redirects=True, timeout=60.0)
    req = client.build_request("GET", url, headers=headers)
    r = await client.send(req, stream=True)

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
            await client.aclose()

    return StreamingResponse(generate(), status_code=r.status_code if r.status_code == 206 else 200, headers=resp_headers)
