"""Queue and voting routes + track search."""

import asyncio
import logging
import re
import time
import os
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import httpx
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.room import Room
from backend.models.queue_item import QueueItem
from backend.models.user import User
from backend.middleware.auth import get_current_user_id
from backend.services.queue_manager import queue_manager
from backend.services.room_manager import room_manager
from backend.services.music_search import music_search_service as lastfm_service

def report_stream_failure(stream_url: str):
    """No-op failover reporting for deprecated extractors."""
    pass
from backend.schemas import QueueTrackRequest, PlaylistTrackRequest
from backend.routes.rooms import check_room_access
from backend.services.redis_store import RedisStore

redis_store = RedisStore()

logger = logging.getLogger(__name__)
router = APIRouter(tags=["queue"])

CACHE_DIR = Path(__file__).parent.parent / "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# Lock map to serialize duplicate background downloads of the same video ID
_downloading_locks = {}
_downloading_locks_lock = asyncio.Lock()

async def get_download_lock(video_id: str):
    async with _downloading_locks_lock:
        if len(_downloading_locks) > 200:
            to_remove = [k for k, l in _downloading_locks.items() if not l.locked()]
            for k in to_remove:
                del _downloading_locks[k]
        if video_id not in _downloading_locks:
            _downloading_locks[video_id] = asyncio.Lock()
        return _downloading_locks[video_id]

# Lock map to serialize duplicate concurrent resolutions of the same video ID
_resolving_locks = {}
_resolving_locks_lock = asyncio.Lock()

async def get_resolve_lock(video_id: str):
    async with _resolving_locks_lock:
        if len(_resolving_locks) > 200:
            to_remove = [k for k, l in _resolving_locks.items() if not l.locked()]
            for k in to_remove:
                del _resolving_locks[k]
        if video_id not in _resolving_locks:
            _resolving_locks[video_id] = asyncio.Lock()
        return _resolving_locks[video_id]

async def cleanup_old_cache(max_cache_size_mb: int = 100):
    """Cleanup oldest cache files if total cache size exceeds max_cache_size_mb."""
    try:
        files = []
        for file in CACHE_DIR.glob("*"):
            if file.is_file() and not file.name.endswith(".tmp"):
                files.append((file, file.stat().st_mtime, file.stat().st_size))
        
        total_size = sum(f[2] for f in files)
        max_bytes = max_cache_size_mb * 1024 * 1024
        
        if total_size > max_bytes:
            # Sort files by modification time (oldest first)
            files.sort(key=lambda x: x[1])
            bytes_to_delete = total_size - max_bytes
            deleted_bytes = 0
            
            for file, _, size in files:
                if deleted_bytes >= bytes_to_delete:
                    break
                try:
                    os.remove(file)
                    deleted_bytes += size
                    logger.info(f"Deleted old cache file {file.name} to free disk space")
                except Exception as e:
                    logger.warning(f"Failed to delete cache file {file.name}: {e}")
    except Exception as e:
        logger.warning(f"Error cleaning up cache: {e}")

