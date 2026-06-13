"""Auto-close rooms 5 minutes after host disconnects with no takeover."""

import asyncio
from datetime import datetime, timezone

# {room_id: asyncio.Task}
_pending_close: dict = {}


async def _close_room_after_delay(room_id: str, delay: int, sio, db_factory):
    """Wait `delay` seconds then mark room inactive and notify clients."""
    await asyncio.sleep(delay)
    
    # Safety Check: Cancel auto-close if there are active listeners now
    from backend.services.room_manager import room_manager
    if room_manager.get_listener_count(room_id) > 0:
        import logging
        logging.getLogger(__name__).info(f"Aborting auto-close for room {room_id} because it has active listeners.")
        _pending_close.pop(room_id, None)
        return

    # If task wasn't cancelled we close the room
    db = db_factory()
    try:
        from backend.models.room import Room
        room = db.query(Room).filter(Room.id == room_id, Room.is_active == True).first()
        if room:
            room.is_active = False
            db.commit()
            await sio.emit("room_closed", {
                "room_id": room_id,
                "reason": "Host disconnected — room closed automatically",
            }, room=room_id)
            
            # Clean up redis, memory, and sync loops
            from backend.sockets.playback import stop_sync_loop
            from backend.services.room_manager import room_manager
            stop_sync_loop(room_id)
            room_manager.force_close_room(room_id)
    finally:
        db.close()
    _pending_close.pop(room_id, None)


def schedule_room_close(room_id: str, sio, db_factory, delay: int = 300):
    """Schedule auto-close. Cancels any existing timer for the same room."""
    cancel_room_close(room_id)
    task = asyncio.create_task(
        _close_room_after_delay(room_id, delay, sio, db_factory)
    )
    _pending_close[room_id] = task


def cancel_room_close(room_id: str):
    """Cancel a pending auto-close (e.g. new host took over or host rejoined)."""
    existing = _pending_close.pop(room_id, None)
    if existing and not existing.done():
        existing.cancel()
