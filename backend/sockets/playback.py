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

    # Automatically attach server_timestamp for playback state payloads
    if "position_ms" in safe_data:
        import time
        safe_data["server_timestamp"] = int(time.time() * 1000)

    return safe_data


async def pre_resolve_next_track_background(room_id: str, queue: list, sio: socketio.AsyncServer):
    """Find the immediate next pending track in the queue, resolve its YouTube ID if needed, 
    commit it to the DB, and pre-warm the stream URL."""
    from backend.logger import get_logger
    logger = get_logger(__name__)

    if not queue:
        return

    # Find the first pending track
    next_track = None
    for item in queue:
        if item.get("status") == "pending":
            next_track = item
            break

    if not next_track:
        return

    track_id = next_track.get("id")
    uri = next_track.get("track_uri")
    if not uri:
        return

    # Check if it needs YouTube ID resolution
    is_unresolved = " " in uri or len(uri) != 11
    
    if is_unresolved:
        logger.info(f"Pre-resolving next track query in background: '{uri}' for room {room_id}")
        from backend.services.music_search import music_search_service
        
        # Resolve query to video ID asynchronously
        resolved_id = await music_search_service.resolve_youtube(uri)
        if not resolved_id:
            logger.warning(f"Could not pre-resolve next track query '{uri}'")
            return
            
        # Update database with the resolved ID
        from backend.database import SessionLocal
        from backend.models.queue_item import QueueItem
        from backend.services.queue_manager import queue_manager
        
        db = SessionLocal()
        try:
            item = db.query(QueueItem).filter(QueueItem.id == track_id).first()
            if item and item.status == "pending":
                item.track_uri = resolved_id
                
                # Check if we should also resolve metadata if it is a placeholder
                is_placeholder = item.track_name in ["YouTube Video", "", None, resolved_id] or item.artist in ["YouTube", "Search Query", "", None] or "spotify.com" in str(item.track_name)
                if is_placeholder:
                    metadata = await music_search_service.resolve_youtube_metadata(resolved_id)
                    if metadata:
                        item.track_name = metadata["title"]
                        item.artist = metadata["author"]
                        if metadata.get("thumbnail"):
                            item.album_art_url = metadata["thumbnail"]
                
                db.commit()
                
                # Retrieve updated queue and broadcast
                updated_queue = queue_manager.get_queue(db, room_id)
                await sio.emit("queue_updated", {"queue": updated_queue}, room=room_id)
                uri = resolved_id
        except Exception as e:
            logger.error(f"Error saving pre-resolved track to DB: {e}")
        finally:
            db.close()

    # Pre-resolve the stream URL (this will also trigger caching)
    if uri and len(uri) == 11:
        from backend.routes.queue import pre_resolve_url
        logger.info(f"Pre-resolving stream URL for track {uri} (room {room_id})")
        await pre_resolve_url(uri)


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
            loop=False,
        )
        ensure_sync_loop(room_id, sio)
        try:
            await sio.emit("track_changed", _make_json_safe(next_item), room=room_id)
        except Exception as e:
            from backend.logger import get_logger
            get_logger(__name__).error(f"Failed to emit track_changed for room {room_id}: {e}")
        
        # Broadcast skip votes reset for the new track
        listeners = room_manager.get_listener_count(room_id)
        required = max(1, (listeners + 1) // 2)
        try:
            await sio.emit("skip_votes_updated", {"votes": 0, "required": required}, room=room_id)
        except Exception:
            pass
    else:
        stop_sync_loop(room_id)
        room_manager.update_playback(room_id, "", "", "", "", 0, 0, False, False)
        try:
            await sio.emit("track_changed", None, room=room_id)
        except Exception as e:
            from backend.logger import get_logger
            get_logger(__name__).error(f"Failed to emit track_changed (none) for room {room_id}: {e}")
        
        try:
            await sio.emit("skip_votes_updated", {"votes": 0, "required": 0}, room=room_id)
        except Exception:
            pass

    try:
        await sio.emit("queue_updated", {"queue": queue}, room=room_id)
    except Exception as e:
        from backend.logger import get_logger
        get_logger(__name__).error(f"Failed to emit queue_updated for room {room_id}: {e}")

    # Pre-resolve the next track in queue in background (fire-and-forget)
    asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))



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

        if playback.get("is_buffering"):
            # Emit current state with is_buffering=True so listeners freeze progress
            try:
                host_sid = room_manager.get_host_sid(room_id)
                await sio.emit("playback_sync", _make_json_safe(playback), room=room_id, skip_sid=host_sid)
            except Exception as e:
                from backend.logger import get_logger
                get_logger(__name__).error(f"Failed to emit playback_sync (buffering) for room {room_id}: {e}")
            continue

        duration = playback.get("duration_ms", 0)
        limit = (duration + 8000) if duration else 999_999_999
        new_pos = min(
            playback.get("position_ms", 0) + elapsed_ms,
            limit,
        )


        # Auto-advance when track ends (with an 8-second grace period to let the host client handle it first)
        duration = playback.get("duration_ms", 0)
        if duration and new_pos >= duration + 8000:
            if playback.get("loop"):
                room_manager.update_playback(
                    room_id=room_id,
                    track_uri=playback["track_uri"],
                    track_name=playback.get("track_name", ""),
                    artist=playback.get("artist", ""),
                    album_art_url=playback.get("album_art_url", ""),
                    position_ms=0,
                    duration_ms=duration,
                    is_playing=True,
                    loop=True,
                )
                try:
                    await sio.emit("playback_sync", _make_json_safe(room_manager.get_playback(room_id)), room=room_id)
                except Exception as e:
                    from backend.logger import get_logger
                    get_logger(__name__).error(f"Failed to emit playback_sync on loop for room {room_id}: {e}")
                last_tick = datetime.now(timezone.utc)
                continue

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
            loop=playback.get("loop", False),
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


