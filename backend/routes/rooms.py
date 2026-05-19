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
    result = []
    
    # Current time for checking new empty rooms 
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    
    visible_rooms = []
    for room in rooms:
        count = listener_counts.get(room.id, 0)
        
        # Hide empty rooms unless they were just created (< 30 minutes ago) 
        # to prevent ghost rooms from showing up on the home page while pending deletion
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
        # Hide empty rooms after 30s to save resources. Room closer auto-deactivates them.
        if count == 0 and age_seconds > 30:
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

import time as _time

# Per-user room creation rate limit: {user_id: last_create_timestamp}
_room_create_times: dict = {}
_ROOM_CREATE_COOLDOWN = 120  # 2 minutes between room creations


@router.post("")
async def create_room(request: Request, create_room_req: CreateRoomRequest, db: Session = Depends(get_db)):
    """Create a new room. Upserts a lightweight User record for the host."""
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user_data["id"]
    display_name = user_data["display_name"]

    # Rate limit: 1 room per 2 minutes per user
    now = _time.time()
    last_create = _room_create_times.get(user_id, 0)
    if now - last_create < _ROOM_CREATE_COOLDOWN:
        remaining = int(_ROOM_CREATE_COOLDOWN - (now - last_create))
        raise HTTPException(status_code=429, detail=f"Please wait {remaining}s before creating another room")

    # Clean up ghost rooms: deactivate any of this user's rooms with 0 listeners
    listener_counts = room_manager.get_listener_counts()
    user_rooms = db.query(Room).filter(Room.host_user_id == user_id, Room.is_active == True).all()
    for r in user_rooms:
        if listener_counts.get(r.id, 0) == 0:
            r.is_active = False
    db.commit()

    # Cap: max 3 active rooms per user
    active_count = db.query(Room).filter(Room.host_user_id == user_id, Room.is_active == True).count()
    if active_count >= 3:
        raise HTTPException(status_code=429, detail="You already have 3 active rooms. Close one first.")

    # Ensure a User row exists so the Room FK is satisfied
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id, display_name=display_name)
        db.add(user)
        db.commit()
        db.refresh(user)

    room = Room(
        name=create_room_req.name,
        host_user_id=user_id,
        genre_tags=json.dumps(create_room_req.genre_tags),
        description=create_room_req.description,
        queue_mode=create_room_req.queue_mode,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    _room_create_times[user_id] = now

    return {"room": room.to_dict(host_name=display_name)}


@router.get("/{room_id}")
async def get_room(room_id: str, request: Request, db: Session = Depends(get_db)):
    room = db.query(Room).options(selectinload(Room.host)).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    host_name = room.host.display_name if room.host else "Unknown"
    now_playing = queue_manager.get_now_playing(db, room.id)
    current_user = get_current_user_id(request, include_name=True)
    current_user_id = current_user["id"] if current_user else None
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

    # Force-clean in-memory room state to prevent orphaned sync loops and stale data
    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    stop_sync_loop(room_id)
    cancel_room_close(room_id)
    room_manager.force_close_room(room_id)

    return {"message": "Room closed"}
