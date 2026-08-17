import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.user import User
from backend.models.playlist import Playlist, PlaylistLike
from backend.models.like import UserLike
from backend.middleware.auth import require_registered_user, get_current_user_id
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/profile", tags=["profile"])


class UpdateProfileRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    profile_theme: Optional[str] = Field("amber", pattern="^(amber|cobalt|rose|emerald|violet)$")
    bio: Optional[str] = Field(None, max_length=300)
    banner_color: Optional[str] = Field("default", max_length=50)
    banner_url: Optional[str] = Field(None, max_length=1000)
    banner_position: Optional[str] = Field("50%", max_length=10)
    banner_scale: Optional[str] = Field("100%", max_length=10)
    avatar_url: Optional[str] = Field(None, max_length=1000)
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
    """Retrieve full profile details, playlists, saved playlists, and liked songs for the signed-in user."""
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).order_by(Playlist.created_at.desc()).all()
    likes = db.query(UserLike).filter(UserLike.user_id == user_id).order_by(UserLike.created_at.desc()).all()
    
    liked_relations = db.query(PlaylistLike).filter(PlaylistLike.user_id == user_id).all()
    liked_ids = [l.playlist_id for l in liked_relations]
    liked_playlists = db.query(Playlist).filter(
        Playlist.id.in_(liked_ids),
        (Playlist.is_private == False) | (Playlist.creator_id == user_id)
    ).all()
    
    return {
        "user": user.to_dict(),
        "playlists": [p.to_dict() for p in playlists],
        "saved_playlists": [p.to_dict() for p in liked_playlists],
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
        
    # Bio: allow clearing or setting
    if update_req.bio is not None:
        clean_bio = update_req.bio.strip()
        user.bio = clean_bio if clean_bio else None
        
    if update_req.banner_color:
        user.banner_color = update_req.banner_color
        
    # Banner URL: if empty or cleared, set to None so default gradient takes over
    clean_banner = (update_req.banner_url or "").strip()
    user.banner_url = clean_banner if clean_banner else None
    
    if update_req.banner_position is not None:
        user.banner_position = update_req.banner_position
    if update_req.banner_scale is not None:
        user.banner_scale = update_req.banner_scale
        
    if update_req.avatar_url is not None:
        clean_avatar = (update_req.avatar_url or "").strip()
        if clean_avatar:
            user.avatar_url = clean_avatar
        
    if update_req.username is not None:
        new_username = update_req.username.strip().lower()
        if new_username:
            if len(new_username) < 3 or len(new_username) > 20:
                raise HTTPException(status_code=400, detail="Username must be between 3 and 20 characters")
            if not re.match(r"^[a-zA-Z0-9_]+$", new_username):
                raise HTTPException(status_code=400, detail="Username can only contain alphanumeric characters and underscores")
            
            # Check uniqueness
            existing = db.query(User).filter(User.username == new_username, User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username is already taken")
            user.username = new_username
        else:
            user.username = None
        
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
    from datetime import datetime, timezone, timedelta
    import json
    from backend.models.queue_item import QueueItem
    from backend.models.like import UserLike
    from backend.models.playlist import Playlist
    from backend.models.chat_message import ChatMessage
    from backend.models.vote import Vote
    from backend.models.room import Room
    from backend.models.listening_history import UserListeningHistory
    from backend.models.room_visit import UserRoomVisit
    from backend.database import safe_isoformat

    # 1. Base counts
    total_queued = db.query(QueueItem).filter(QueueItem.added_by_user_id == user_id).count()
    total_likes = db.query(UserLike).filter(UserLike.user_id == user_id).count()
    total_playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).count()
    total_chats = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).count()
    total_votes = db.query(Vote).filter(Vote.user_id == user_id).count()
    rooms_hosted = db.query(Room).filter(Room.host_user_id == user_id).count()

    # 2. Total rooms visited (distinct rooms visited + rooms hosted)
    visited_room_ids = {r[0] for r in db.query(UserRoomVisit.room_id).filter(UserRoomVisit.user_id == user_id).all() if r[0]}
    hosted_room_ids = {r[0] for r in db.query(Room.id).filter(Room.host_user_id == user_id).all() if r[0]}
    total_rooms_visited = len(visited_room_ids | hosted_room_ids)

    # 3. Total listening time (incorporating both UserListeningHistory and played QueueItem durations)
    history_duration_ms = db.query(
        func.sum(UserListeningHistory.duration_ms)
    ).filter(
        UserListeningHistory.user_id == user_id
    ).scalar() or 0

    queue_duration_ms = db.query(
        func.sum(QueueItem.duration_ms)
    ).filter(
        QueueItem.added_by_user_id == user_id,
        QueueItem.status == "played"
    ).scalar() or 0

    total_duration_ms = history_duration_ms + queue_duration_ms
    listening_time_mins = int(total_duration_ms // 60000)

    # 4. 7-Day Activity Chart (daily listening minutes time-series)
    now_utc = datetime.now(timezone.utc)
    today_midnight = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    start_cutoff = today_midnight - timedelta(days=6)

    days_map = {}
    chart_days = []
    for i in range(7):
        d = start_cutoff + timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        day_name = d.strftime("%a")
        days_map[d_str] = 0
        chart_days.append((d_str, day_name))

    history_recent = db.query(
        UserListeningHistory.created_at,
        UserListeningHistory.duration_ms
    ).filter(
        UserListeningHistory.user_id == user_id,
        UserListeningHistory.created_at >= start_cutoff
    ).all()

    for created_at, dur in history_recent:
        if created_at:
            d_str = created_at[:10] if isinstance(created_at, str) else created_at.strftime("%Y-%m-%d")
            if d_str in days_map:
                days_map[d_str] += (dur or 0)

    queue_recent = db.query(
        QueueItem.created_at,
        QueueItem.duration_ms
    ).filter(
        QueueItem.added_by_user_id == user_id,
        QueueItem.status == "played",
        QueueItem.created_at >= start_cutoff
    ).all()

    for created_at, dur in queue_recent:
        if created_at:
            d_str = created_at[:10] if isinstance(created_at, str) else created_at.strftime("%Y-%m-%d")
            if d_str in days_map:
                days_map[d_str] += (dur or 0)

    activity_chart = [
        {
            "date": d_str,
            "day": day_name,
            "minutes": int(days_map[d_str] // 60000)
        }
        for d_str, day_name in chart_days
    ]

    # 5. Top 5 tracks (from QueueItem and UserListeningHistory)
    track_counts = {}
    queue_tracks = db.query(
        QueueItem.track_name,
        QueueItem.artist,
        QueueItem.album_art_url,
        func.count(QueueItem.id)
    ).filter(
        QueueItem.added_by_user_id == user_id
    ).group_by(
        QueueItem.track_name,
        QueueItem.artist,
        QueueItem.album_art_url
    ).all()

    for t_name, artist, art, cnt in queue_tracks:
        if t_name and artist:
            key = (t_name, artist, art or "")
            track_counts[key] = track_counts.get(key, 0) + cnt

    history_tracks = db.query(
        UserListeningHistory.track_name,
        UserListeningHistory.artist,
        UserListeningHistory.album_art_url,
        func.count(UserListeningHistory.id)
    ).filter(
        UserListeningHistory.user_id == user_id
    ).group_by(
        UserListeningHistory.track_name,
        UserListeningHistory.artist,
        UserListeningHistory.album_art_url
    ).all()

    for t_name, artist, art, cnt in history_tracks:
        if t_name and artist:
            key = (t_name, artist, art or "")
            track_counts[key] = track_counts.get(key, 0) + cnt

    sorted_tracks = sorted(track_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_tracks = [
        {
            "track_name": k[0],
            "artist": k[1],
            "album_art_url": k[2] if k[2] else None,
            "count": cnt
        }
        for k, cnt in sorted_tracks
    ]

    # 6. Top 5 artists (from QueueItem and UserListeningHistory)
    artist_counts = {}
    queue_artists = db.query(
        QueueItem.artist,
        func.count(QueueItem.id)
    ).filter(
        QueueItem.added_by_user_id == user_id
    ).group_by(
        QueueItem.artist
    ).all()

    for artist, cnt in queue_artists:
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + cnt

    history_artists = db.query(
        UserListeningHistory.artist,
        func.count(UserListeningHistory.id)
    ).filter(
        UserListeningHistory.user_id == user_id
    ).group_by(
        UserListeningHistory.artist
    ).all()

    for artist, cnt in history_artists:
        if artist:
            artist_counts[artist] = artist_counts.get(artist, 0) + cnt

    sorted_artists = sorted(artist_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    top_artists = [
        {
            "artist": artist,
            "count": cnt
        }
        for artist, cnt in sorted_artists
    ]

    # 7. Top genres with percentage distribution
    genre_counts = {}
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

    for raw_tags, count in rooms_genres:
        if not raw_tags:
            continue
        try:
            tags = json.loads(raw_tags)
            if isinstance(tags, list):
                for tag in tags:
                    tag_clean = str(tag).strip().lower()
                    if tag_clean:
                        genre_counts[tag_clean] = genre_counts.get(tag_clean, 0) + count
        except Exception:
            pass

    history_genres = db.query(
        UserListeningHistory.genre,
        func.count(UserListeningHistory.id)
    ).filter(
        UserListeningHistory.user_id == user_id,
        UserListeningHistory.genre.isnot(None)
    ).group_by(
        UserListeningHistory.genre
    ).all()

    for genre, count in history_genres:
        if genre:
            g_clean = str(genre).strip().lower()
            if g_clean:
                genre_counts[g_clean] = genre_counts.get(g_clean, 0) + count

    sorted_genres = sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    total_top_counts = sum(c for _, c in sorted_genres)
    top_genres = [
        {
            "genre": g,
            "count": c,
            "percentage": round((c / total_top_counts) * 100) if total_top_counts > 0 else 0
        }
        for g, c in sorted_genres
    ]

    # 8. Recently played (combined from QueueItem and UserListeningHistory)
    recent_history = db.query(UserListeningHistory).filter(
        UserListeningHistory.user_id == user_id
    ).order_by(UserListeningHistory.created_at.desc()).limit(10).all()

    recent_queue = db.query(QueueItem).filter(
        QueueItem.added_by_user_id == user_id,
        QueueItem.status == "played"
    ).order_by(QueueItem.created_at.desc()).limit(10).all()

    all_recent = []
    for h in recent_history:
        all_recent.append({
            "id": h.id,
            "track_name": h.track_name,
            "artist": h.artist,
            "album_art_url": h.album_art_url,
            "duration_ms": h.duration_ms,
            "played_at": safe_isoformat(h.created_at),
            "_raw_dt": h.created_at
        })
    for q in recent_queue:
        all_recent.append({
            "id": q.id,
            "track_name": q.track_name,
            "artist": q.artist,
            "album_art_url": q.album_art_url,
            "duration_ms": q.duration_ms,
            "played_at": safe_isoformat(q.created_at),
            "_raw_dt": q.created_at
        })

    def _sort_key(item):
        dt = item["_raw_dt"]
        if dt is None:
            return ""
        if isinstance(dt, str):
            return dt
        return dt.isoformat()

    all_recent.sort(key=_sort_key, reverse=True)
    recently_played = [
        {k: v for k, v in item.items() if k != "_raw_dt"}
        for item in all_recent[:10]
    ]

    # 9. Dynamic milestone badges evaluation engine
    milestone_badges = [
        {
            "id": "listener_100",
            "title": "Audiophile Novice",
            "description": "Listen to 100+ minutes of live music",
            "icon": "Headphones",
            "tier": "bronze",
            "category": "listening",
            "unlocked": listening_time_mins >= 100,
            "progress": listening_time_mins,
            "target": 100,
        },
        {
            "id": "listener_500",
            "title": "Sound Voyager",
            "description": "Listen to 500+ minutes of live music",
            "icon": "Radio",
            "tier": "silver",
            "category": "listening",
            "unlocked": listening_time_mins >= 500,
            "progress": listening_time_mins,
            "target": 500,
        },
        {
            "id": "listener_2000",
            "title": "Audiophile Master",
            "description": "Listen to 2,000+ minutes of live music",
            "icon": "Award",
            "tier": "diamond",
            "category": "listening",
            "unlocked": listening_time_mins >= 2000,
            "progress": listening_time_mins,
            "target": 2000,
        },
        {
            "id": "rooms_10",
            "title": "Room Hopper",
            "description": "Explore 10 or more unique Jam Rooms",
            "icon": "Compass",
            "tier": "silver",
            "category": "exploration",
            "unlocked": total_rooms_visited >= 10,
            "progress": total_rooms_visited,
            "target": 10,
        },
        {
            "id": "dj_curator",
            "title": "Vibe Selector",
            "description": "Queue 20 or more songs in live rooms",
            "icon": "Disc",
            "tier": "silver",
            "category": "curation",
            "unlocked": total_queued >= 20,
            "progress": total_queued,
            "target": 20,
        },
        {
            "id": "host_pioneer",
            "title": "Stage Master",
            "description": "Host your own Jam Room session",
            "icon": "Crown",
            "tier": "bronze",
            "category": "hosting",
            "unlocked": rooms_hosted >= 1,
            "progress": rooms_hosted,
            "target": 1,
        },
        {
            "id": "chat_spark",
            "title": "Community Voice",
            "description": "Send 50+ chat messages during live jams",
            "icon": "MessageSquare",
            "tier": "bronze",
            "category": "social",
            "unlocked": total_chats >= 50,
            "progress": total_chats,
            "target": 50,
        },
    ]

    return {
        "stats": {
            "total_queued": total_queued,
            "total_likes": total_likes,
            "total_playlists": total_playlists,
            "total_chats": total_chats,
            "total_votes": total_votes,
            "listening_time_mins": listening_time_mins,
            "total_rooms_visited": total_rooms_visited,
            "rooms_hosted": rooms_hosted,
            "recently_played": recently_played,
            "top_tracks": top_tracks,
            "top_artists": top_artists,
            "top_genres": top_genres,
            "activity_chart": activity_chart,
            "milestone_badges": milestone_badges,
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
