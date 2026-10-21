import uuid
import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, Index
from backend.database import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_events_event_created", "event", "created_at"),
        Index("ix_analytics_events_session", "session_id"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    event = Column(String(64), nullable=False, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    user_id = Column(String, nullable=True, index=True)
    room_id = Column(String, nullable=True, index=True)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        from backend.database import safe_isoformat
        meta = {}
        if self.metadata_json:
            try:
                meta = json.loads(self.metadata_json)
            except Exception:
                meta = {}
        return {
            "id": self.id,
            "event": self.event,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "room_id": self.room_id,
            "metadata": meta,
            "created_at": safe_isoformat(self.created_at),
        }


class Feedback(Base):
    __tablename__ = "feedbacks"
    __table_args__ = (
        Index("ix_feedbacks_rating_created", "rating", "created_at"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    rating = Column(String(32), nullable=False, index=True)  # "great", "meh", "confusing"
    comment = Column(Text, nullable=True)
    session_id = Column(String(64), nullable=True, index=True)
    user_id = Column(String, nullable=True, index=True)
    room_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        from backend.database import safe_isoformat
        return {
            "id": self.id,
            "rating": self.rating,
            "comment": self.comment,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "room_id": self.room_id,
            "created_at": safe_isoformat(self.created_at),
        }