async def download_and_cache_track(video_id: str) -> str | None:
    """Download track audio stream in background and cache it locally."""
    # Check if any cached version already exists
    for ext in ["webm", "m4a", "cache"]:
        file_path = CACHE_DIR / f"{video_id}.{ext}"
        if file_path.exists() and file_path.stat().st_size > 500000:
            return str(file_path)

    lock = await get_download_lock(video_id)
    async with lock:
        # Check again in case another task completed while waiting
        for ext in ["webm", "m4a", "cache"]:
            file_path = CACHE_DIR / f"{video_id}.{ext}"
            if file_path.exists() and file_path.stat().st_size > 500000:
                return str(file_path)

        url = await _resolve_audio_url(video_id)
        if not url:
            logger.warning(f"Could not resolve stream URL to cache video {video_id}")
            return None

        # Determine extension based on resolved URL
        ext = "webm"
        if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
            ext = "m4a"
        elif "mime=audio/webm" in url or "ext=webm" in url or ".webm" in url:
            ext = "webm"

        temp_path = CACHE_DIR / f"{video_id}.{ext}.tmp"
        final_path = CACHE_DIR / f"{video_id}.{ext}"

        logger.info(f"Downloading track {video_id} to cache: {final_path}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }

        try:
            client = _get_stream_client()
            req = client.build_request("GET", url, headers=headers)
            r = await client.send(req, stream=True)
            try:
                if r.status_code not in (200, 206):
                    logger.warning(f"Failed to download from YouTube for caching: {r.status_code}")
                    return None

                with open(temp_path, "wb") as f:
                    async for chunk in r.aiter_bytes(chunk_size=65536):
                        f.write(chunk)
                        await asyncio.sleep(0)
            finally:
                await r.aclose()

            if temp_path.exists() and temp_path.stat().st_size > 100000:
                shutil.move(temp_path, final_path)
                logger.info(f"Successfully cached track {video_id} to {final_path} (size: {final_path.stat().st_size} bytes)")
                asyncio.create_task(cleanup_old_cache())
                return str(final_path)
            else:
                logger.warning(f"Downloaded cache file for {video_id} was too small or empty")
                if temp_path.exists():
                    os.remove(temp_path)
        except Exception as e:
            logger.warning(f"Error downloading {video_id} to cache: {e}")
            if temp_path.exists():
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
        return None


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
    else:
        user_name = user.display_name

    track_data = track.model_dump() if hasattr(track, "model_dump") else track.dict()
    
    uri = track_data.get("uri")
    if uri and (" " in uri or len(uri) != 11):
        resolved_id = await lastfm_service.resolve_youtube(uri)
        if resolved_id:
            track_data["uri"] = resolved_id
            uri = resolved_id

    # Resolve actual YouTube title, artist, and thumbnail if generic or missing
    if uri and len(uri) == 11:
        if track_data.get("name") in ["YouTube Video", "", None, uri] or track_data.get("artist") in ["YouTube", "Search Query", "", None]:
            metadata = await lastfm_service.resolve_youtube_metadata(uri)
            if metadata:
                track_data["name"] = metadata["title"]
                track_data["artist"] = metadata["author"]
                track_data["album_art_url"] = metadata["thumbnail"]

    if not track_data.get("uri") or not track_data.get("name"):
        raise HTTPException(status_code=400, detail="Track URI and Name are required")

    # Prevent duplicate additions
    if uri:
        duplicate = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.track_uri == uri,
            QueueItem.status.in_(["pending", "playing"]),
        ).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="This track is already in the queue")

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

    # Pre-resolve the new next track in queue in background
    if queue:
        next_track_uri = None
        for q_item in queue:
            if q_item.get("status") != "playing" and q_item.get("status") != "played":
                next_track_uri = q_item.get("track_uri")
                break
        if next_track_uri and len(next_track_uri) == 11:
            asyncio.create_task(pre_resolve_url(next_track_uri))

    return {"queue": queue}


async def pre_resolve_search_results(tracks: list):
    """Resolve YouTube IDs and pre-resolve stream URLs in background for search/reco results."""
    for track in tracks:
        uri = track.get("uri")
        if uri and (" " in uri or len(uri) != 11):
            try:
                # Run resolve_youtube asynchronously
                video_id = await lastfm_service.resolve_youtube(uri)
                if video_id:
                    # Pre-resolve stream URL (and download to cache if configured)
                    await pre_resolve_url(video_id)
            except Exception as e:
                logger.warning(f"Failed to pre-resolve search result {uri}: {e}")

@router.get("/search/tracks")
async def search_tracks(q: str = ""):
    if not q.strip():
        return {"tracks": []}
    tracks = await lastfm_service.search_tracks(q.strip())
    if tracks:
        asyncio.create_task(pre_resolve_search_results(tracks[:3]))
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

@router.get("/rooms/{room_id}/history")
async def get_history(room_id: str, request: Request, db: Session = Depends(get_db)):
    """Fetch recently played tracks for the room."""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    user_id = get_current_user_id(request)
    if not check_room_access(room, user_id):
        raise HTTPException(status_code=403, detail="Room access denied. Password verification required.")
    history = queue_manager.get_history(db, room_id)
    return {"history": history}



