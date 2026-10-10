"""Queue and voting routes + track search."""

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.middleware.auth import get_current_user_id
from backend.models.queue_item import QueueItem
from backend.models.room import Room
from backend.models.user import User
from backend.routes.rooms import check_room_access
from backend.schemas import PlaylistTrackRequest, QueueTrackRequest
from backend.services.audio_stream_engine import (
    audio_stream_engine,
    download_and_cache_track,
    get_stream_response,
    pre_resolve_url,
    resolve_stream_url,
)
from backend.services.invidious import report_stream_failure
from backend.services.music_search import music_search_service
from backend.services.queue_manager import queue_manager
from backend.services.room_manager import room_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["queue"])

# Backward-compatibility aliases for callers and test monkeypatches
_resolve_audio_url = resolve_stream_url
_get_stream_client = audio_stream_engine.get_stream_client
CACHE_DIR = audio_stream_engine.cache_dir
redis_store = audio_stream_engine.redis_store
_url_cache = audio_stream_engine._url_cache


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
        resolved_id = await music_search_service.resolve_youtube(uri)
        if resolved_id:
            track_data["uri"] = resolved_id
            uri = resolved_id

    # Resolve actual YouTube title, artist, and thumbnail if generic or missing
    if uri and len(uri) == 11:
        if track_data.get("name") in ["YouTube Video", "", None, uri] or track_data.get("artist") in ["YouTube", "Search Query", "", None]:
            metadata = await music_search_service.resolve_youtube_metadata(uri)
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
                video_id = await music_search_service.resolve_youtube(uri)
                if video_id:
                    await pre_resolve_url(video_id)
            except Exception as e:
                logger.warning(f"Failed to pre-resolve search result {uri}: {e}")


@router.get("/search/tracks")
async def search_tracks(q: str = ""):
    if not q.strip():
        return {"tracks": []}
    tracks = await music_search_service.search_tracks(q.strip())
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

    video_id = await music_search_service.resolve_youtube(q.strip())
    return {"video_id": video_id}


@router.get("/search/alternate")
async def get_alternate_track(q: str = "", exclude: str = ""):
    """Find an alternate YouTube video ID when a track is restricted in region or unavailable."""
    if not q.strip():
        return {"video_id": None}
    alt_id = await music_search_service.resolve_alternate_video(q.strip(), exclude_id=exclude.strip() or None)
    return {"video_id": alt_id}


@router.get("/search/recommendations")
async def get_recommendations():
    """Return trending/popular tracks as search starting suggestions (no key needed)."""
    tracks = await music_search_service.get_recommendations()
    if tracks:
        asyncio.create_task(pre_resolve_search_results(tracks[:3]))
    return {"tracks": tracks}


@router.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request, low: bool = False, nocache: bool = False):
    """Proxy audio stream via AudioStreamEngine."""
    return await get_stream_response(
        video_id,
        request,
        low=low,
        nocache=nocache,
        resolve_fn=_resolve_audio_url,
        client_getter=_get_stream_client,
        failure_reporter=report_stream_failure,
    )


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

    track_list = []
    for t in tracks:
        track_list.append({
            "uri": t.track_uri,
            "name": t.track_name,
            "artist": t.artist,
            "album_art_url": t.album_art_url,
            "duration_ms": t.duration_ms,
        })

    from backend.sockets.queue import _db_add_multiple_to_queue
    try:
        queue, next_item = await asyncio.to_thread(
            _db_add_multiple_to_queue,
            room_id,
            track_list,
            user_id,
            display_name,
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

            from backend.sockets.queue import _db_get_queue_after_next
            try:
                queue = await asyncio.to_thread(_db_get_queue_after_next, room_id)
            except Exception:
                pass

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

        from backend.sockets.playback import pre_resolve_next_track_background
        asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))
        from backend.sockets.queue import resolve_room_queue_background
        asyncio.create_task(resolve_room_queue_background(room_id, sio))

    return {"message": f"Successfully queued {len(track_list)} tracks", "added_count": len(track_list)}


@router.get("/stream/health")
async def stream_health():
    """Diagnostic: test stream extraction methods against a known video."""
    test_id = "dQw4w9WgXcQ"  # Rick Astley — always available on YouTube
    results = {}

    # Test Invidious/Piped
    try:
        from backend.services.invidious import get_stream_url as get_invidious_stream_url
        inv_url = await get_invidious_stream_url(test_id)
        results["invidious_piped"] = {
            "status": "ok" if inv_url else "no_url",
            "url_preview": (inv_url[:80] + "...") if inv_url else None,
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
            "Stream extractors are working properly!" if len(working) > 0
            else "Resolvers unavailable. Frontend fallback to native YouTube player is active."
        ),
    }

    return results
