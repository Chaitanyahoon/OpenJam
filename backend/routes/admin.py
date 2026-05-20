"""Admin routes for moderation and room management."""

from fastapi import APIRouter, Depends, HTTPException
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
    """Get all rooms including inactive ones, with current listener counts."""
    rooms = db.query(Room).options(selectinload(Room.host)).order_by(Room.created_at.desc()).all()
    
    redis_rooms = room_manager.store.get_all_rooms()
    
    result = []
    for room in rooms:
        listeners = 0
        if room.id in redis_rooms:
            listeners = len(redis_rooms[room.id].get("users", {}))
            
        data = room.to_dict(
            listener_count=listeners,
            host_name=room.host.display_name if room.host else "Unknown"
        )
        result.append(data)
        
    return {"rooms": result}


@router.delete("/rooms/{room_id}")
async def force_delete_room(
    room_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Force close a room, remove it from the database, and kick everyone."""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    room.is_active = False
    db.commit()
    
    # Clean up from redis/memory and kick users
    room_manager.force_close_room(room_id)
    
    return {"success": True, "message": f"Room {room_id} has been force-closed and deleted."}
