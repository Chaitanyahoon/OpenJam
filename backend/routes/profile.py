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
async def get_my_profile(request: Request, db: Session = Depends(get_db)):
    """Retrieve full profile details, playlists, and liked songs for the signed-in user."""
    user_id = require_registered_user(request)
    
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
    db: Session = Depends(get_db)
):
    """Update user profile (display name and theme)."""
    user_id = require_registered_user(request)
    
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
    user = db.query(User).filter(User.id == user_id).first()
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
