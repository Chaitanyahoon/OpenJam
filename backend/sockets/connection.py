"""Socket.IO connection and room join/leave handlers."""

import asyncio
import socketio
from backend.database import SessionLocal
from backend.logger import get_logger
from backend.models.chat_message import ChatMessage
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager
from backend.services.room_closer import schedule_room_close, cancel_room_close

logger = get_logger(__name__)


def _db_get_join_data(room_id: str) -> tuple:
    """Load chat history + queue on join — runs in thread pool."""
    db = SessionLocal()
    try:
        messages = (
            db.query(ChatMessage)
            .filter(ChatMessage.room_id == room_id)
            .order_by(ChatMessage.timestamp.desc())
            .limit(50)
            .all()
        )
        messages.reverse()
        queue = queue_manager.get_queue(db, room_id)
        return [m.to_dict() for m in messages], queue
    finally:
        db.close()


def register_connection_handlers(sio: socketio.AsyncServer):

    @sio.event
    async def connect(sid, environ, auth=None):
        """Accept any connection. Identify user from signed session token."""
        token = None
        if auth and isinstance(auth, dict):
            token = auth.get("token")
        if not token:
            cookie_header = environ.get("HTTP_COOKIE", "")
            for part in cookie_header.split(";"):
                part = part.strip()
                if part.startswith("session_token="):
                    token = part[len("session_token="):]
                    break

        # Try to decode signed session (anonymous user)
        display_name = None
        user_id = None
        if token:
            from itsdangerous import URLSafeSerializer
            from backend.config import settings
            try:
                data = URLSafeSerializer(settings.SECRET_KEY).loads(token)
                user_id = data.get("user_id")
                display_name = data.get("display_name")
            except Exception:
                pass

        # Fallback: use guest_name from auth payload or generate random
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())
            if auth and isinstance(auth, dict):
                display_name = (auth.get("guest_name") or "").strip() or None
            if not display_name:
                import secrets
                display_name = f"Jammer-{secrets.token_hex(2).upper()}"

        await sio.save_session(sid, {
            "user_id": user_id,
            "display_name": display_name,
            "avatar_url": None,
            "is_guest": True,
        })
        logger.info(f"Connected {sid} as '{display_name}'")

    @sio.event
    async def disconnect(sid):
        info = room_manager.leave_room(sid)
        if info:
            room_id = info["room_id"]
            session = await sio.get_session(sid)
            await sio.emit("user_left", {
                "user_id": info["user_id"],
                "display_name": session.get("display_name", "Jammer") if session else "Jammer",
            }, room=room_id)
            await sio.emit("listener_count", {
                "count": room_manager.get_listener_count(room_id),
            }, room=room_id)
            if room_manager.get_listener_count(room_id) > 0:
                if not room_manager.get_host_sid(room_id):
                    schedule_room_close(room_id, sio, SessionLocal, delay=300)
            else:
                # 10-minute grace when room empties — handles mobile/tab switches & network drops
                schedule_room_close(room_id, sio, SessionLocal, delay=600)

    @sio.event
    async def join_room(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return
        room_id = data.get("room_id")
        if not room_id:
            return

        user_id = session.get("user_id")
        display_name = session.get("display_name", "Jammer")
        avatar_url = data.get("avatar_url") or session.get("avatar_url")

        if data.get("avatar_url"):
            session["avatar_url"] = data.get("avatar_url")
            await sio.save_session(sid, session)

        old_info = room_manager.get_user_by_sid(sid)
        if old_info:
            room_manager.leave_room(sid)
            await sio.leave_room(sid, old_info["room_id"])

        # Check premium status for capacity limit
        is_premium = False
        def _get_user_premium(user_id):
            db = SessionLocal()
            try:
                from backend.models.user import User
                user = db.query(User).filter(User.id == user_id).first()
                return user.is_premium if user else False
            finally:
                db.close()
        is_premium = await asyncio.to_thread(_get_user_premium, user_id)

        error, was_new = room_manager.join_room(room_id, user_id, sid, display_name, avatar_url, is_premium=is_premium)
        if error:
            await sio.emit("join_error", {"message": error}, to=sid)
            return

        # Check if this user is the room host and set host_sid
        def _check_host(room_id, user_id):
            db = SessionLocal()
            try:
                from backend.models.room import Room
                room = db.query(Room).filter(Room.id == room_id).first()
                if room and room.host_user_id == user_id:
                    room_manager.set_host(room_id, sid)
            finally:
                db.close()

        await asyncio.to_thread(_check_host, room_id, user_id)

        await sio.enter_room(sid, room_id)
        cancel_room_close(room_id)

        # Offload blocking DB read to a thread pool — event loop stays free
        messages, queue = await asyncio.to_thread(_db_get_join_data, room_id)

        await sio.emit("chat_history", {"messages": messages}, to=sid)
        await sio.emit("queue_updated", {"queue": queue}, to=sid)

        playback = room_manager.get_playback(room_id)
        if playback and playback.get("track_uri"):
            await sio.emit("playback_sync", playback, to=sid)

        if was_new:
            await sio.emit("user_joined", {
                "user_id": user_id,
                "display_name": display_name,
                "avatar_url": avatar_url,
            }, room=room_id)
        await sio.emit("listener_count", {
            "count": room_manager.get_listener_count(room_id),
            "listeners": room_manager.get_listeners(room_id),
        }, room=room_id)

    @sio.event
    async def leave_room(sid, data):
        info = room_manager.leave_room(sid)
        if info:
            room_id = info["room_id"]
            await sio.leave_room(sid, room_id)
            session = await sio.get_session(sid)
            await sio.emit("user_left", {
                "user_id": info["user_id"],
                "display_name": session.get("display_name", "Jammer") if session else "Jammer",
            }, room=room_id)
            await sio.emit("listener_count", {
                "count": room_manager.get_listener_count(room_id),
                "listeners": room_manager.get_listeners(room_id),
            }, room=room_id)

    @sio.event
    async def set_guest_name(sid, data):
        """Allow any user to change their display name live."""
        session = await sio.get_session(sid)
        if not session:
            return

        new_name = (data.get("name") or "").strip()
        if not new_name or len(new_name) > 30:
            await sio.emit("error", {"message": "Name must be 1–30 characters"}, to=sid)
            return

        session["display_name"] = new_name
        await sio.save_session(sid, session)

        user_info = room_manager.get_user_by_sid(sid)
        if user_info:
            room_id = user_info["room_id"]
            room_manager.update_display_name(user_info["user_id"], new_name)
            await sio.emit("listener_count", {
                "count": room_manager.get_listener_count(room_id),
                "listeners": room_manager.get_listeners(room_id),
            }, room=room_id)

        await sio.emit("name_updated", {"display_name": new_name}, to=sid)
        logger.info(f"{sid} renamed to '{new_name}'")

    @sio.event
    async def update_profile(sid, data):
        """Allow user to change display name and avatar URL live."""
        session = await sio.get_session(sid)
        if not session:
            return

        new_name = (data.get("display_name") or "").strip()
        avatar_url = data.get("avatar_url")

        if new_name and 0 < len(new_name) <= 30:
            session["display_name"] = new_name
        
        if avatar_url:
            session["avatar_url"] = avatar_url

        await sio.save_session(sid, session)

        user_info = room_manager.get_user_by_sid(sid)
        if user_info:
            room_id = user_info["room_id"]
            if new_name:
                room_manager.update_display_name(user_info["user_id"], new_name)
            
            # Update live memory in room_manager
            room_manager.update_user_profile(sid, new_name or session["display_name"], session["avatar_url"])

            await sio.emit("listener_count", {
                "count": room_manager.get_listener_count(room_id),
                "listeners": room_manager.get_listeners(room_id),
            }, room=room_id)

        await sio.emit("name_updated", {
            "display_name": session["display_name"],
            "avatar_url": session["avatar_url"]
        }, to=sid)

    @sio.event
    async def heartbeat(sid):
        """Client heartbeat — confirms connection is alive."""
        await sio.emit("heartbeat_ack", {"ts": int(asyncio.get_event_loop().time() * 1000)}, to=sid)
