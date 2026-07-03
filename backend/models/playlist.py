import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.orm import relationship
from backend.database import Base


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    creator_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_private = Column(Boolean, default=False, nullable=False)
    import_url = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)
    auto_sync = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship to user
    creator = relationship("User", foreign_keys=[creator_id])
    # Relationship to tracks
    tracks = relationship("PlaylistTrack", back_populates="playlist", cascade="all, delete-orphan", order_by="PlaylistTrack.position")

    def to_dict(self, include_tracks=False):
        from backend.database import safe_isoformat
        res = {
            "id": self.id,
            "name": self.name,
            "creator_id": self.creator_id,
            "creator_name": self.creator.display_name if self.creator else "Unknown",
            "is_private": self.is_private,
            "import_url": self.import_url,
            "last_synced_at": safe_isoformat(self.last_synced_at),
            "auto_sync": self.auto_sync,
            "created_at": safe_isoformat(self.created_at),
        }
        if include_tracks:
            res["tracks"] = [t.to_dict() for t in self.tracks]
        return res


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    playlist_id = Column(String, ForeignKey("playlists.id", ondelete="CASCADE"), nullable=False, index=True)
    track_uri = Column(String, nullable=False)
    track_name = Column(String, nullable=False)
    artist = Column(String, nullable=False)
    album_art_url = Column(String, nullable=True)
    duration_ms = Column(Integer, default=0)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    playlist = relationship("Playlist", back_populates="tracks")

    def to_dict(self):
        from backend.database import safe_isoformat
        return {
            "id": self.id,
            "playlist_id": self.playlist_id,
            "track_uri": self.track_uri,
            "track_name": self.track_name,
            "artist": self.artist,
            "album_art_url": self.album_art_url,
            "duration_ms": self.duration_ms,
            "position": self.position,
            "created_at": safe_isoformat(self.created_at),
        }
