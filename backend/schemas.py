"""Pydantic models for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# ---- Room Models ----
class CreateRoomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Room name")
    description: str = Field("", max_length=500, description="Room description")
    genre_tags: list[str] = Field(default_factory=list, max_length=5, description="Genre tags (max 5)")
    queue_mode: str = Field("open", pattern="^(open|moderated|curated)$", description="Queue mode: open or curated")
    password: Optional[str] = Field(None, max_length=100, description="Optional password for private rooms")
    allow_guest_controls: bool = Field(False, description="Allow guests to control playback (play/pause/skip)")
    
    class Config:
        examples = [{
            "name": "Indie Night",
            "description": "Chill indie vibes",
            "genre_tags": ["indie", "chill"],
            "queue_mode": "open",
            "password": "secretpassword"
        }]


class UpdateRoomRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    genre_tags: Optional[list[str]] = Field(None, max_length=5)
    queue_mode: Optional[str] = Field(None, pattern="^(open|moderated|curated)$")


# ---- Room Models ----
class RoomResponse(BaseModel):
    id: str
    name: str
    description: str
    host_name: str
    host_user_id: str
    listener_count: int
    queue_mode: str
    genre_tags: list[str]
    is_active: bool
    is_private: bool = False
    allow_guest_controls: bool = False
    created_at: datetime
    current_track: Optional[dict] = None
    
    class Config:
        from_attributes = True


class RoomListResponse(BaseModel):
    rooms: list[RoomResponse]
    total: int = 0


class RoomDetailResponse(BaseModel):
    room: RoomResponse
    queue: list[dict]
    listeners: list[dict]


class QueueTrackRequest(BaseModel):
    uri: str = Field(..., min_length=1, max_length=500, description="Playable track lookup query or media URI")
    name: str = Field(..., min_length=1, max_length=255)
    artist: str = Field(..., min_length=1, max_length=255)
    album_art_url: Optional[str] = None
    duration_ms: int = Field(0, ge=0)


class QueueItemRequest(BaseModel):
    track_uri: str = Field(..., min_length=1, max_length=500, description="Playable track lookup query or media URI")
    track_name: str = Field(..., min_length=1, max_length=255)
    artist: str = Field(..., min_length=1, max_length=255)
    album_art_url: Optional[str] = None
    duration_ms: int = Field(0, ge=0)


class QueueItemResponse(BaseModel):
    id: str
    track_uri: str
    track_name: str
    artist: str
    album_art_url: Optional[str]
    duration_ms: int
    added_by: str
    votes: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ---- User Models ----
class UserResponse(BaseModel):
    id: str
    display_name: str
    avatar_url: Optional[str]
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class CurrentUserResponse(BaseModel):
    user: Optional[UserResponse] = None


# ---- Search Models ----
class SearchTracksRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=255)
    limit: int = Field(10, ge=1, le=50)


class TrackResult(BaseModel):
    uri: str
    name: str
    artist: str
    album_art: Optional[str]
    duration_ms: int


class SearchTracksResponse(BaseModel):
    results: list[TrackResult]


# ---- Error Models ----
class ErrorResponse(BaseModel):
    detail: str
    status_code: int


# ---- Like & Playlist Models ----
class LikeTrackRequest(BaseModel):
    track_uri: str = Field(..., min_length=1, max_length=500)
    track_name: str = Field(..., min_length=1, max_length=255)
    artist: str = Field(..., min_length=1, max_length=255)
    album_art_url: Optional[str] = None
    duration_ms: int = Field(0, ge=0)


class CreatePlaylistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_private: Optional[bool] = False
    import_url: Optional[str] = None


class PlaylistTrackRequest(BaseModel):
    track_uri: str = Field(..., min_length=1, max_length=500)
    track_name: str = Field(..., min_length=1, max_length=255)
    artist: str = Field(..., min_length=1, max_length=255)
    album_art_url: Optional[str] = None
    duration_ms: int = Field(0, ge=0)


class BulkTracksRequest(BaseModel):
    tracks: list[PlaylistTrackRequest]