async def evaluate_skip_votes(room_id: str, sio: socketio.AsyncServer):
    """Evaluate democratic skip voting status in real-time.
    If the threshold is met, skip to the next track. Otherwise, broadcast skip update."""
    from backend.logger import get_logger
    logger = get_logger(__name__)

    votes = room_manager.get_skip_votes(room_id)
    listeners = room_manager.get_listener_count(room_id)
    required = max(1, (listeners + 1) // 2)

    logger.info(f"Evaluating skip votes for room {room_id}: votes={votes}, listeners={listeners}, required={required}")

    if votes >= required:
        # Check if the room has an active playback, if not, nothing to skip
        pb = room_manager.get_playback(room_id)
        if pb and pb.get("track_uri"):
            lock = _get_advance_lock(room_id)
            async with lock:
                stop_sync_loop(room_id)
                await _do_advance(room_id, sio)
    else:
        try:
            await sio.emit("skip_votes_updated", {"votes": votes, "required": required}, room=room_id)
        except Exception as e:
            logger.error(f"Failed to emit skip_votes_updated for room {room_id}: {e}")


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
            loop=data.get("loop", False),
            is_buffering=data.get("is_buffering", False),
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
            await evaluate_skip_votes(room_id, sio)

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

    @sio.event
    async def toggle_repeat(sid, data):
        """Host-only: toggle repeat/loop mode for current room playback."""
        session = await sio.get_session(sid)
        if not session:
            return
        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]
        if not room_manager.is_host(room_id, sid):
            return

        loop = data.get("loop", False)
        
        playback = room_manager.get_playback(room_id)
        if playback:
            room_manager.update_playback(
                room_id=room_id,
                track_uri=playback["track_uri"],
                track_name=playback.get("track_name", ""),
                artist=playback.get("artist", ""),
                album_art_url=playback.get("album_art_url", ""),
                position_ms=playback.get("position_ms", 0),
                duration_ms=playback.get("duration_ms", 0),
                is_playing=playback.get("is_playing", False),
                loop=loop,
                is_buffering=playback.get("is_buffering", False)
            )
            updated = room_manager.get_playback(room_id)
            await sio.emit("playback_sync", _make_json_safe(updated), room=room_id)

