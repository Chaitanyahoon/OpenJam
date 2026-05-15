"""Socket.IO chat event handlers — non-blocking DB via asyncio.to_thread()."""

import asyncio
import socketio
from datetime import datetime, timezone
from backend.database import SessionLocal
from backend.models.chat_message import ChatMessage
from backend.models.user import User
from backend.services.room_manager import room_manager


def _db_save_message(room_id: str, user_id: str, display_name: str, avatar_url, content: str) -> dict:
    """Synchronous DB write — runs in a thread pool, never blocks the event loop."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            db.add(User(id=user_id, display_name=display_name, avatar_url=avatar_url))
            db.flush()

        msg = ChatMessage(
            room_id=room_id,
            user_id=user_id,
            user_name=display_name,
            user_avatar=avatar_url,
            content=content,
            timestamp=datetime.now(timezone.utc),
        )
        db.add(msg)
        db.commit()
        db.refresh(msg)
        return msg.to_dict()
    finally:
        db.close()


def register_chat_handlers(sio: socketio.AsyncServer):

    @sio.event
    async def send_chat(sid, data):
        """Frontend emits 'send_chat' with { room_id, message }"""
        session = await sio.get_session(sid)
        if not session:
            return

        # Accept both 'message' (new) and 'content' (legacy)
        content = (data.get("message") or data.get("content") or "").strip()
        if not content or len(content) > 500:
            return

        # Prefer room_id from payload; fall back to room_manager lookup
        room_id = data.get("room_id")
        if not room_id:
            info = room_manager.get_user_by_sid(sid)
            if not info:
                return
            room_id = info["room_id"]

        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name") or data.get("display_name") or "Jammer"
        avatar_url = session.get("avatar_url")

        msg_dict = await asyncio.to_thread(
            _db_save_message, room_id, user_id, display_name, avatar_url, content
        )

        await sio.emit("chat_message", msg_dict, room=room_id)


    @sio.event
    async def chat_message(sid, data):
        """Alias — some older clients emit 'chat_message' directly."""
        await send_chat(sid, data)

    @sio.event
    async def send_reaction(sid, data):
        """Frontend emits 'send_reaction' with { room_id, emoji }"""
        session = await sio.get_session(sid)
        if not session:
            return

        room_id = data.get("room_id")
        emoji = data.get("emoji")
        if not room_id or not emoji:
            return
            
        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name") or data.get("display_name") or "Jammer"

        # Broadcast the reaction to the room
        await sio.emit("reaction", {
            "user_id": user_id,
            "display_name": display_name,
            "emoji": emoji
        }, room=room_id, skip_sid=sid)

    @sio.event
    async def typing(sid, data):
        room_id = data.get("room_id")
        session = await sio.get_session(sid)
        if room_id and session:
            name = session.get("display_name") or "Someone"
            await sio.emit("user_typing", {"display_name": name}, room=room_id, skip_sid=sid)

    @sio.event
    async def stop_typing(sid, data):
        room_id = data.get("room_id")
        session = await sio.get_session(sid)
        if room_id and session:
            name = session.get("display_name") or "Someone"
            await sio.emit("user_stop_typing", {"display_name": name}, room=room_id, skip_sid=sid)
