"""Admin routes for moderation and room management."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.room import Room
from backend.middleware.auth import require_admin
from backend.services.room_manager import room_manager

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/rooms")
async def get_all_rooms(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Get all active rooms, with current listener counts."""
    try:
        rooms = db.query(Room).options(selectinload(Room.host)).filter(Room.is_active == True).order_by(Room.created_at.desc()).all()
        
        redis_rooms = room_manager.store.get_all_rooms()
        
        result = []
        for room in rooms:
            listeners = 0
            if room.id in redis_rooms:
                room_data = redis_rooms[room.id]
                if room_data and "users" in room_data:
                    listeners = len(room_data.get("users", {}) or {})
                
            data = room.to_dict(
                listener_count=listeners,
                host_name=room.host.display_name if room.host else "Unknown"
            )
            result.append(data)
            
        return {"rooms": result}
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return {"error": f"Internal server error: {str(e)}", "traceback": tb}


@router.delete("/rooms")
async def force_delete_all_rooms(
    request: Request,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Force close all active rooms, kick everyone, and clean state."""
    active_rooms = db.query(Room).filter(Room.is_active == True).all()
    if not active_rooms:
        return {"success": True, "message": "No active rooms to close."}
        
    sio = getattr(request.app.state, "sio", None)
    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    
    for room in active_rooms:
        room.is_active = False
        room_id = room.id
        
        # Emit room_closed socket event to notify other room members instantly
        if sio:
            await sio.emit("room_closed", {
                "room_id": room_id,
                "reason": "Room has been closed by administration",
            }, room=room_id)

        # Force-clean state
        stop_sync_loop(room_id)
        cancel_room_close(room_id)
        room_manager.force_close_room(room_id)
        
    db.commit()
    return {"success": True, "message": f"All {len(active_rooms)} active rooms have been closed."}


@router.delete("/rooms/{room_id}")
async def force_delete_room(
    room_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Force close a room, remove it from the database, and kick everyone."""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room.is_active = False
    db.commit()
    
    # Emit room_closed socket event to notify other room members instantly
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("room_closed", {
            "room_id": room_id,
            "reason": "Room has been closed by administration",
        }, room=room_id)

    # Force-clean in-memory room state to prevent orphaned sync loops and stale data
    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    stop_sync_loop(room_id)
    cancel_room_close(room_id)
    room_manager.force_close_room(room_id)
    
    return {"success": True, "message": f"Room {room_id} has been force-closed and deleted."}
