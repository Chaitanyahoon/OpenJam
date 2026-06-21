import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from backend.database import Base


class QueueItem(Base):
    __tablename__ = "queue_items"
    __table_args__ = (
        Index("ix_queue_room_status", "room_id", "status"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    track_uri = Column(String, nullable=False)
    track_name = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    album_art_url = Column(String, nullable=True)
    duration_ms = Column(Integer, default=0)
    added_by_user_id = Column(String, ForeignKey("users.id"), nullable=False)
    added_by_name = Column(String, default="")
    votes = Column(Integer, default=0)
    position = Column(Integer, default=0)
    status = Column(String, default="pending")  # pending, playing, played
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "room_id": self.room_id,
            "track_uri": self.track_uri,
            "track_name": self.track_name,
            "artist": self.artist,
            "album_art_url": self.album_art_url,
            "duration_ms": self.duration_ms,
            "added_by_user_id": self.added_by_user_id,
            "added_by_name": self.added_by_name,
            "votes": self.votes,
            "position": self.position,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "voter_ids": [], # Populated by queue_manager
        }
