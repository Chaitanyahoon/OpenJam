import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from backend.database import Base


class Follow(Base):
    __tablename__ = "user_follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "followed_id", name="uq_follower_followed"),
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    follower_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    followed_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        from backend.database import safe_isoformat
        return {
            "id": self.id,
            "follower_id": self.follower_id,
            "followed_id": self.followed_id,
            "created_at": safe_isoformat(self.created_at)
        }
