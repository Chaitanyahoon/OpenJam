"""Socket.IO playback synchronization handlers."""

import asyncio
import socketio
import json
import time
from datetime import datetime, timezone
from backend.services.room_manager import room_manager

# Tracks which rooms have an active sync loop
_sync_tasks: dict = {}

# Per-room locks to prevent double-advance race conditions
# (e.g. host 'ended' event + sync loop auto-advance firing simultaneously)
_advance_locks: dict[str, asyncio.Lock] = {}


def _get_advance_lock(room_id: str) -> asyncio.Lock:
    """Get or create the advance lock for a room."""
    if room_id not in _advance_locks:
        _advance_locks[room_id] = asyncio.Lock()
    return _advance_locks[room_id]


def _make_json_safe(data: dict) -> dict:
    """Convert non-JSON-serializable types in data to JSON-safe equivalents."""
    if not isinstance(data, dict):
        return data
    
    safe_data = {}
    for key, value in data.items():
        if isinstance(value, set):
            safe_data[key] = list(value)
        elif isinstance(value, dict):
            safe_data[key] = _make_json_safe(value)
        elif isinstance(value, (list, tuple)):
            safe_data[key] = [_make_json_safe(v) if isinstance(v, dict) else v for v in value]
        else:
            safe_data[key] = value
    return safe_data


async def _do_advance(room_id: str, sio: socketio.AsyncServer):
    """Advance to the next track in the queue. Must be called under _advance_lock."""
    from backend.database import SessionLocal
    from backend.services.queue_manager import queue_manager

    def _advance(rid):
        db = SessionLocal()
        try:
            nxt = queue_manager.advance_queue(db, rid)
            q   = queue_manager.get_queue(db, rid)
            return nxt, q
        finally:
            db.close()

    next_item, queue = await asyncio.to_thread(_advance, room_id)

    if next_item:
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
        ensure_sync_loop(room_id, sio)
        try:
            await sio.emit("track_changed", _make_json_safe(next_item), room=room_id)
        except Exception as e:
            from backend.logger import get_logger
            get_logger(__name__).error(f"Failed to emit track_changed for room {room_id}: {e}")
    else:
        stop_sync_loop(room_id)
        room_manager.update_playback(room_id, "", "", "", "", 0, 0, False)
        try:
            await sio.emit("track_changed", None, room=room_id)
        except Exception as e:
            from backend.logger import get_logger
            get_logger(__name__).error(f"Failed to emit track_changed (none) for room {room_id}: {e}")

    try:
        await sio.emit("queue_updated", {"queue": queue}, room=room_id)
    except Exception as e:
        from backend.logger import get_logger
        get_logger(__name__).error(f"Failed to emit queue_updated for room {room_id}: {e}")

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


async def _playback_sync_loop(room_id: str, sio: socketio.AsyncServer):
    """Broadcast playback state every 2 seconds, using wall-clock for accurate position."""
    last_tick = datetime.now(timezone.utc)

    while True:
        await asyncio.sleep(2)

        # Stop loop if room is empty or no longer exists
        if room_manager.get_listener_count(room_id) == 0:
            from backend.logger import get_logger
            get_logger(__name__).info(f"Sync loop stopping: room {room_id} has 0 listeners")
            stop_sync_loop(room_id)
            return

        playback = room_manager.get_playback(room_id)
        if not playback or not playback.get("track_uri"):
            last_tick = datetime.now(timezone.utc)
            continue
        if not playback.get("is_playing"):
            last_tick = datetime.now(timezone.utc)
            continue

        # Wall-clock delta — accurate even if loop drifts
        now = datetime.now(timezone.utc)
        elapsed_ms = int((now - last_tick).total_seconds() * 1000)
        last_tick = now

        new_pos = min(
            playback.get("position_ms", 0) + elapsed_ms,
            playback.get("duration_ms", 0) or 999_999_999,
        )

        # Auto-advance when track ends
        duration = playback.get("duration_ms", 0)
        if duration and new_pos >= duration - 500:
            lock = _get_advance_lock(room_id)
            if lock.locked():
                # Another advance is already in progress (e.g. host 'ended' event)
                return
            async with lock:
                # Re-check: the track may have already been advanced by the host
                fresh = room_manager.get_playback(room_id)
                if fresh and fresh.get("track_uri") == playback.get("track_uri"):
                    stop_sync_loop(room_id)
                    await _do_advance(room_id, sio)
            return

        # Update server-side position
        room_manager.update_playback(
            room_id=room_id,
            track_uri=playback["track_uri"],
            track_name=playback.get("track_name", ""),
            artist=playback.get("artist", ""),
            album_art_url=playback.get("album_art_url", ""),
            position_ms=new_pos,
            duration_ms=playback.get("duration_ms", 0),
            is_playing=True,
        )

        # Emit to all listeners (including host for UI sync, but host player ignores position)
        updated = room_manager.get_playback(room_id)
        try:
            host_sid = room_manager.get_host_sid(room_id)
            await sio.emit("playback_sync", _make_json_safe(updated), room=room_id, skip_sid=host_sid)
        except Exception as e:
            from backend.logger import get_logger
            logger = get_logger(__name__)
            logger.error(f"Failed to emit playback_sync for room {room_id}: {e}")



