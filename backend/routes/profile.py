import re
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
    bio: Optional[str] = Field(None, max_length=200)
    banner_color: Optional[str] = Field("default", max_length=50)
    banner_url: Optional[str] = Field(None, max_length=1000)
    banner_position: Optional[str] = Field("50%", max_length=10)
    banner_scale: Optional[str] = Field("100%", max_length=10)
    username: Optional[str] = Field(None, min_length=3, max_length=20, pattern="^[a-zA-Z0-9_]+$")


def resolve_user_id(identifier: str, db: Session) -> str:
    """Resolve a user identifier (UUID or @username/username) to their actual user ID (UUID)."""
    import urllib.parse
    identifier_clean = urllib.parse.unquote(identifier.strip())
    # Check if identifier is already a valid UUID
    if re.match(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", identifier_clean):
        return identifier_clean
        
    # Check username (both with or without @ prefix)
    target_username = identifier_clean[1:].lower() if identifier_clean.startswith("@") else identifier_clean.lower()
    user = db.query(User).filter(User.username == target_username).first()
    if user:
        return user.id
    return identifier_clean


@router.get("/check-username")
async def check_username_availability(q: str, db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Check if a username is available (not taken by anyone else)."""
    q_clean = q.strip().lower()
    if len(q_clean) < 3 or len(q_clean) > 20:
        return {"available": False, "reason": "Username must be 3-20 characters"}
    if not re.match(r"^[a-zA-Z0-9_]+$", q_clean):
        return {"available": False, "reason": "Only letters, numbers, and underscores allowed"}
        
    existing = db.query(User).filter(User.username == q_clean, User.id != user_id).first()
    return {"available": existing is None}


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
    request: Request,
    update_req: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Update user profile (display name, theme, bio, banner color, banner URL, position, scale, and username)."""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    user.display_name = update_req.display_name
    if update_req.profile_theme:
        user.profile_theme = update_req.profile_theme
    if update_req.bio is not None:
        user.bio = update_req.bio
    if update_req.banner_color:
        user.banner_color = update_req.banner_color
    if update_req.banner_url is not None:
        user.banner_url = update_req.banner_url
    if update_req.banner_position is not None:
        user.banner_position = update_req.banner_position
    if update_req.banner_scale is not None:
        user.banner_scale = update_req.banner_scale
        
    if update_req.username is not None:
        new_username = update_req.username.strip().lower()
        if len(new_username) < 3 or len(new_username) > 20:
            raise HTTPException(status_code=400, detail="Username must be between 3 and 20 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", new_username):
            raise HTTPException(status_code=400, detail="Username can only contain alphanumeric characters and underscores")
        
        # Check uniqueness
        existing = db.query(User).filter(User.username == new_username, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username is already taken")
        user.username = new_username
        
    db.commit()
    db.refresh(user)
    
    # Real-time state synchronization: update any active room listener sessions and broadcast
    try:
        from backend.services.room_manager import room_manager
        rooms = room_manager.store.get_all_rooms()
        for room_id, room in rooms.items():
            if "users" in room and user_id in room["users"]:
                room["users"][user_id]["display_name"] = user.display_name
                room["users"][user_id]["avatar_url"] = user.avatar_url
                room_manager.store.set_room(room_id, room)
                
                # Emit updated listeners list to the room
                sio = getattr(request.app.state, "sio", None)
                if sio:
                    await sio.emit("listener_count", {
                        "count": room_manager.get_listener_count(room_id),
                        "listeners": room_manager.get_listeners(room_id),
                    }, room=room_id)
                break
    except Exception:
        pass
    
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
    
    from backend.database import safe_isoformat
    return {
        "users": [
            {
                "id": u.id,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "discord_username": u.discord_username,
                "username": u.username,
                "profile_theme": u.profile_theme or "amber",
                "banner_url": u.banner_url,
                "bio": u.bio,
                "created_at": safe_isoformat(u.created_at)
            } for u in users
        ]
    }


@router.get("/{user_id}")
async def get_public_profile(user_id: str, db: Session = Depends(get_db)):
    """Retrieve public profile info and public playlists of another user."""
    resolved_id = resolve_user_id(user_id, db)
    user = db.query(User).filter(User.id == resolved_id, User.discord_id.isnot(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Only expose public playlists
    playlists = db.query(Playlist).filter(
        Playlist.creator_id == resolved_id,
        Playlist.is_private == False
    ).order_by(Playlist.created_at.desc()).all()
    
    from backend.database import safe_isoformat
    return {
        "user": {
            "id": user.id,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "discord_username": user.discord_username,
            "username": user.username,
            "profile_theme": user.profile_theme,
            "bio": user.bio,
            "banner_color": user.banner_color,
            "banner_url": user.banner_url,
            "banner_position": user.banner_position,
            "banner_scale": user.banner_scale,
            "created_at": safe_isoformat(user.created_at),
        },
        "playlists": [p.to_dict() for p in playlists]
    }


@router.post("/{user_id}/follow")
async def follow_user(user_id: str, db: Session = Depends(get_db), current_user_id: str = Depends(require_registered_user)):
    """Follow a user."""
    from backend.models.follow import Follow
    resolved_id = resolve_user_id(user_id, db)
    if current_user_id == resolved_id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    
    target_user = db.query(User).filter(User.id == resolved_id, User.discord_id.isnot(None)).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    existing_follow = db.query(Follow).filter(Follow.follower_id == current_user_id, Follow.followed_id == resolved_id).first()
    if existing_follow:
        return {"message": "Already following this user"}

    new_follow = Follow(follower_id=current_user_id, followed_id=resolved_id)
    db.add(new_follow)
    db.commit()
    return {"message": "Successfully followed user"}


@router.delete("/{user_id}/follow")
async def unfollow_user(user_id: str, db: Session = Depends(get_db), current_user_id: str = Depends(require_registered_user)):
    """Unfollow a user."""
    from backend.models.follow import Follow
    resolved_id = resolve_user_id(user_id, db)
    follow = db.query(Follow).filter(Follow.follower_id == current_user_id, Follow.followed_id == resolved_id).first()
    if not follow:
        return {"message": "Not following this user"}

    db.delete(follow)
    db.commit()
    return {"message": "Successfully unfollowed user"}


@router.get("/{user_id}/social")
async def get_user_social_details(user_id: str, db: Session = Depends(get_db), current_user_id: Optional[str] = Depends(get_current_user_id)):
    """Get followers and following details for a profile."""
    from backend.models.follow import Follow
    resolved_id = resolve_user_id(user_id, db)
    
    user = db.query(User).filter(User.id == resolved_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    followers_count = db.query(Follow).filter(Follow.followed_id == resolved_id).count()
    following_count = db.query(Follow).filter(Follow.follower_id == resolved_id).count()
    
    is_following = False
    if current_user_id:
        is_following = db.query(Follow).filter(Follow.follower_id == current_user_id, Follow.followed_id == resolved_id).count() > 0

    # Fetch simple details of followers
    followers_query = db.query(User).join(Follow, Follow.follower_id == User.id).filter(Follow.followed_id == resolved_id).limit(50).all()
    following_query = db.query(User).join(Follow, Follow.followed_id == User.id).filter(Follow.follower_id == resolved_id).limit(50).all()

    return {
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
        "followers": [{
            "id": u.id,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "discord_username": u.discord_username,
            "username": u.username
        } for u in followers_query],
        "following": [{
            "id": u.id,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "discord_username": u.discord_username,
            "username": u.username
        } for u in following_query]
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

    # 6. Additional info: rooms hosted and recently played
    rooms_hosted = db.query(Room).filter(Room.host_user_id == user_id).count()

    recent_query = db.query(QueueItem).filter(
        QueueItem.added_by_user_id == user_id,
        QueueItem.status == "played"
    ).order_by(QueueItem.created_at.desc()).limit(10).all()
    
    from backend.database import safe_isoformat
    recently_played = [
        {
            "id": r.id,
            "track_name": r.track_name,
            "artist": r.artist,
            "album_art_url": r.album_art_url,
            "duration_ms": r.duration_ms,
            "played_at": safe_isoformat(r.created_at)
        }
        for r in recent_query
    ]

    return {
        "stats": {
            "total_queued": total_queued,
            "total_likes": total_likes,
            "total_playlists": total_playlists,
            "total_chats": total_chats,
            "total_votes": total_votes,
            "listening_time_mins": listening_time_mins,
            "rooms_hosted": rooms_hosted,
            "recently_played": recently_played,
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
async def get_public_user_stats(
    user_id: str, 
    db: Session = Depends(get_db), 
    current_user_id: str = Depends(require_registered_user)
):
    """Retrieve public stats metrics for a specific user ID, restricted to the owner."""
    resolved_id = resolve_user_id(user_id, db)
    if current_user_id != resolved_id:
        raise HTTPException(status_code=403, detail="Stats are private to the owner")
    user = db.query(User).filter(User.id == resolved_id, User.discord_id.isnot(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return get_user_stats_internal(db, resolved_id)


@router.get("/following/activity")
async def get_following_activity(
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Retrieve real-time room listening activity for users the logged-in user follows."""
    from backend.models.follow import Follow
    from backend.services.room_manager import room_manager
    from backend.models.room import Room
    from backend.models.user import User
    
    # 1. Get user IDs of followed users
    followed_relations = db.query(Follow.followed_id).filter(Follow.follower_id == user_id).all()
    followed_ids = {r[0] for r in followed_relations}
    
    if not followed_ids:
        return {"activities": []}
        
    # 2. Get active rooms from Redis
    active_rooms = room_manager.store.get_all_rooms()
    
    # 3. Scan active rooms for followed users
    activities = []
    for room_id, room_data in active_rooms.items():
        users_in_room = room_data.get("users", {})
        followed_in_room = followed_ids.intersection(users_in_room.keys())
        
        if not followed_in_room:
            continue
            
        # Get room details from DB
        room_db = db.query(Room).filter(Room.id == room_id).first()
        room_name = room_db.name if room_db else "Live Room"
        
        # Get track info
        playback = room_data.get("playback", {})
        current_track = None
        if playback and playback.get("track_name"):
            current_track = {
                "track_uri": playback.get("track_uri"),
                "track_name": playback.get("track_name"),
                "artist": playback.get("artist"),
                "album_art_url": playback.get("album_art_url"),
                "is_playing": playback.get("is_playing", False)
            }
            
        # Add activities for each followed user in this room
        for friend_id in followed_in_room:
            friend = db.query(User).filter(User.id == friend_id).first()
            if not friend:
                continue
            activities.append({
                "friend": friend.to_dict(),
                "room_id": room_id,
                "room_name": room_name,
                "current_track": current_track
            })
            
    return {"activities": activities}
