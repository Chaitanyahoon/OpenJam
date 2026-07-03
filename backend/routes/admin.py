"""Admin routes for moderation and system management."""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.room import Room
from backend.models.user import User
from backend.models.playlist import Playlist
from backend.models.like import UserLike
from backend.models.chat_message import ChatMessage
from backend.models.vote import Vote
from backend.middleware.auth import require_admin
import logging
from backend.routes.auth import log_auth_event
from backend.services.room_manager import room_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/stats")
async def get_system_stats(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Retrieve quick system metrics and database counts."""
    try:
        user_count = db.query(User).count()
        playlist_count = db.query(Playlist).count()
        
        rooms = db.query(Room).filter(Room.is_active == True).all()
        redis_rooms = room_manager.store.get_all_rooms()
        
        listener_count = 0
        for r in rooms:
            if r.id in redis_rooms:
                room_data = redis_rooms[r.id]
                if room_data and "users" in room_data:
                    listener_count += len(room_data.get("users", {}) or {})
                    
        return {
            "stats": {
                "total_users": user_count,
                "total_playlists": playlist_count,
                "active_rooms": len(rooms),
                "online_listeners": listener_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load stats: {str(e)}")


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
        raise HTTPException(status_code=500, detail=str(e))


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
        
        if sio:
            await sio.emit("room_closed", {
                "room_id": room_id,
                "reason": "Room has been closed by administration",
            }, room=room_id)

        stop_sync_loop(room_id)
        cancel_room_close(room_id)
        room_manager.force_close_room(room_id)
        
    db.commit()
    logger.info(f"Admin '{admin_id}' force-closed all active rooms.")
    log_auth_event(f"Admin '{admin_id}' force-closed all active rooms.")
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
    
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("room_closed", {
            "room_id": room_id,
            "reason": "Room has been closed by administration",
        }, room=room_id)

    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    stop_sync_loop(room_id)
    cancel_room_close(room_id)
    room_manager.force_close_room(room_id)
    
    logger.info(f"Admin '{admin_id}' force-closed room '{room_id}'.")
    log_auth_event(f"Admin '{admin_id}' force-closed room '{room_id}'.")
    return {"success": True, "message": f"Room {room_id} has been force-closed and deleted."}


@router.get("/users")
async def get_all_users(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Retrieve list of all users registered in the system."""
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()
        return {"users": [user.to_dict() for user in users]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/users/{user_id}/premium")
async def toggle_user_premium(
    user_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Toggle premium status for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_premium = not user.is_premium
    db.commit()
    logger.info(f"Admin '{admin_id}' toggled premium status for user '{user_id}' (new premium status: {user.is_premium}).")
    log_auth_event(f"Admin '{admin_id}' toggled premium status for user '{user_id}' (new premium status: {user.is_premium}).")
    return {"success": True, "user": user.to_dict()}


@router.put("/users/{user_id}/admin")
async def toggle_user_admin(
    user_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Toggle administrator status for a user."""
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot revoke your own admin rights.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = not user.is_admin
    db.commit()
    logger.info(f"Admin '{admin_id}' toggled admin status for user '{user_id}' (new admin status: {user.is_admin}).")
    log_auth_event(f"Admin '{admin_id}' toggled admin status for user '{user_id}' (new admin status: {user.is_admin}).")
    return {"success": True, "user": user.to_dict()}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Permanently delete user account and clean up all their related data."""
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Cascade clean room state first
    user_rooms = db.query(Room).filter(Room.host_user_id == user_id).all()
    for room in user_rooms:
        room.is_active = False
        room_manager.force_close_room(room.id)
        db.delete(room)
        
    # Clean likes, chats, votes, playlists
    db.query(UserLike).filter(UserLike.user_id == user_id).delete()
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.query(Vote).filter(Vote.user_id == user_id).delete()
    db.query(Playlist).filter(Playlist.creator_id == user_id).delete()
    
    db.delete(user)
    db.commit()
    logger.info(f"Admin '{admin_id}' permanently deleted user '{user_id}' ({user.display_name}) and all their data.")
    log_auth_event(f"Admin '{admin_id}' permanently deleted user '{user_id}' ({user.display_name}) and all their data.")
    return {"success": True, "message": f"User {user.display_name} and all their data deleted successfully."}


@router.get("/playlists")
async def get_all_playlists(
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Get all playlists in the system with track count."""
    try:
        playlists = db.query(Playlist).options(
            selectinload(Playlist.creator),
            selectinload(Playlist.tracks)
        ).order_by(Playlist.created_at.desc()).all()
        
        from backend.database import safe_isoformat
        result = []
        for pl in playlists:
            result.append({
                "id": pl.id,
                "name": pl.name,
                "creator_name": pl.creator.display_name if pl.creator else "Unknown",
                "is_private": pl.is_private,
                "track_count": len(pl.tracks),
                "created_at": safe_isoformat(pl.created_at)
            })
        return {"playlists": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/playlists/{playlist_id}")
async def delete_playlist_by_admin(
    playlist_id: str,
    db: Session = Depends(get_db),
    admin_id: str = Depends(require_admin)
):
    """Delete a user playlist."""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    db.delete(playlist)
    db.commit()
    logger.info(f"Admin '{admin_id}' deleted playlist '{playlist_id}' ({playlist.name}).")
    log_auth_event(f"Admin '{admin_id}' deleted playlist '{playlist_id}' ({playlist.name}).")
    return {"success": True, "message": "Playlist deleted successfully"}


@router.get("/logs")
async def get_auth_diagnostics_logs(
    admin_id: str = Depends(require_admin)
):
    """Secure endpoint to fetch dynamic authentication diagnostics logs."""
    from backend.routes.auth import auth_logs
    return {"logs": auth_logs}


@router.post("/healthcheck/resolve")
async def trigger_invidious_healthcheck(
    admin_id: str = Depends(require_admin)
):
    """Manually trigger background health check on Invidious/Piped instances."""
    from backend.services.invidious import _health_check_instances_bg
    import asyncio
    asyncio.create_task(_health_check_instances_bg())
    logger.info(f"Admin '{admin_id}' manually triggered background Invidious health check.")
    log_auth_event(f"Admin '{admin_id}' manually triggered background Invidious health check.")
    return {"success": True, "message": "Background healthcheck task started."}
