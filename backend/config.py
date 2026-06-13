import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class Settings:
    """Application configuration."""

    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()

    # Database
    @staticmethod
    def default_database_url() -> str:
        if os.name == "nt":
            base = Path(os.getenv("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
            db_path = base / "OpenJam" / "openjam.db"
            return f"sqlite:///{db_path.as_posix()}"
        return "sqlite:///./data/openjam.db"

    DATABASE_URL: str = os.getenv("DATABASE_URL") or default_database_url.__func__()

    # Redis state store
    REDIS_URL: str = os.getenv("REDIS_URL")

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production")

    # CORS configuration
    ALLOWED_ORIGINS: list = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://localhost:8000",
    )

    def __init__(self):
        self.ALLOWED_ORIGINS = [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]
        if self.ENVIRONMENT == "production" and (
            not self.SECRET_KEY or self.SECRET_KEY == "change-me-in-production"
        ):
            raise RuntimeError("SECRET_KEY must be set to a secure value in production")

    # Token revocation set (in production, use Redis)
    REVOKED_TOKENS: set = set()

    # Discord OAuth2
    DISCORD_CLIENT_ID: str = os.getenv("DISCORD_CLIENT_ID", "")
    DISCORD_CLIENT_SECRET: str = os.getenv("DISCORD_CLIENT_SECRET", "")
    DISCORD_REDIRECT_URI: str = os.getenv("DISCORD_REDIRECT_URI", "http://localhost:8000/auth/discord/callback")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

    # Note: YouTube API Key is no longer required.
    # Track resolution now uses ytmusicapi (quota-free) and iTunes API.


settings = Settings()