@router.get("/search/resolve")
async def resolve_youtube(q: str = ""):
    """Resolve a YouTube video ID from a search query using ytmusicapi (No API key needed)."""
    if not q.strip():
        return {"video_id": None}

    video_id = await lastfm_service.resolve_youtube(q.strip())
    return {"video_id": video_id}


@router.get("/search/recommendations")
async def get_recommendations():
    """Return trending/popular tracks as search starting suggestions (no key needed)."""
    tracks = await lastfm_service.get_recommendations()
    if tracks:
        asyncio.create_task(pre_resolve_search_results(tracks[:3]))
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


# Removed yt-dlp cookie helper and sync extractor


async def _is_url_valid(url: str) -> bool:
    """Validate a cached stream URL with a fast HEAD request to check if it's still alive."""
    if not url:
        return False
    try:
        client = _get_stream_client()
        # Fast HEAD request with a 1.0s timeout to check signature/status
        r = await client.request("HEAD", url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }, timeout=1.0)
        # Any success or redirect status means the URL is still functional
        if r.status_code in (200, 206, 301, 302):
            return True
        logger.warning(f"Cached stream URL returned status code {r.status_code} in validation probe")
        return False
    except Exception as e:
        logger.warning(f"Probe validation failed for cached stream URL: {e}")
        return False


async def _resolve_audio_url(video_id: str, low: bool = False) -> str | None:
    """Race all extraction methods — Invidious, Piped, yt-dlp, Cobalt.
    
    Uses whichever resolves first. Results cached in _url_cache.
    """
    if not _is_valid_video_id(video_id):
        logger.warning(f"Invalid video_id rejected: {video_id!r}")
        return None

    cache_key = f"{video_id}_low" if low else video_id

    # Fast path check outside lock
    if cache_key in _url_cache:
        url, expiry = _url_cache[cache_key]
        if time.time() < expiry:
            if await _is_url_valid(url):
                return url
            logger.info(f"Evicting invalid memory-cached stream URL for {cache_key}")
            del _url_cache[cache_key]
            if redis_store.client:
                try:
                    redis_store.client.delete(f"openjam:url:{cache_key}")
                except Exception:
                    pass
        else:
            del _url_cache[cache_key]

    if redis_store.client:
        try:
            cached_url = redis_store.client.get(f"openjam:url:{cache_key}")
            if cached_url:
                if await _is_url_valid(cached_url):
                    _url_cache[cache_key] = (cached_url, time.time() + _URL_CACHE_TTL)
                    logger.info(f"Resolved stream URL for {cache_key} from Redis cache")
                    return cached_url
                logger.info(f"Evicting invalid Redis-cached stream URL for {cache_key}")
                redis_store.client.delete(f"openjam:url:{cache_key}")
        except Exception as e:
            logger.warning(f"Failed to retrieve stream URL from Redis for {cache_key}: {e}")

    # Acquire resolve lock for this video ID to serialize concurrent requests
    resolve_lock = await get_resolve_lock(video_id)
    async with resolve_lock:
        # Check cache again inside lock in case another task resolved it while we were waiting
        if cache_key in _url_cache:
            url, expiry = _url_cache[cache_key]
            if time.time() < expiry:
                if await _is_url_valid(url):
                    return url
                logger.info(f"Evicting invalid memory-cached stream URL (inside lock) for {cache_key}")
                del _url_cache[cache_key]
                if redis_store.client:
                    try:
                        redis_store.client.delete(f"openjam:url:{cache_key}")
                    except Exception:
                        pass
            else:
                del _url_cache[cache_key]

        if redis_store.client:
            try:
                cached_url = redis_store.client.get(f"openjam:url:{cache_key}")
                if cached_url:
                    if await _is_url_valid(cached_url):
                        _url_cache[cache_key] = (cached_url, time.time() + _URL_CACHE_TTL)
                        logger.info(f"Resolved stream URL for {cache_key} from Redis cache (inside lock)")
                        return cached_url
                    logger.info(f"Evicting invalid Redis-cached stream URL (inside lock) for {cache_key}")
                    redis_store.client.delete(f"openjam:url:{cache_key}")
            except Exception:
                pass

        logger.info(f"Resolving stream URL using Cobalt for {video_id}")
        url = None
        try:
            from backend.services.cobalt import get_cobalt_stream_url
            url = await asyncio.wait_for(get_cobalt_stream_url(video_id), timeout=12.0)
        except asyncio.TimeoutError:
            logger.warning(f"Cobalt resolution timed out after 12.0s for {video_id}")
        except Exception as e:
            logger.warning(f"Cobalt failed for {video_id}: {e}")

        # Fallback to Invidious/Piped stream URL resolver if Cobalt fails
        if not url:
            logger.info(f"Cobalt failed to resolve stream for {video_id}, falling back to Invidious/Piped...")
            try:
                from backend.services.invidious import get_stream_url as get_invidious_stream_url
                url = await asyncio.wait_for(get_invidious_stream_url(video_id), timeout=10.0)
            except Exception as e:
                logger.warning(f"Invidious/Piped fallback failed for {video_id}: {e}")

        # Fallback to yt-dlp if Invidious and Cobalt both fail
        if not url:
            logger.info(f"Invidious/Piped failed to resolve stream for {video_id}, falling back to yt-dlp...")
            try:
                import yt_dlp
                loop = asyncio.get_running_loop()
                def extract():
                    ydl_opts = {
                        "format": "bestaudio/best",
                        "quiet": True,
                        "no_warnings": True,
                        "nocheckcertificate": True,
                        "ignoreerrors": True,
                        "skip_download": True,
                    }
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        return ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                info = await loop.run_in_executor(None, extract)
                if info:
                    url = info.get("url")
            except Exception as e:
                logger.warning(f"yt-dlp extraction fallback failed for {video_id}: {e}")

        if url:
            _prune_url_cache()
            _url_cache[cache_key] = (url, time.time() + _URL_CACHE_TTL)
            if redis_store.client:
                try:
                    redis_store.client.set(f"openjam:url:{cache_key}", url, ex=_URL_CACHE_TTL)
                    logger.info(f"Successfully cached stream URL for {cache_key} in Redis")
                except Exception as e:
                    logger.warning(f"Failed to cache stream URL in Redis for {cache_key}: {e}")
        return url


