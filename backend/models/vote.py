import uuid
from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from backend.database import Base


class Vote(Base):
    __tablename__ = "votes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    queue_item_id = Column(String, ForeignKey("queue_items.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)

    __table_args__ = (
        UniqueConstraint("queue_item_id", "user_id", name="uq_vote_user_item"),
    )
