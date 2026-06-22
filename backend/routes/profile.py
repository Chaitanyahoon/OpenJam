from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.playlist import Playlist
from backend.models.like import UserLike
from backend.middleware.auth import require_registered_user, get_current_user_id
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/profile", tags=["profile"])


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    profile_theme: Optional[str] = Field("amber", pattern="^(amber|cobalt|rose|emerald|violet)$")


@router.get("/me")
async def get_my_profile(db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Retrieve full profile details, playlists, and liked songs for the signed-in user."""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).order_by(Playlist.created_at.desc()).all()
    likes = db.query(UserLike).filter(UserLike.user_id == user_id).order_by(UserLike.created_at.desc()).all()
    
    return {
        "user": user.to_dict(),
        "playlists": [p.to_dict() for p in playlists],
        "likes": [l.to_dict() for l in likes]
    }


@router.put("/me")
async def update_my_profile(
    update_req: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Update user profile (display name and theme)."""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    user.display_name = update_req.display_name
    if update_req.profile_theme:
        user.profile_theme = update_req.profile_theme
    db.commit()
    db.refresh(user)
    
    return {"message": "Profile updated successfully", "user": user.to_dict()}


@router.get("/search")
async def search_profiles(q: str, db: Session = Depends(get_db)):
    """Search registered users by display name or Discord username."""
    if not q or len(q.strip()) < 2:
        return {"users": []}
    query_str = f"%{q.strip()}%"
    users = db.query(User).filter(
        User.discord_id.isnot(None),
        (User.display_name.ilike(query_str)) | 
        (User.discord_username.ilike(query_str))
    ).limit(10).all()
    
    return {
        "users": [
            {
                "id": u.id,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "discord_username": u.discord_username,
                "created_at": u.created_at.isoformat() if u.created_at else None
            } for u in users
        ]
    }


@router.get("/{user_id}")
async def get_public_profile(user_id: str, db: Session = Depends(get_db)):
    """Retrieve public profile info and public playlists of another user."""
    user = db.query(User).filter(User.id == user_id, User.discord_id.isnot(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Only expose public playlists
    playlists = db.query(Playlist).filter(
        Playlist.creator_id == user_id,
        Playlist.is_private == False
    ).order_by(Playlist.created_at.desc()).all()
    
    return {
        "user": {
            "id": user.id,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "playlists": [p.to_dict() for p in playlists]
    }


def get_user_stats_internal(db: Session, user_id: str):
    from sqlalchemy import func, desc
    from backend.models.queue_item import QueueItem
    from backend.models.like import UserLike
    from backend.models.playlist import Playlist
    from backend.models.chat_message import ChatMessage
    from backend.models.vote import Vote
    from backend.models.room import Room
    import json

    # 1. Base counts
    total_queued = db.query(QueueItem).filter(QueueItem.added_by_user_id == user_id).count()
    total_likes = db.query(UserLike).filter(UserLike.user_id == user_id).count()
    total_playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).count()
    total_chats = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).count()
    total_votes = db.query(Vote).filter(Vote.user_id == user_id).count()

    # 2. Total listening time (for songs added by this user that reached status='played')
    total_duration_ms = db.query(
        func.sum(QueueItem.duration_ms)
    ).filter(
        QueueItem.added_by_user_id == user_id,
        QueueItem.status == "played"
    ).scalar() or 0
    listening_time_mins = int(total_duration_ms // 60000)

    # 3. Top 5 tracks queued
    top_tracks_query = db.query(
        QueueItem.track_name,
        QueueItem.artist,
        QueueItem.album_art_url,
        func.count(QueueItem.id).label('cnt')
    ).filter(
        QueueItem.added_by_user_id == user_id
    ).group_by(
        QueueItem.track_name,
        QueueItem.artist,
        QueueItem.album_art_url
    ).order_by(
        desc('cnt')
    ).limit(5).all()

    top_tracks = [
        {
            "track_name": row[0],
            "artist": row[1],
            "album_art_url": row[2],
            "count": row[3]
        }
        for row in top_tracks_query
    ]

    # 4. Top 5 artists queued
    top_artists_query = db.query(
        QueueItem.artist,
        func.count(QueueItem.id).label('cnt')
    ).filter(
        QueueItem.added_by_user_id == user_id
    ).group_by(
        QueueItem.artist
    ).order_by(
        desc('cnt')
    ).limit(5).all()

    top_artists = [
        {
            "artist": row[0],
            "count": row[1]
        }
        for row in top_artists_query
    ]

    # 5. Top genres (based on room tags where the user has queued songs)
    rooms_genres = db.query(
        Room.genre_tags,
        func.count(QueueItem.id)
    ).join(
        QueueItem, Room.id == QueueItem.room_id
    ).filter(
        QueueItem.added_by_user_id == user_id
    ).group_by(
        Room.genre_tags
    ).all()

    genre_counts = {}
    for raw_tags, count in rooms_genres:
        if not raw_tags:
            continue
        try:
            tags = json.loads(raw_tags)
            if isinstance(tags, list):
                for tag in tags:
                    tag_clean = tag.strip().lower()
                    if tag_clean:
                        genre_counts[tag_clean] = genre_counts.get(tag_clean, 0) + count
        except Exception:
            pass

    sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_genres = [
        {
            "genre": g,
            "count": c
        }
        for g, c in sorted_genres
    ]

    return {
        "stats": {
            "total_queued": total_queued,
            "total_likes": total_likes,
            "total_playlists": total_playlists,
            "total_chats": total_chats,
            "total_votes": total_votes,
            "listening_time_mins": listening_time_mins,
            "top_tracks": top_tracks,
            "top_artists": top_artists,
            "top_genres": top_genres
        }
    }


@router.get("/me/stats")
async def get_my_stats(db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Retrieve listening statistics and engagement metrics for the authenticated user."""
    return get_user_stats_internal(db, user_id)


@router.get("/{user_id}/stats")
async def get_public_user_stats(user_id: str, db: Session = Depends(get_db)):
    """Retrieve public stats metrics for a specific user ID."""
    user = db.query(User).filter(User.id == user_id, User.discord_id.isnot(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return get_user_stats_internal(db, user_id)