async def pre_resolve_url(video_id: str):
    """Resolve a stream URL and pre-download the file to the local cache."""
    is_resolved = False
    if video_id in _url_cache:
        is_resolved = True
    elif redis_store.client:
        try:
            if redis_store.client.exists(f"openjam:url:{video_id}"):
                is_resolved = True
        except Exception:
            pass

    if not is_resolved:
        if video_id in _resolving:
            return
        _resolving.add(video_id)
        try:
            await _resolve_audio_url(video_id)
        except Exception as e:
            logger.warning(f"Pre-resolve URL failed for {video_id}: {e}")
        finally:
            _resolving.discard(video_id)
            
    # Trigger background download to local cache
    try:
        asyncio.create_task(download_and_cache_track(video_id))
    except Exception as e:
        logger.warning(f"Failed to trigger background pre-download for {video_id}: {e}")


@router.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request, low: bool = False, nocache: bool = False):
    if not _is_valid_video_id(video_id):
        raise HTTPException(status_code=400, detail="Invalid video ID")

    # Check if high-quality or low-quality is already cached locally
    for vid_id in [video_id, f"{video_id}_low"]:
        for ext in ["webm", "m4a", "cache"]:
            file_path = CACHE_DIR / f"{vid_id}.{ext}"
            if file_path.exists() and file_path.stat().st_size > 500000:
                logger.info(f"Serving cached file for track {video_id}: {file_path}")
                media_type = "audio/webm" if ext == "webm" else ("audio/mp4" if ext == "m4a" else "application/octet-stream")
                return FileResponse(
                    str(file_path),
                    media_type=media_type,
                    headers={"Accept-Ranges": "bytes"}
                )

    # Fallback: Live streaming from YouTube
    cache_key = f"{video_id}_low" if low else video_id
    if nocache:
        if cache_key in _url_cache:
            try:
                del _url_cache[cache_key]
                logger.info(f"Invalidated stream local cache for {cache_key} due to nocache=true")
            except KeyError:
                pass
        if redis_store.client:
            try:
                redis_store.client.delete(f"openjam:url:{cache_key}")
                logger.info(f"Invalidated stream Redis cache for {cache_key} due to nocache=true")
            except Exception as e:
                logger.warning(f"Failed to delete stream URL from Redis for {cache_key}: {e}")

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
            logger.info(f"Streaming live from url: {url} (attempt {attempt}/{max_attempts})")
            req = client.build_request("GET", url, headers=headers)
            r = await client.send(req, stream=True)

            if r.status_code not in (200, 206):
                await r.aclose()
                logger.warning(f"Upstream returned status {r.status_code} for {video_id} on attempt {attempt}")
                report_stream_failure(url)
                if cache_key in _url_cache:
                    del _url_cache[cache_key]
                if redis_store.client:
                    try:
                        redis_store.client.delete(f"openjam:url:{cache_key}")
                        logger.info(f"Evicted invalid stream URL for {cache_key} from Redis")
                    except Exception:
                        pass
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

            # Determine if we should attempt on-the-fly caching
            content_range = r.headers.get("Content-Range", "")
            starts_at_zero = (r.status_code == 200) or (r.status_code == 206 and content_range.strip().startswith("bytes 0-"))
            
            temp_path = None
            f_cache = None
            
            if starts_at_zero:
                ext = "webm"
                if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
                    ext = "m4a"
                elif "mime=audio/webm" in url or "ext=webm" in url or ".webm" in url:
                    ext = "webm"
                
                final_path = CACHE_DIR / f"{cache_key}.{ext}"
                if not final_path.exists():
                    temp_path = CACHE_DIR / f"{cache_key}.{ext}.{uuid.uuid4().hex}.tmp"
                    try:
                        f_cache = open(temp_path, "wb")
                        logger.info(f"Started on-the-fly streaming cache for {video_id} to {temp_path}")
                    except Exception as e:
                        logger.warning(f"Could not open temp file for streaming cache: {e}")
                        f_cache = None
                        temp_path = None

            completed = False
            async def generate():
                nonlocal completed, f_cache, temp_path
                bytes_written = 0
                try:
                    async for chunk in r.aiter_bytes(chunk_size=32768):
                        yield chunk
                        if f_cache:
                            try:
                                f_cache.write(chunk)
                                bytes_written += len(chunk)
                            except Exception as e:
                                logger.warning(f"Error writing chunk to on-the-fly cache: {e}")
                                try:
                                    f_cache.close()
                                except Exception:
                                    pass
                                f_cache = None
                                if temp_path and temp_path.exists():
                                    try: os.remove(temp_path)
                                    except Exception: pass
                    completed = True
                finally:
                    await r.aclose()
                    if f_cache:
                        try:
                            f_cache.close()
                            if completed and temp_path and temp_path.exists() and bytes_written > 500000:
                                ext = "webm"
                                if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
                                    ext = "m4a"
                                final_path = CACHE_DIR / f"{cache_key}.{ext}"
                                if final_path.exists():
                                    try: os.remove(temp_path)
                                    except Exception: pass
                                    logger.info(f"Track {video_id} was already cached by another request, discarded temp file.")
                                else:
                                    shutil.move(temp_path, final_path)
                                    logger.info(f"Successfully finalized on-the-fly cache for {video_id}: {final_path} (size: {bytes_written} bytes)")
                                    asyncio.create_task(cleanup_old_cache())
                            else:
                                if temp_path and temp_path.exists():
                                    os.remove(temp_path)
                        except Exception as e:
                            logger.warning(f"Failed to finalize on-the-fly cache: {e}")
                            if temp_path and temp_path.exists():
                                try: os.remove(temp_path)
                                except Exception: pass

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
            if redis_store.client:
                try:
                    redis_store.client.delete(f"openjam:url:{cache_key}")
                except Exception:
                    pass
            last_error_detail = f"Upstream connection failed: {e}"
            continue

    raise HTTPException(status_code=502, detail=last_error_detail)


