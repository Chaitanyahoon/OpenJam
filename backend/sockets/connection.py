"""Socket.IO connection and room join/leave handlers."""

import asyncio
import re
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

        if token and token.startswith('"') and token.endswith('"'):
            token = token[1:-1]

        # Try to decode signed session (anonymous user)
        display_name = None
        user_id = None
        avatar_url = None
        if token:
            from itsdangerous import URLSafeTimedSerializer
            from backend.config import settings
            try:
                data = URLSafeTimedSerializer(settings.SECRET_KEY).loads(token, max_age=86400 * 30)
                user_id = data.get("user_id")
                display_name = data.get("display_name")
                avatar_url = data.get("avatar_url")
            except Exception:
                pass

        # Check database if this user exists to get the latest display name and avatar
        if user_id:
            def _get_db_user_profile(uid):
                db = SessionLocal()
                try:
                    from backend.models.user import User
                    u = db.query(User).filter(User.id == uid).first()
                    if u:
                        return {"display_name": u.display_name, "avatar_url": u.avatar_url}
                    return None
                finally:
                    db.close()
            try:
                db_user = await asyncio.to_thread(_get_db_user_profile, user_id)
                if db_user:
                    display_name = db_user["display_name"]
                    avatar_url = db_user["avatar_url"] or avatar_url
            except Exception:
                pass

        # Fallback: use guest_name from auth payload or generate random
        if not user_id:
            import uuid
            user_id = str(uuid.uuid4())
            if auth and isinstance(auth, dict):
                raw_name = (auth.get("guest_name") or "").strip()
                display_name = re.sub(r'<[^>]+>', '', raw_name).strip() or None
            if not display_name:
                import secrets
                display_name = f"Jammer-{secrets.token_hex(2).upper()}"

        await sio.save_session(sid, {
            "user_id": user_id,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "is_guest": True,
        })
        logger.info(f"Connected {sid} as '{display_name}'")

    async def _handle_user_departure(room_id: str, user_id: str, display_name: str, was_host: bool):
        # Emit user_left
        await sio.emit("user_left", {
            "user_id": user_id,
            "display_name": display_name,
        }, room=room_id)
        
        # Emit listener count and updated listeners list
        await sio.emit("listener_count", {
            "count": room_manager.get_listener_count(room_id),
            "listeners": room_manager.get_listeners(room_id),
        }, room=room_id)
        
        if was_host:
            listeners = room_manager.get_listeners(room_id)
            if listeners:
                # Promote the first remaining listener
                new_host = listeners[0]
                new_user_id = new_host["user_id"]
                new_name = new_host["display_name"]
                
                # Retrieve the SID of the new host from the room state
                room_state = room_manager.store.get_room(room_id)
                new_sid = None
                if room_state and "users" in room_state and new_user_id in room_state["users"]:
                    new_sid = room_state["users"][new_user_id].get("sid")
                
                if new_sid:
                    room_manager.set_host(room_id, new_sid)
                
                # Persist ownership change in the database
                def _update_db_host(rid, uid):
                    db = SessionLocal()
                    try:
                        from backend.models.room import Room
                        room = db.query(Room).filter(Room.id == rid).first()
                        if room:
                            room.host_user_id = uid
                            db.commit()
                    finally:
                        db.close()
                await asyncio.to_thread(_update_db_host, room_id, new_user_id)
                
                # Cancel pending room closes since a new host successfully took over
                cancel_room_close(room_id)
                
                # Notify all listeners of the new host
                await sio.emit("host_changed", {
                    "host_user_id": new_user_id,
                    "host_name": new_name
                }, room=room_id)
                logger.info(f"Host left room {room_id}. Promoted {new_name} ({new_sid}) to host.")
            else:
                # No one left in the room, schedule close
                schedule_room_close(room_id, sio, SessionLocal, delay=600)
        else:
            # Non-host departed. If room is now empty, schedule close
            if room_manager.get_listener_count(room_id) == 0:
                schedule_room_close(room_id, sio, SessionLocal, delay=600)
        
        # Re-evaluate skip votes dynamically (since listener count decreased)
        if room_manager.get_listener_count(room_id) > 0:
            from backend.sockets.playback import evaluate_skip_votes
            await evaluate_skip_votes(room_id, sio)

    @sio.event
    async def disconnect(sid):
        info = room_manager.get_user_by_sid(sid)
        if info:
            room_id = info["room_id"]
            user_id = info["user_id"]
            was_host = room_manager.is_host(room_id, sid)
            session = await sio.get_session(sid)
            display_name = session.get("display_name", "Jammer") if session else "Jammer"
            
            room_manager.leave_room(sid)
            await _handle_user_departure(room_id, user_id, display_name, was_host)

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

        # Ensure we have the latest display name and avatar from database if the user is registered
        if user_id:
            def _get_db_user_profile(uid):
                db = SessionLocal()
                try:
                    from backend.models.user import User
                    u = db.query(User).filter(User.id == uid).first()
                    if u:
                        return {"display_name": u.display_name, "avatar_url": u.avatar_url}
                    return None
                finally:
                    db.close()
            try:
                db_user = await asyncio.to_thread(_get_db_user_profile, user_id)
                if db_user:
                    display_name = db_user["display_name"]
                    avatar_url = db_user["avatar_url"] or avatar_url
                    # Sync back to socket session so it stays updated
                    session["display_name"] = display_name
                    session["avatar_url"] = avatar_url
                    await sio.save_session(sid, session)
            except Exception:
                pass

        # Check private room password
        def _check_room_password(room_id, user_id, password_input):
            import bcrypt
            import hashlib
            db = SessionLocal()
            try:
                from backend.models.room import Room
                room = db.query(Room).filter(Room.id == room_id).first()
                if not room:
                    return "Room not found"
                if room.is_private:
                    # Host doesn't need to enter the password
                    if room.host_user_id == user_id:
                        return None
                    if not password_input:
                        return "password_required"
                    
                    pw_hash = room.password_hash
                    if pw_hash and (pw_hash.startswith("$2b$") or pw_hash.startswith("$2a$")):
                        try:
                            matched = bcrypt.checkpw(password_input.encode("utf-8"), pw_hash.encode("utf-8"))
                        except Exception:
                            matched = False
                    else:
                        hashed_input = hashlib.sha256(password_input.encode("utf-8")).hexdigest()
                        matched = (hashed_input == pw_hash)

                    if not matched:
                        return "invalid_password"
                return None
            finally:
                db.close()


        password_input = data.get("password")
        password_err = await asyncio.to_thread(_check_room_password, room_id, user_id, password_input)
        if password_err:
            if password_err == "password_required":
                await sio.emit("join_error", {"message": "This room is private. Password required.", "reason": "password_required"}, to=sid)
            elif password_err == "invalid_password":
                await sio.emit("join_error", {"message": "Incorrect password. Please try again.", "reason": "invalid_password"}, to=sid)
            else:
                await sio.emit("join_error", {"message": password_err}, to=sid)
            return

        if data.get("avatar_url"):
            session["avatar_url"] = data.get("avatar_url")
            await sio.save_session(sid, session)

        old_info = room_manager.get_user_by_sid(sid)
        if old_info:
            room_manager.leave_room(sid)
            await sio.leave_room(sid, old_info["room_id"])

        # Check premium and registration status
        def _get_user_status(user_id):
            db = SessionLocal()
            try:
                from backend.models.user import User
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    return user.is_premium, (user.discord_id is not None)
                return False, False
            finally:
                db.close()
        is_premium, is_registered = await asyncio.to_thread(_get_user_status, user_id)

        error, was_new = room_manager.join_room(
            room_id, user_id, sid, display_name, avatar_url,
            is_premium=is_premium, is_registered=is_registered
        )
        if error:
            await sio.emit("join_error", {"message": error}, to=sid)
            return

        # Check if this user is the room host and set host_sid, and reactivate room if inactive
        def _check_host(room_id, user_id):
            db = SessionLocal()
            try:
                from backend.models.room import Room
                room = db.query(Room).filter(Room.id == room_id).first()
                if room:
                    if room.host_user_id == user_id:
                        room_manager.set_host(room_id, sid)
                    if not room.is_active:
                        room.is_active = True
                        db.commit()
                        logger.info(f"Reactivated room {room_id} in database")
            except Exception as e:
                logger.error(f"Error checking host/reactivating room: {e}")
            finally:
                db.close()

        await asyncio.to_thread(_check_host, room_id, user_id)

        await sio.enter_room(sid, room_id)
        cancel_room_close(room_id)

        # Offload blocking DB read to a thread pool — event loop stays free
        try:
            messages, queue = await asyncio.wait_for(
                asyncio.to_thread(_db_get_join_data, room_id),
                timeout=8.0
            )
            await sio.emit("chat_history", {"messages": messages}, to=sid)
            await sio.emit("queue_updated", {"queue": queue}, to=sid)
    
            playback = room_manager.get_playback(room_id)
    
            # Build now_playing from queue
            now_playing_item = None
            for item in queue:
                if item.get("status") == "playing":
                    now_playing_item = item
                    break
    
            join_data = {
                "room_id": room_id,
                "queue": queue,
                "listeners": room_manager.get_listeners(room_id),
            }
            if playback and playback.get("track_uri"):
                join_data["now_playing"] = {
                    "track_uri": playback.get("track_uri"),
                    "track_name": playback.get("track_name"),
                    "artist": playback.get("artist"),
                    "album_art_url": playback.get("album_art_url"),
                    "duration_ms": playback.get("duration_ms", 0),
                }
                import time
                join_data["playback"] = {
                    "positionMs": playback.get("position_ms", 0),
                    "durationMs": playback.get("duration_ms", 0),
                    "isPlaying": playback.get("is_playing", False),
                    "is_buffering": playback.get("is_buffering", False),
                    "server_timestamp": int(time.time() * 1000)
                }
    
            await sio.emit("join_success", join_data, to=sid)
    
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
    
            # Re-evaluate skip votes dynamically (since listener count increased)
            from backend.sockets.playback import evaluate_skip_votes
            await evaluate_skip_votes(room_id, sio)
        except Exception as e:
            logger.error(f"Failed to complete room join for {sid} in {room_id}: {e}")
            await sio.emit("join_error", {"message": "Failed to load room data. Please try again."}, to=sid)
            return

    @sio.event
    async def leave_room(sid, data):
        info = room_manager.get_user_by_sid(sid)
        if info:
            room_id = info["room_id"]
            user_id = info["user_id"]
            was_host = room_manager.is_host(room_id, sid)
            session = await sio.get_session(sid)
            display_name = session.get("display_name", "Jammer") if session else "Jammer"
            
            room_manager.leave_room(sid)
            await sio.leave_room(sid, room_id)
            await _handle_user_departure(room_id, user_id, display_name, was_host)

    @sio.event
    async def set_guest_name(sid, data):
        """Allow any user to change their display name live."""
        session = await sio.get_session(sid)
        if not session:
            return

        new_name = (data.get("name") or "").strip()
        import re
        new_name = re.sub(r'<[^>]+>', '', new_name).strip()
        new_name = re.sub(r'\s+', ' ', new_name)

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
        import re
        if new_name:
            new_name = re.sub(r'<[^>]+>', '', new_name).strip()
            new_name = re.sub(r'\s+', ' ', new_name)

        avatar_url = data.get("avatar_url")

        if new_name and 0 < len(new_name) <= 30:
            session["display_name"] = new_name
        
        if avatar_url:
            from urllib.parse import urlparse
            parsed = urlparse(avatar_url)
            if parsed.scheme in ('http', 'https') and parsed.netloc:
                session["avatar_url"] = avatar_url
            else:
                logger.warning(f"Rejected invalid avatar URL from {sid}: {avatar_url!r}")

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

    @sio.event
    async def sync_ping(sid, data):
        """Receive ping from client containing their t0 timestamp, reply with server timestamps."""
        import time
        t1 = int(time.time() * 1000)
        t0 = data.get("t0") if isinstance(data, dict) else data
        t2 = int(time.time() * 1000)
        await sio.emit("sync_pong", {
            "t0": t0,
            "t1": t1,
            "t2": t2
        }, to=sid)
