import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Index
from backend.database import Base


class UserLike(Base):
    __tablename__ = "user_likes"
    __table_args__ = (
        Index("ix_user_likes_user_track", "user_id", "track_uri", unique=True),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    track_uri = Column(String, nullable=False, index=True)
    track_name = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    album_art_url = Column(String, nullable=True)
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        from backend.database import safe_isoformat
        return {
            "id": self.id,
            "user_id": self.user_id,
            "track_uri": self.track_uri,
            "track_name": self.track_name,
            "artist": self.artist,
            "album_art_url": self.album_art_url,
            "duration_ms": self.duration_ms,
            "created_at": safe_isoformat(self.created_at),
        }
