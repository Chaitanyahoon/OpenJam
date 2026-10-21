"""Room CRUD routes."""

import json
import logging
from fastapi import APIRouter, Request, Depends, HTTPException, Query

logger = logging.getLogger(__name__)
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.room import Room
from backend.models.user import User
from backend.middleware.auth import get_current_user_id, require_auth
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager
from backend.schemas import CreateRoomRequest, RoomListResponse
from backend.limiter import limiter

from backend.constants import is_curated_room

router = APIRouter(prefix="/rooms", tags=["rooms"])


import asyncio

@router.get("", response_model=RoomListResponse)
async def list_rooms(
    request: Request,
    db: Session = Depends(get_db),
    search: str = Query("", min_length=0, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    current_user = get_current_user_id(request, include_name=True)
    current_user_id = current_user["id"] if current_user else None

    def _db_list_rooms():
        query = db.query(Room).options(selectinload(Room.host)).filter(Room.is_active == True)
        if search:
            escaped_search = search.strip().lower().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
            query = query.filter(Room.name.ilike(f"%{escaped_search}%", escape='\\'))

        rooms = query.order_by(Room.created_at.desc()).all()
        listener_counts = room_manager.get_listener_counts()
        
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)

        now_playing_map = queue_manager.get_now_playing_batch(db, [r.id for r in rooms])
        visible_rooms = []
        for room in rooms:
            count = listener_counts.get(room.id, 0)
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
            is_lounge = is_curated_room(room.id)
            if count == 0 and age_seconds > 30 and not is_my_room and not is_lounge:
                continue
                
            host_name = room.host.display_name if room.host else "Unknown"
            now_playing = now_playing_map.get(room.id)
            visible_rooms.append(room.to_dict(
                listener_count=count,
                current_track=now_playing,
                host_name=host_name,
            ))
        # Pin openjam-lounge at the top, then sort by listener_count desc
        visible_rooms.sort(key=lambda r: (1 if is_curated_room(r["id"]) else 0, r["listener_count"]), reverse=True)
        total = len(visible_rooms)
        return {"rooms": visible_rooms[skip:skip + limit], "total": total}

    return await asyncio.to_thread(_db_list_rooms)


def _hash_password(raw_password: str) -> str:
    import bcrypt
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.post("")
@limiter.limit("10/minute")
async def create_room(request: Request, create_room_req: CreateRoomRequest, db: Session = Depends(get_db)):
    """Create a new room. Upserts a lightweight User record for the host."""
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user_data["id"]
    display_name = user_data["display_name"]

    password_hash = None
    is_private = bool(create_room_req.is_private)
    if create_room_req.password and create_room_req.password.strip():
        password_hash = await asyncio.to_thread(_hash_password, create_room_req.password.strip())
        is_private = True

    def _db_create_room():
        # Clean up ghost rooms: deactivate any of this user's rooms with 0 listeners
        listener_counts = room_manager.get_listener_counts()
        user_rooms = db.query(Room).filter(Room.host_user_id == user_id, Room.is_active == True).all()
        for r in user_rooms:
            if is_curated_room(r.id):
                continue
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

        room = Room(
            name=create_room_req.name,
            host_user_id=user_id,
            genre_tags=json.dumps(create_room_req.genre_tags),
            description=create_room_req.description,
            queue_mode=create_room_req.queue_mode,
            password_hash=password_hash,
            is_private=is_private,
            allow_guest_controls=create_room_req.allow_guest_controls,
        )
        import time
        from sqlalchemy.exc import IntegrityError
        from backend.models.room import generate_room_slug

        committed = False
        for attempt in range(5):
            while db.query(Room).filter(Room.slug == room.slug).first():
                room.slug = generate_room_slug(create_room_req.name)
            try:
                db.add(room)
                db.commit()
                db.refresh(room)
                committed = True
                break
            except IntegrityError:
                db.rollback()
                room.slug = generate_room_slug(create_room_req.name)

        if not committed:
            ts_hex = hex(int(time.time() * 1000))[2:][-6:]
            room.slug = f"{generate_room_slug(create_room_req.name)}-{ts_hex}"
            db.add(room)
            db.commit()
            db.refresh(room)

        return room.to_dict(host_name=display_name, host_avatar_url=user_data.get("avatar_url"))

    room_dict = await asyncio.to_thread(_db_create_room)
    
    if not is_private and room_dict.get("id"):
        async def _notify_indexnow_bg(room_id: str):
            try:
                import httpx
                INDEXNOW_KEY = "5a8e2b9c7d1f4e3a8b6c0d2e1f4a7b9c"
                HOST = "www.openjam.fun"
                payload = {
                    "host": HOST,
                    "key": INDEXNOW_KEY,
                    "keyLocation": f"https://{HOST}/{INDEXNOW_KEY}.txt",
                    "urlList": [f"https://{HOST}/room/{room_id}"]
                }
                async with httpx.AsyncClient(timeout=4.0) as client:
                    await client.post(
                        "https://api.indexnow.org/indexnow",
                        json=payload,
                        headers={"Content-Type": "application/json; charset=utf-8"}
                    )
                    logger.info(f"IndexNow pinged for public room {room_id}")
            except Exception as e:
                logger.debug(f"IndexNow notification failed: {e}")
        
        asyncio.create_task(_notify_indexnow_bg(room_dict["id"]))

    return {"room": room_dict}
def check_room_access(room: Room, user_id: str | None, is_admin: bool = False) -> bool:
    """Check if user_id is authorized to access/modify private room details.
    
    A user is authorized if they are:
    1. A platform admin (is_admin=True), OR
    2. The host of the room, OR
    3. Currently listed in the room state AND their socket SID is still alive
       (prevents stale/ghost entries from granting access).
    """
    if is_admin:
        return True
    if not room.is_private or not room.password_hash:
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
    room = db.query(Room).options(selectinload(Room.host)).filter((Room.id == room_id) | (Room.slug == room_id)).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    host_name = room.host.display_name if room.host else "Unknown"
    current_user = get_current_user_id(request, include_name=True)
    current_user_id = current_user["id"] if current_user else None
    is_admin = bool(current_user and current_user.get("is_admin"))
    if not is_admin and current_user_id:
        db_u = db.query(User).filter(User.id == current_user_id).first()
        if db_u and db_u.is_admin:
            is_admin = True

    canonical_id = room.id
    if room.is_private and room.password_hash and not check_room_access(room, current_user_id, is_admin=is_admin):
        return {
            "room": {
                "id": room.id,
                "slug": room.slug or room.id,
                "name": room.name,
                "is_private": True,
                "host_name": host_name,
                "host_user_id": room.host_user_id,
            },
            "queue": [],
            "listeners": [],
            "password_required": True,
        }

    now_playing = queue_manager.get_now_playing(db, canonical_id)
    queue = queue_manager.get_queue(db, canonical_id, current_user_id)
    listeners = room_manager.get_listeners(canonical_id)
    return {
        "room": room.to_dict(
            listener_count=room_manager.get_listener_count(canonical_id),
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
    room = db.query(Room).filter((Room.id == room_id) | (Room.slug == room_id)).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.host_user_id != user_data["id"] and not user_data.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only the host can close the room")
    canonical_id = room.id
    room.is_active = False
    db.commit()

    # Emit room_closed socket event to notify other room members instantly
    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("room_closed", {
            "room_id": canonical_id,
            "reason": "Host closed the room",
        }, room=canonical_id)
        if room.slug and room.slug != canonical_id:
            await sio.emit("room_closed", {
                "room_id": canonical_id,
                "reason": "Host closed the room",
            }, room=room.slug)

    # Force-clean in-memory room state to prevent orphaned sync loops and stale data
    from backend.sockets.playback import stop_sync_loop
    from backend.services.room_closer import cancel_room_close
    stop_sync_loop(canonical_id)
    cancel_room_close(canonical_id)
    room_manager.force_close_room(canonical_id)

    return {"message": "Room closed"}


@router.patch("/{room_id}")
async def update_room(room_id: str, request: Request, db: Session = Depends(get_db)):
    """Allow host to update room details (name, genre_tags, description, allow_guest_controls) live."""
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        raise HTTPException(status_code=401, detail="Authentication required")
    room = db.query(Room).filter((Room.id == room_id) | (Room.slug == room_id), Room.is_active == True).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    canonical_id = room.id
    if room.host_user_id != user_data["id"]:
        raise HTTPException(status_code=403, detail="Only the host can edit room settings")

    try:
        body = await request.json()
    except Exception:
        body = {}

    if "name" in body and body["name"]:
        clean_name = str(body["name"]).strip()
        if clean_name:
            room.name = clean_name[:100]

    if "description" in body and body["description"] is not None:
        room.description = str(body["description"]).strip()[:500]

    if "genre_tags" in body and isinstance(body["genre_tags"], list):
        clean_tags = [str(t).strip().lower() for t in body["genre_tags"] if t][:5]
        room.genre_tags = json.dumps(clean_tags)

    if "allow_guest_controls" in body:
        allow = bool(body["allow_guest_controls"])
        room.allow_guest_controls = allow
        room_manager.set_guest_controls(canonical_id, allow)

    db.commit()
    db.refresh(room)

    updated_dict = room.to_dict(
        listener_count=room_manager.get_listener_count(canonical_id),
        host_name=user_data["display_name"],
    )

    sio = getattr(request.app.state, "sio", None)
    if sio:
        await sio.emit("room_updated", updated_dict, room=canonical_id)
        if room.slug and room.slug != canonical_id:
            await sio.emit("room_updated", updated_dict, room=room.slug)
        if "allow_guest_controls" in body:
            await sio.emit("guest_controls_updated", {"allow_guest_controls": room.allow_guest_controls}, room=canonical_id)
            if room.slug and room.slug != canonical_id:
                await sio.emit("guest_controls_updated", {"allow_guest_controls": room.allow_guest_controls}, room=room.slug)

    return {"room": updated_dict}