def ensure_sync_loop(room_id: str, sio: socketio.AsyncServer):
    if room_id not in _sync_tasks or _sync_tasks[room_id].done():
        _sync_tasks[room_id] = asyncio.create_task(_playback_sync_loop(room_id, sio))


def stop_sync_loop(room_id: str):
    task = _sync_tasks.pop(room_id, None)
    if task and not task.done():
        task.cancel()


def register_playback_handlers(sio: socketio.AsyncServer):
    from backend.logger import get_logger
    logger = get_logger(__name__)

    @sio.event
    async def sync_request(sid, data):
        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]
        playback = room_manager.get_playback(room_id)
        if playback:
            try:
                await sio.emit("playback_sync", _make_json_safe(playback), to=sid)
            except Exception as e:
                logger.error(f"Failed to emit sync_request for {sid}: {e}")

    @sio.event
    async def playback_update(sid, data):
        """Any jam member can update playback state (democratic control)."""
        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        room_manager.update_playback(
            room_id=room_id,
            track_uri=data.get("track_uri", ""),
            track_name=data.get("track_name", ""),
            artist=data.get("artist", ""),
            album_art_url=data.get("album_art_url", ""),
            position_ms=data.get("position_ms", 0),
            duration_ms=data.get("duration_ms", 0),
            is_playing=data.get("is_playing", False),
        )
        if data.get("is_playing"):
            ensure_sync_loop(room_id, sio)
        try:
            await sio.emit("playback_sync", _make_json_safe(room_manager.get_playback(room_id)), room=room_id, skip_sid=sid)
        except Exception as e:
            logger.error(f"Failed to emit playback_update for room {room_id}: {e}")

    @sio.event
    async def vote_skip(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return
        
        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]
        user_id = session.get("user_id") or f"guest_{sid}"

        # If user is host, just execute next_track directly
        if room_manager.is_host(room_id, sid):
            await next_track(sid, data)
            return

        added = room_manager.add_skip_vote(room_id, user_id)
        if added:
            votes = room_manager.get_skip_votes(room_id)
            listeners = room_manager.get_listener_count(room_id)
            if listeners > 0 and (votes / listeners) > 0.5:
                # threshold reached, skip!
                await next_track(sid, {"room_id": room_id})
            else:
                # broadcast vote update
                try:
                    await sio.emit("skip_votes_updated", {"votes": votes, "required": (listeners // 2) + 1}, room=room_id)
                except Exception as e:
                    logger.error(f"Failed to emit skip_votes_updated for room {room_id}: {e}")

    @sio.event
    async def next_track(sid, data):
        """Any jam member can skip to the next track. Guarded by per-room lock."""
        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        lock = _get_advance_lock(room_id)
        async with lock:
            stop_sync_loop(room_id)
            await _do_advance(room_id, sio)