@router.get("/search/playlist")
async def import_playlist_endpoint(url: str):
    """Import tracks from a Spotify or YouTube/YouTube Music playlist."""
    from backend.services.playlist_importer import import_playlist
    return await import_playlist(url)


@router.post("/rooms/{room_id}/queue/multiple")
async def add_multiple_tracks_to_queue(
    room_id: str,
    tracks: list[PlaylistTrackRequest],
    request: Request,
):
    """Add multiple tracks to a room's queue. Emits socket updates to the room."""
    user_data = get_current_user_id(request, include_name=True)
    user_id = user_data["id"] if user_data else str(uuid.uuid4())
    display_name = user_data["display_name"] if user_data else f"Jammer-{uuid.uuid4().hex[:4].upper()}"

    # Map PlaylistTrackRequest list to dict list for the helper
    track_list = []
    for t in tracks:
        track_list.append({
            "uri": t.track_uri,
            "name": t.track_name,
            "artist": t.artist,
            "album_art_url": t.album_art_url,
            "duration_ms": t.duration_ms
        })

    from backend.sockets.queue import _db_add_multiple_to_queue
    try:
        queue, next_item = await asyncio.to_thread(
            _db_add_multiple_to_queue,
            room_id,
            track_list,
            user_id,
            display_name
        )
    except ValueError as e:
        error_msg = str(e)
        if error_msg == "Room not found":
            raise HTTPException(status_code=404, detail=error_msg)
        elif error_msg == "Queue is locked by host":
            raise HTTPException(status_code=403, detail=error_msg)
        else:
            raise HTTPException(status_code=400, detail=error_msg)

    # Broadcast to socket room
    sio = getattr(request.app.state, "sio", None)
    if sio:
        # Auto-play: if a first track was found, update playback and emit track_changed
        if next_item:
            logger.info(f"Auto-playing next_item for room={room_id}: {next_item.get('track_name')} ({next_item.get('track_uri')})")
            track_uri = next_item.get("track_uri", "")
            if track_uri and len(track_uri) == 11:
                asyncio.create_task(pre_resolve_url(track_uri))
            
            room_manager.update_playback(
                room_id=room_id,
                track_uri=next_item["track_uri"],
                track_name=next_item["track_name"],
                artist=next_item["artist"],
                album_art_url=next_item.get("album_art_url", ""),
                position_ms=0,
                duration_ms=next_item.get("duration_ms", 0),
                is_playing=True,
            )
            from backend.sockets.playback import ensure_sync_loop
            ensure_sync_loop(room_id, sio)
            await sio.emit("track_changed", next_item, room=room_id)
            
            # Re-fetch queue after auto-advance (no blocking — already in thread)
            from backend.sockets.queue import _db_get_queue_after_next
            try:
                queue = await asyncio.to_thread(_db_get_queue_after_next, room_id)
            except Exception:
                pass  # use the queue we already have

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)
        
        # Pre-resolve the next track in queue in background
        from backend.sockets.playback import pre_resolve_next_track_background
        asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))
        from backend.sockets.queue import resolve_room_queue_background
        asyncio.create_task(resolve_room_queue_background(room_id, sio))

    return {"message": f"Successfully queued {len(track_list)} tracks", "added_count": len(track_list)}



@router.get("/stream/health")
async def stream_health():
    """Diagnostic: test Cobalt extraction method against a known video.
    
    Use this to check if Cobalt is working on your deployment.
    """
    test_id = "dQw4w9WgXcQ"  # Rick Astley — always available on YouTube
    results = {}

    # Test yt-dlp (Deprecated)
    results["ytdlp"] = {
        "status": "deprecated",
        "error": "yt-dlp is deprecated. Using Cobalt exclusively."
    }

    # Test Invidious/Piped (Deprecated)
    results["invidious_piped"] = {
        "status": "deprecated",
        "error": "Invidious is deprecated. Using Cobalt exclusively."
    }

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
            "Cobalt is working properly!" if len(working) == 1
            else "Cobalt resolution failed. Consider adding COBALT_API_URL env var."
        ),
    }

    return results
