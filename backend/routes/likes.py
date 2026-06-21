from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models.like import UserLike
from backend.middleware.auth import require_registered_user
from backend.schemas import LikeTrackRequest

router = APIRouter(prefix="/likes", tags=["likes"])


@router.get("")
async def get_likes(request: Request, db: Session = Depends(get_db)):
    """Retrieve all liked tracks of the authenticated user."""
    user_id = require_registered_user(request)
    likes = db.query(UserLike).filter(UserLike.user_id == user_id).order_by(UserLike.created_at.desc()).all()
    return {"likes": [like.to_dict() for like in likes]}


@router.post("")
async def like_track(request: Request, like_req: LikeTrackRequest, db: Session = Depends(get_db)):
    """Like a track. Ensures the track is not already liked by the user."""
    user_id = require_registered_user(request)
    
    # Check if already liked
    existing_like = db.query(UserLike).filter(
        UserLike.user_id == user_id,
        UserLike.track_uri == like_req.track_uri
    ).first()
    
    if existing_like:
        return {"message": "Track already liked", "like": existing_like.to_dict()}
        
    like = UserLike(
        user_id=user_id,
        track_uri=like_req.track_uri,
        track_name=like_req.track_name,
        artist=like_req.artist,
        album_art_url=like_req.album_art_url,
        duration_ms=like_req.duration_ms
    )
    db.add(like)
    db.commit()
    db.refresh(like)
    return {"message": "Track liked successfully", "like": like.to_dict()}


@router.delete("")
async def unlike_track(
    request: Request,
    track_uri: str = Query(..., description="The URI of the track to unlike"),
    db: Session = Depends(get_db)
):
    """Unlike a track by its URI."""
    user_id = require_registered_user(request)
    
    like = db.query(UserLike).filter(
        UserLike.user_id == user_id,
        UserLike.track_uri == track_uri
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Liked track not found")
        
    db.delete(like)
    db.commit()
    return {"message": "Track unliked successfully"}
