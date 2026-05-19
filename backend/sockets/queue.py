"""Socket.IO queue event handlers."""

import asyncio
import socketio
from backend.database import SessionLocal
from backend.logger import get_logger
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager

logger = get_logger(__name__)


def _db_add_and_get_queue(room_id: str, track_data: dict, user_id: str, display_name: str):
    """Add a track and get current queue — runs in thread pool."""
    from backend.models.room import Room
    from backend.models.user import User
    db = SessionLocal()
    try:
        # Check queue mode permissions
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise ValueError("Room not found")
        if room.queue_mode == "curated" and room.host_user_id != user_id:
            raise ValueError("Queue is locked by host")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            db.add(User(id=user_id, display_name=display_name))
            db.flush()

        queue_manager.add_track(db, room_id, track_data, user_id, display_name)
        # Cross-check DB status with live memory to prevent accidental autoplay interrupts
        live_playback = room_manager.get_playback(room_id)
        is_playing_live = live_playback and live_playback.get("is_playing", False)
        now_playing = queue_manager.get_now_playing(db, room_id)
        
        next_item = None
        if not now_playing and not is_playing_live:
            next_item = queue_manager.advance_queue(db, room_id)
        queue = queue_manager.get_queue(db, room_id, None)
        return queue, next_item
    finally:
        db.close()


def _db_get_queue_after_next(room_id: str):
    """Get queue after advancing — runs in thread pool."""
    db = SessionLocal()
    try:
        return queue_manager.get_queue(db, room_id, None)
    finally:
        db.close()


def _db_vote_track(room_id: str, queue_item_id: str, user_id: str):
    """Vote for a track and return updated queue — runs in thread pool."""
    db = SessionLocal()
    try:
        queue_manager.vote_track(db, queue_item_id, user_id)
        return queue_manager.get_queue(db, room_id, None)
    finally:
        db.close()


def register_queue_handlers(sio: socketio.AsyncServer):

    @sio.event
    async def add_to_queue(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        room_id = data.get("room_id")
        if not room_id:
            info = room_manager.get_user_by_sid(sid)
            if not info:
                return
            room_id = info["room_id"]

        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name", "Jammer")

        track_data = {
            "uri": data.get("track_uri", ""),
            "name": data.get("track_name", ""),
            "artist": data.get("artist", ""),
            "album_art_url": data.get("album_art_url"),
            "duration_ms": data.get("duration_ms", 0),
        }

        try:
            queue, next_item = await asyncio.to_thread(
                _db_add_and_get_queue, room_id, track_data, user_id, display_name
            )
            logger.info(f"add_to_queue called for room={room_id} user={user_id} track={(track_data.get('name') or '')[:120]} uri={track_data.get('uri')}")
        except ValueError as ve:
            await sio.emit("queue_error", {"message": str(ve)}, to=sid)
            return
        except Exception as e:
            logger.error(f"add_to_queue error: {e}")
            return

        # Auto-play: if a first track was found, emit track_changed and start sync loop
        if next_item:
            logger.info(f"Auto-playing next_item for room={room_id}: {next_item.get('track_name')} ({next_item.get('track_uri')})")
            # Pre-resolve stream URL before emitting so playback starts instantly
            track_uri = next_item.get("track_uri", "")
            if track_uri and len(track_uri) == 11:
                from backend.routes.queue import pre_resolve_url
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
            try:
                queue = await asyncio.to_thread(_db_get_queue_after_next, room_id)
            except Exception:
                pass  # use the queue we already have

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

        # Pre-resolve the next track in queue in background (fire-and-forget)
        if queue and len(queue) > 1:
            next_track_uri = None
            for item in queue:
                if item.get("status") != "playing" and item.get("status") != "played":
                    next_track_uri = item.get("track_uri")
                    break
            if next_track_uri and len(next_track_uri) == 11:
                from backend.routes.queue import pre_resolve_url
                asyncio.create_task(pre_resolve_url(next_track_uri))

    @sio.event
    async def vote_track(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        room_id = data.get("room_id")
        if not room_id:
            info = room_manager.get_user_by_sid(sid)
            if not info:
                return
            room_id = info["room_id"]

        queue_item_id = data.get("queue_item_id")
        if not queue_item_id:
            return

        user_id = session.get("user_id") or f"guest_{sid}"

        try:
            queue = await asyncio.to_thread(_db_vote_track, room_id, queue_item_id, user_id)
        except Exception as e:
            logger.error(f"vote_track error: {e}")
            return

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

    @sio.event
    async def remove_from_queue(sid, data):
        """Host-only: remove a pending track from the queue."""
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        # Only host can remove tracks
        if not room_manager.is_host(room_id, sid):
            await sio.emit("queue_error", {"message": "Only the host can remove tracks"}, to=sid)
            return

        queue_item_id = data.get("queue_item_id")
        if not queue_item_id:
            return

        def _db_remove(room_id, queue_item_id):
            from backend.models.queue_item import QueueItem
            db = SessionLocal()
            try:
                item = db.query(QueueItem).filter(
                    QueueItem.id == queue_item_id,
                    QueueItem.room_id == room_id,
                    QueueItem.status == "pending",
                ).first()
                if item:
                    db.delete(item)
                    db.commit()
                return queue_manager.get_queue(db, room_id, None)
            finally:
                db.close()

        try:
            queue = await asyncio.to_thread(_db_remove, room_id, queue_item_id)
        except Exception as e:
            logger.error(f"remove_from_queue error: {e}")
            return

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)
