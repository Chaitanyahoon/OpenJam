from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, selectinload
from backend.database import get_db
from backend.models.playlist import Playlist, PlaylistTrack, PlaylistLike
from backend.middleware.auth import require_registered_user, get_current_user_id
from backend.schemas import CreatePlaylistRequest, PlaylistTrackRequest, BulkTracksRequest
from backend.services.playlist_importer import import_playlist

router = APIRouter(prefix="/playlists", tags=["playlists"])


@router.get("")
async def get_my_playlists(db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Retrieve all playlists created by the authenticated user."""
    playlists = db.query(Playlist).filter(Playlist.creator_id == user_id).order_by(Playlist.created_at.desc()).all()
    return {"playlists": [playlist.to_dict() for playlist in playlists]}


@router.post("")
async def create_playlist(create_req: CreatePlaylistRequest, db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Create a new playlist."""
    
    playlist = Playlist(
        name=create_req.name,
        creator_id=user_id,
        is_private=create_req.is_private,
        import_url=create_req.import_url
    )
    db.add(playlist)
    db.commit()
    db.refresh(playlist)
    
    return {"message": "Playlist created successfully", "playlist": playlist.to_dict()}


@router.get("/liked")
async def get_liked_playlists(
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Retrieve all playlists liked by the user."""
    likes = db.query(PlaylistLike).filter(PlaylistLike.user_id == user_id).all()
    playlist_ids = [l.playlist_id for l in likes]
    
    playlists = db.query(Playlist).filter(
        Playlist.id.in_(playlist_ids),
        (Playlist.is_private == False) | (Playlist.creator_id == user_id)
    ).all()
    
    return {"playlists": [playlist.to_dict() for playlist in playlists]}


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
async def delete_playlist(playlist_id: str, db: Session = Depends(get_db), user_id: str = Depends(require_registered_user)):
    """Delete a playlist."""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")
        
    db.delete(playlist)
    db.commit()
    return {"message": "Playlist deleted successfully"}


@router.post("/{playlist_id}/tracks/bulk")
async def add_tracks_bulk(
    playlist_id: str,
    bulk_req: BulkTracksRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Add multiple tracks to a playlist in bulk."""
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
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Add a track to a playlist."""
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
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Remove a track from a playlist and re-order the remaining tracks."""
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


from pydantic import BaseModel
from datetime import datetime, timezone

class AutoSyncToggleRequest(BaseModel):
    enabled: bool


@router.post("/{playlist_id}/sync")
async def sync_imported_playlist(
    playlist_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Sync an imported playlist by fetching its external tracks and updating the local copy."""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")

    if not playlist.import_url:
        raise HTTPException(status_code=400, detail="This playlist was not imported from an external source")

    # Fetch tracks using import_playlist
    res = await import_playlist(playlist.import_url)
    external_tracks = res.get("tracks", [])

    # Delete all current tracks
    db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == playlist_id).delete()

    # Add new tracks
    for idx, t in enumerate(external_tracks):
        track_uri = t.get("track_uri") or t.get("uri")
        track_name = t.get("track_name") or t.get("name") or "Unknown Track"
        artist = t.get("artist") or "Unknown Artist"
        album_art_url = t.get("album_art_url") or ""
        duration_ms = t.get("duration_ms") or 0

        new_track = PlaylistTrack(
            playlist_id=playlist_id,
            track_uri=track_uri,
            track_name=track_name,
            artist=artist,
            album_art_url=album_art_url,
            duration_ms=duration_ms,
            position=idx
        )
        db.add(new_track)
        
    playlist.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "message": f"Successfully synced playlist. {len(external_tracks)} tracks updated.",
        "playlist": playlist.to_dict(include_tracks=True)
    }


@router.put("/{playlist_id}/auto-sync")
async def toggle_playlist_auto_sync(
    playlist_id: str,
    req: AutoSyncToggleRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Toggle auto-sync status for a playlist."""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="You do not own this playlist")

    if not playlist.import_url:
        raise HTTPException(status_code=400, detail="This playlist was not imported from an external source")

    playlist.auto_sync = req.enabled
    db.commit()

    return {
        "message": "Auto-sync updated successfully",
        "playlist": playlist.to_dict()
    }


@router.post("/{playlist_id}/like")
async def like_playlist(
    playlist_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Like a playlist."""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    
    # Check if private and not owner
    if playlist.is_private and playlist.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot like a private playlist")
        
    # Check if already liked
    existing = db.query(PlaylistLike).filter(
        PlaylistLike.user_id == user_id,
        PlaylistLike.playlist_id == playlist_id
    ).first()
    
    if existing:
        return {"message": "Playlist already liked", "like": existing.to_dict()}
        
    like = PlaylistLike(user_id=user_id, playlist_id=playlist_id)
    db.add(like)
    db.commit()
    db.refresh(like)
    return {"message": "Playlist liked successfully", "like": like.to_dict()}


@router.delete("/{playlist_id}/like")
async def unlike_playlist(
    playlist_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(require_registered_user)
):
    """Unlike a playlist."""
    like = db.query(PlaylistLike).filter(
        PlaylistLike.user_id == user_id,
        PlaylistLike.playlist_id == playlist_id
    ).first()
    
    if not like:
        raise HTTPException(status_code=404, detail="Like not found")
        
    db.delete(like)
    db.commit()
    return {"message": "Playlist unliked successfully"}
