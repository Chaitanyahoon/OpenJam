from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.playlist import Playlist, PlaylistTrack
from backend.middleware.auth import require_registered_user, get_current_user_id
from backend.schemas import CreatePlaylistRequest, PlaylistTrackRequest, BulkTracksRequest

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("")
async def get_my_playlists(request: Request, db: Session = Depends(get_db)):
    """Retrieve all playlists created by the authenticated user."""
    user_id = require_registered_user(request)
    playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).order_by(Playlist.created_at.desc()).all()
    return {"playlists": [playlist.to_dict() for playlist in playlists]}


@router.post("")
async def create_playlist(request: Request, create_req: CreatePlaylistRequest, db: Session = Depends(get_db)):
    """Create a new playlist."""
    user_id = require_registered_user(request)
    
    playlist = Playlist(
        name=create_req.name,
        creator_id=user_id,
        is_private=create_req.is_private
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    
    return {"message": "Playlist created successfully", "playlist": playlist.to_dict()}


@router.get("/{playlist_id}")
async def get_playlist(playlist_id: str, request: Request, db: Session = Depends(get_db)):
    """Retrieve details and tracks of a single playlist."""
    playlist = db.query(Playlist).options(
        selectinload(Playlist.creator),
        selectinload(Playlist.tracks)
    ).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    # Check authorization if private
    current_user_id = get_current_user_id(request)
    if playlist.is_private and playlist.creator_id != current_user_id:
        raise HTTPException(status_code=403, detail="This playlist is private")
        
    return {"playlist": playlist.to_dict(include_tracks=True)}


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: str, request: Request, db: Session = Depends(get_db)):
    """Delete a playlist."""
    user_id = require_registered_user(request)
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")
        
    db.delete(playlist)
    db.commit()
    return {"message": "Playlist deleted successfully"}


@router.post("/{playlist_id}/tracks/bulk")
async def add_multiple_tracks_to_playlist(
    playlist_id: str,
    bulk_req: BulkTracksRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Add multiple tracks to a playlist in bulk."""
    user_id = require_registered_user(request)
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")
        
    current_count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist_id).count()
    
    added_tracks = []
    for idx, track_req in enumerate(bulk_req.tracks):
        track = PlaylistTrack(
            playlist_id=playlist_id,
            track_uri=track_req.track_uri,
            track_name=track_req.track_name,
            artist=track_req.artist,
            album_art_url=track_req.album_art_url,
            duration_ms=track_req.duration_ms,
            position=current_count + idx
        )
        db.add(track)
        added_tracks.append(track)
        
    db.commit()
    
    return {
        "message": f"Successfully added {len(added_tracks)} tracks to playlist",
        "count": len(added_tracks)
    }


@router.post("/{playlist_id}/tracks")
async def add_track_to_playlist(
    playlist_id: str,
    track_req: PlaylistTrackRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Add a track to a playlist."""
    user_id = require_registered_user(request)
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")
        
    # Calculate position (append to the end)
    current_count = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist_id).count()
    
    track = PlaylistTrack(
        playlist_id=playlist_id,
        track_uri=track_req.track_uri,
        track_name=track_req.track_name,
        artist=track_req.artist,
        album_art_url=track_req.album_art_url,
        duration_ms=track_req.duration_ms,
        position=current_count
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    
    return {"message": "Track added to playlist", "track": track.to_dict()}


@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(
    playlist_id: str,
    track_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Remove a track from a playlist and re-order the remaining tracks."""
    user_id = require_registered_user(request)
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")
        
    track = db.query(PlaylistTrack).filter(
        PlaylistTrack.id == track_id,
        PlaylistTrack.playlist_id == playlist_id
    ).first()
    
    if not track:
        raise HTTPException(status_code=404, detail="Track not found in this playlist")
        
    db.delete(track)
    db.commit()
    
    # Re-order the remaining tracks
    remaining_tracks = db.query(PlaylistTrack).filter(
        PlaylistTrack.playlist_id == playlist_id
    ).order_by(PlaylistTrack.position).all()
    
    for idx, t in enumerate(remaining_tracks):
        t.position = idx
        
    db.commit()
    return {"message": "Track removed from playlist and positions re-ordered"}
