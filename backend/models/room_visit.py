import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Index
from backend.database import Base


class UserRoomVisit(Base):
    __tablename__ = "user_room_visits"
    __table_args__ = (
        Index("ix_user_room_visits_user_room", "user_id", "room_id"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def to_dict(self):
        from backend.database import safe_isoformat
        return {
            "id": self.id,
            "user_id": self.user_id,
            "room_id": self.room_id,
            "created_at": safe_isoformat(self.created_at),
        }
