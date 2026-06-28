import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
from backend.database import Base


class User(Base):
    """Lightweight identity record for room hosting. Anonymous users are not persisted."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    is_premium = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    stripe_customer_id = Column(String, nullable=True)
    discord_id = Column(String, unique=True, nullable=True, index=True)
    discord_username = Column(String, nullable=True)
    profile_theme = Column(String, default="amber", nullable=False)
    bio = Column(String, nullable=True)
    banner_color = Column(String, default="default", nullable=False)
    banner_url = Column(String, nullable=True)
    banner_position = Column(String, default="50%", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "is_premium": self.is_premium,
            "is_admin": self.is_admin,
            "discord_id": self.discord_id,
            "discord_username": self.discord_username,
            "profile_theme": self.profile_theme,
            "bio": self.bio,
            "banner_color": self.banner_color,
            "banner_url": self.banner_url,
            "banner_position": self.banner_position,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

