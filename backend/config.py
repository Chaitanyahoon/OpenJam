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
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "openjam-admin-123")

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
        # Auto-append www. versions of custom HTTPS domains to prevent CORS blockages
        extra_origins = []
        for origin in self.ALLOWED_ORIGINS:
            if origin.startswith("https://") and not origin.startswith("https://www."):
                www_version = origin.replace("https://", "https://www.", 1)
                if www_version not in self.ALLOWED_ORIGINS:
                    extra_origins.append(www_version)
        self.ALLOWED_ORIGINS.extend(extra_origins)
        if self.ENVIRONMENT == "development":
            local_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
            try:
                import socket
                hostname = socket.gethostname()
                local_ip = socket.gethostbyname(hostname)
                if local_ip:
                    local_origins.append(f"http://{local_ip}:3000")
            except Exception:
                pass
            for origin in local_origins:
                if origin not in self.ALLOWED_ORIGINS:
                    self.ALLOWED_ORIGINS.append(origin)
        if self.ENVIRONMENT == "production":
            if not self.SECRET_KEY or self.SECRET_KEY == "change-me-in-production":
                raise RuntimeError("SECRET_KEY must be set to a secure value in production")
            if not self.ADMIN_PASSWORD or self.ADMIN_PASSWORD == "openjam-admin-123":
                raise RuntimeError("ADMIN_PASSWORD must be set to a secure custom value in production")

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
