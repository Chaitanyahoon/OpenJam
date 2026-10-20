import re
import secrets
import unicodedata
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.database import Base


def generate_room_slug(name: str) -> str:
    """Generate a URL-safe, clean alphanumeric slug with short hash from room name."""
    normalized = unicodedata.normalize('NFKD', name or '')
    ascii_text = normalized.encode('ascii', 'ignore').decode('ascii')
    slug_base = re.sub(r'[^a-zA-Z0-9]+', '-', ascii_text).strip('-').lower()
    slug_base = slug_base[:40].strip('-')
    if not slug_base:
        slug_base = "room"
    suffix = secrets.token_hex(2)
    return f"{slug_base}-{suffix}"


class Room(Base):
    __tablename__ = "rooms"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String, unique=True, index=True, nullable=True)
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

    def __init__(self, **kwargs):
        if "slug" not in kwargs or not kwargs["slug"]:
            rid = kwargs.get("id")
            if rid == "openjam-lounge":
                kwargs["slug"] = "openjam-lounge"
            else:
                name = kwargs.get("name", "")
                kwargs["slug"] = generate_room_slug(name)
        super().__init__(**kwargs)

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
            "slug": self.slug or self.id,
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
