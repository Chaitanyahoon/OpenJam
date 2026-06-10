"""Room CRUD routes."""

import json
from fastapi import APIRouter, Request, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.room import Room
from backend.models.user import User
from backend.middleware.auth import get_current_user_id, require_auth
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager
from backend.schemas import CreateRoomRequest, RoomListResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("", response_model=RoomListResponse)
async def list_rooms(
    request: Request,
    db: Session = Depends(get_db),
    search: str = Query("", min_length=0, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = db.query(Room).options(selectinload(Room.host)).filter(Room.is_active == True)
    if search:
        query = query.filter(Room.name.ilike(f"%{search.strip().lower()}%"))

    rooms = query.order_by(Room.created_at.desc()).all()

    listener_counts = room_manager.get_listener_counts()
    
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    # Get current user for ghost-room exception
    from backend.middleware.auth import get_current_user_id
    current_user = get_current_user_id(request, include_name=True)
    current_user_id = current_user["id"] if current_user else None

    visible_rooms = []
    for room in rooms:
        count = listener_counts.get(room.id, 0)
        
        # Hide empty rooms unless:
        # 1. They were just created (< 30 seconds ago), OR
        # 2. The current user is the host (prevents ghost room for the creator)
        age_seconds = float('inf')
        if room.created_at:
            try:
                dt = room.created_at
                if isinstance(dt, str):
                    from datetime import datetime
                    dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
                age_seconds = (now - dt.replace(tzinfo=timezone.utc)).total_seconds()
            except Exception:
                pass
        is_my_room = current_user_id and room.host_user_id == current_user_id
        if count == 0 and age_seconds > 30 and not is_my_room:
            continue
            
        host_name = room.host.display_name if room.host else "Unknown"
        now_playing = queue_manager.get_now_playing(db, room.id)
        visible_rooms.append(room.to_dict(
            listener_count=count,
            current_track=now_playing,
            host_name=host_name,
        ))
    visible_rooms.sort(key=lambda r: r["listener_count"], reverse=True)
    total = len(visible_rooms)
    return {"rooms": visible_rooms[skip:skip + limit], "total": total}

@router.post("")
async def create_room(request: Request, create_room_req: CreateRoomRequest, db: Session = Depends(get_db)):
    """Create a new room. Upserts a lightweight User record for the host."""
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user_data["id"]
    display_name = user_data["display_name"]

    # Clean up ghost rooms: deactivate any of this user's rooms with 0 listeners
    listener_counts = room_manager.get_listener_counts()
    user_rooms = db.query(Room).filter(Room.host_user_id == user_id, Room.is_active == True).all()
    for r in user_rooms:
        count = listener_counts.get(r.id, 0)
        if count == 0:
            r.is_active = False

    # Ensure a User row exists so the Room FK is satisfied
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, display_name=display_name, avatar_url=user_data.get("avatar_url"))
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.display_name = display_name
        if user_data.get("avatar_url"):
            user.avatar_url = user_data.get("avatar_url")
        db.commit()
        db.refresh(user)

    import hashlib
    password_hash = None
    is_private = False
    if create_room_req.password:
        password_hash = hashlib.sha256(create_room_req.password.encode("utf-8")).hexdigest()
        is_private = True

    room = Room(
        name=create_room_req.name,
        host_user_id=user_id,
        genre_tags=json.dumps(create_room_req.genre_tags),
        description=create_room_req.description,
        queue_mode=create_room_req.queue_mode,
        password_hash=password_hash,
        is_private=is_private,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    return {"room": room.to_dict(host_name=display_name, host_avatar_url=user_data.get("avatar_url"))}
def check_room_access(room: Room, user_id: str | None) -> bool:
    """Check if user_id is authorized to access/modify private room details.
    
    A user is authorized if they are:
    1. The host of the room, OR
    2. Currently listed in the room state AND their socket SID is still alive
       (prevents stale/ghost entries from granting access).
    """
    if not room.is_private:
        return True
    if not user_id:
        return False
    if room.host_user_id == user_id:
        return True
    room_state = room_manager.store.get_room(room.id)
    if room_state and "users" in room_state and user_id in room_state["users"]:
        # Verify the user has an active socket connection (SID still live)
        user_entry = room_state["users"][user_id]
        sid = user_entry.get("sid") if isinstance(user_entry, dict) else None
        if sid and room_manager.store.get_sid(sid):
            return True
    return False


@router.get("/{room_id}")
async def get_room(room_id: str, request: Request, db: Session = Depends(get_db)):
    room = db.query(Room).options(selectinload(Room.host)).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    host_name = room.host.display_name if room.host else "Unknown"
    current_user = get_current_user_id(request, include_name=True)
    current_user_id = current_user["id"] if current_user else None

    if room.is_private and not check_room_access(room, current_user_id):
        return {
            "room": {
                "id": room.id,
                "name": room.name,
                "is_private": True,
                "host_name": host_name,
                "host_user_id": room.host_user_id,
            },
            "queue": [],
            "listeners": [],
            "password_required": True,
        }

    now_playing = queue_manager.get_now_playing(db, room.id)
    queue = queue_manager.get_queue(db, room.id, current_user_id)
    listeners = room_manager.get_listeners(room_id)
    return {
        "room": room.to_dict(
            listener_count=room_manager.get_listener_count(room_id),
            current_track=now_playing,
            host_name=host_name,
        ),
        "queue": queue,
        "listeners": listeners,
    }



@router.delete("/{room_id}")
async def close_room(room_id: str, request: Request, db: Session = Depends(get_db)):
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host_user_id != user_data["id"]:
        raise HTTPException(status_code=403, detail="Only the host can close the room")
    room.is_active = False
    db.commit()

    # Emit room_closed socket event to notify other room members instantly
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("room_closed", {
            "room_id": room_id,
            "reason": "Host closed the room",
        }, room=room_id)

    # Force-clean in-memory room state to prevent orphaned sync loops and stale data
    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    stop_sync_loop(room_id)
    cancel_room_close(room_id)
    room_manager.force_close_room(room_id)

    return {"message": "Room closed"}
