import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    host_user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    genre_tags = Column(String, default="[]")  # JSON string
    description = Column(Text, default="")
    is_active = Column(Boolean, default=True, index=True)
    queue_mode = Column(String, default="open")  # open or curated
    password_hash = Column(String, nullable=True)
    is_private = Column(Boolean, default=False)
    allow_guest_controls = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Relationships
    host = relationship("User", foreign_keys=[host_user_id])
    room_visits = relationship("UserRoomVisit", backref="room", cascade="all, delete-orphan")
    listening_history = relationship("UserListeningHistory", backref="room")

    def to_dict(self, listener_count=0, current_track=None, host_name=None, host_avatar_url=None):
        import json
        try:
            tags = json.loads(self.genre_tags) if self.genre_tags else []
        except Exception:
            tags = []
            
        from backend.database import safe_isoformat
        created_at_iso = safe_isoformat(self.created_at)

        return {
            "id": self.id,
            "name": self.name,
            "host_user_id": self.host_user_id,
            "host_name": host_name or (self.host.display_name if self.host else "Unknown"),
            "host_avatar_url": host_avatar_url or (self.host.avatar_url if self.host else None),
            "genre_tags": tags,
            "description": self.description,
            "is_active": self.is_active,
            "queue_mode": self.queue_mode,
            "is_private": self.is_private or False,
            "allow_guest_controls": self.allow_guest_controls or False,
            "listener_count": listener_count,
            "current_track": current_track,
            "created_at": created_at_iso,
        }
