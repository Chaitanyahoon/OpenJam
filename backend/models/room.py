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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    
    # Relationship to User (eager loading)
    host = relationship("User", foreign_keys=[host_user_id])

    def to_dict(self, listener_count=0, current_track=None, host_name=None):
        import json
        try:
            tags = json.loads(self.genre_tags) if self.genre_tags else []
        except Exception:
            tags = []
            
        created_at_iso = None
        if self.created_at:
            if isinstance(self.created_at, str):
                created_at_iso = self.created_at
            else:
                try:
                    created_at_iso = self.created_at.isoformat()
                except Exception:
                    pass

        return {
            "id": self.id,
            "name": self.name,
            "host_user_id": self.host_user_id,
            "host_name": host_name,
            "genre_tags": tags,
            "description": self.description,
            "is_active": self.is_active,
            "queue_mode": self.queue_mode,
            "listener_count": listener_count,
            "current_track": current_track,
            "created_at": created_at_iso,
        }
