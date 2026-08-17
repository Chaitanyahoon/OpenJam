"""Open Jam — Main application entry point."""

import logging
import os
import time
from contextlib import asynccontextmanager
import socketio
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.config import settings
from backend.database import init_db, get_db
from backend.logger import setup_logging, get_logger
from backend.routes.auth import router as auth_router
from backend.routes.rooms import router as rooms_router
from backend.routes.queue import router as queue_router
from backend.routes.admin import router as admin_router
from backend.routes.likes import router as likes_router
from backend.routes.playlists import router as playlists_router
from backend.routes.profile import router as profile_router
from backend.routes.proxy import router as proxy_router
from backend.sockets.connection import register_connection_handlers
from backend.sockets.chat import register_chat_handlers
from backend.sockets.playback import register_playback_handlers
from backend.sockets.queue import register_queue_handlers
from backend.sockets.trivia import register_trivia_handlers

# Initialize logging
setup_logging()
logger = get_logger(__name__)

# Track when the app started (to detect cold starts)
_start_time = time.time()

# Sentry error tracking (free tier: 5k errors/month)
sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
            environment=settings.ENVIRONMENT,
        )
        logger.info("Sentry initialized")
    except ImportError:
        logger.warning("sentry-sdk not installed, error tracking disabled")

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

# Setup Socket.io manager for scaling if Redis is configured (free-tier safe fallback)
sio_mgr = None
if settings.REDIS_URL:
    try:
        sio_mgr = socketio.AsyncRedisManager(settings.REDIS_URL)
        logger.info("Socket.io initialized with AsyncRedisManager for scaling")
    except Exception as e:
        logger.error(f"Failed to initialize Socket.io Redis manager: {e}")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" if settings.ENVIRONMENT == "development" else settings.ALLOWED_ORIGINS,
    client_manager=sio_mgr,
    logger=False,
    engineio_logger=False,
)

app = FastAPI(title="Open Jam", version="1.0.0")
app.state.limiter = limiter
app.state.sio = sio
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(404)
async def custom_404_handler(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
app.include_router(auth_router)
app.include_router(rooms_router)
app.include_router(queue_router)
app.include_router(admin_router)
app.include_router(likes_router)
app.include_router(playlists_router)
app.include_router(profile_router)
app.include_router(proxy_router)

register_connection_handlers(sio)
register_chat_handlers(sio)
register_playback_handlers(sio)
register_queue_handlers(sio)
register_trivia_handlers(sio)

socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")


async def _room_cleanup_loop():
    """Background task to periodically clean up empty rooms."""
    from backend.database import SessionLocal
    from backend.models.room import Room
    from backend.services.room_manager import room_manager
    from datetime import datetime, timezone
    import time
    import asyncio
    
    while True:
        try:
            await asyncio.sleep(30)
            now_unix = time.time()
            now_dt = datetime.now(timezone.utc)
            
            rooms_to_delete = []
            
            db = SessionLocal()
            try:
                # Query all active rooms directly from DB to find ghosts
                active_db_rooms = db.query(Room).filter(Room.is_active == True).all()
                for r in active_db_rooms:
                    room_data = room_manager.store.get_room(r.id)
                    if not room_data:
                        # Room is active in DB but doesn't exist in Redis
                        # Calculate age — always treat naive datetimes as UTC
                        r_created_at = r.created_at
                        if r_created_at:
                            if r_created_at.tzinfo is None:
                                r_created_at = r_created_at.replace(tzinfo=timezone.utc)
                            age_seconds = (now_dt - r_created_at).total_seconds()
                        else:
                            age_seconds = 9999
                        # If the room has been in DB for > 120 seconds but never joined/created in Redis, deactivate it
                        if age_seconds > 120:
                            rooms_to_delete.append(r.id)
                    else:
                        # Room is in Redis. Verify users still have active connections
                        users = room_data.get("users", {})
                        if users:
                            stale_uids = []
                            for uid, udata in users.items():
                                sid = udata.get("sid")
                                if not sid or not room_manager.store.get_sid(sid):
                                    stale_uids.append(uid)
                            if stale_uids:
                                for uid in stale_uids:
                                    users.pop(uid, None)
                                room_data["users"] = users
                                if not users:
                                    room_data["empty_since"] = now_unix
                                room_manager.store.set_room(r.id, room_data)
                                logger.info(f"Cleaned {len(stale_uids)} stale users from room {r.id}")
                        
                        # Re-check if empty after stale cleanup
                        users = room_data.get("users", {})
                        if not users:
                            empty_since = room_data.get("empty_since")
                            if empty_since:
                                if now_unix - empty_since > 120:  # 2 minutes
                                    rooms_to_delete.append(r.id)
                            else:
                                # No empty_since set but users is empty. Set it now.
                                room_data["empty_since"] = now_unix
                                room_manager.store.set_room(r.id, room_data)
                
                if rooms_to_delete:
                    logger.info(f"Auto-cleaning {len(rooms_to_delete)} empty/ghost rooms: {rooms_to_delete}")
                    for room_id in rooms_to_delete:
                        db_room = db.query(Room).filter(Room.id == room_id).first()
                        if db_room:
                            db_room.is_active = False
                        
                        # Clean up redis/playback state
                        from backend.sockets.playback import stop_sync_loop
                        stop_sync_loop(room_id)
                        room_manager.force_close_room(room_id)
                    db.commit()
            except Exception as e:
                logger.error(f"Error during room cleanup DB update: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Unexpected error in room cleanup loop: {e}")


async def _playlist_auto_sync_loop():
    """Background task to periodically sync imported playlists with auto-sync enabled."""
    from backend.database import SessionLocal
    from backend.models.playlist import Playlist, PlaylistTrack
    from backend.services.playlist_importer import import_playlist
    from datetime import datetime, timezone, timedelta
    import asyncio
    
    while True:
        try:
            # Check every 1 hour (3600 seconds)
            await asyncio.sleep(3600)
            logger.info("Starting background playlist auto-sync check...")
            
            db = SessionLocal()
            try:
                cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
                
                # Query playlists eligible for auto-sync:
                # - has an import_url
                # - auto_sync is enabled
                # - last_synced_at is null or older than 24 hours
                eligible_playlists = db.query(Playlist).filter(
                    Playlist.import_url.isnot(None),
                    Playlist.auto_sync == True,
                    (Playlist.last_synced_at.is_(None)) | (Playlist.last_synced_at < cutoff)
                ).all()
                
                if eligible_playlists:
                    logger.info(f"Found {len(eligible_playlists)} playlists eligible for auto-sync.")
                    for p in eligible_playlists:
                        try:
                            logger.info(f"Auto-syncing playlist: {p.name} ({p.id}) from {p.import_url}")
                            res = await import_playlist(p.import_url)
                            external_tracks = res.get("tracks", [])
                            
                            # Update local copy in a nested transaction or direct queries
                            db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == p.id).delete()
                            for idx, t in enumerate(external_tracks):
                                track_uri = t.get("track_uri") or t.get("uri")
                                track_name = t.get("track_name") or t.get("name") or "Unknown Track"
                                artist = t.get("artist") or "Unknown Artist"
                                album_art_url = t.get("album_art_url") or ""
                                duration_ms = t.get("duration_ms") or 0
                                
                                new_track = PlaylistTrack(
                                    playlist_id=p.id,
                                    track_uri=track_uri,
                                    track_name=track_name,
                                    artist=artist,
                                    album_art_url=album_art_url,
                                    duration_ms=duration_ms,
                                    position=idx
                                )
                                db.add(new_track)
                                
                            p.last_synced_at = datetime.now(timezone.utc)
                            db.commit()
                            logger.info(f"Successfully auto-synced playlist {p.id} with {len(external_tracks)} tracks.")
                        except Exception as inner_e:
                            logger.error(f"Error auto-syncing playlist {p.id}: {inner_e}")
                            db.rollback()
            except Exception as e:
                logger.error(f"Error in playlist auto-sync DB query: {e}")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Unexpected error in playlist auto-sync loop: {e}")


@asynccontextmanager
async def lifespan(app):
    """Application startup/shutdown lifecycle."""
    logger.info("Starting Open Jam application...")
    init_db()
    logger.info(f"CORS allowed origins: {settings.ALLOWED_ORIGINS}")
    logger.info("Database initialized successfully")
    
    # Start background tasks
    import asyncio
    cleanup_task = asyncio.create_task(_room_cleanup_loop())
    sync_task = asyncio.create_task(_playlist_auto_sync_loop())
    
    # Eagerly check and warm up Invidious/Piped instances on startup
    try:
        from backend.services.invidious import trigger_health_check_if_needed
        trigger_health_check_if_needed()
    except Exception as e:
        logger.warning(f"Failed to eagerly start Invidious health check: {e}")
        
    logger.info("Open Jam startup complete")
    yield
    cleanup_task.cancel()
    sync_task.cancel()
    logger.info("Open Jam shutting down")

app.router.lifespan_context = lifespan


@app.get("/")
@app.head("/")
async def root():
    """Root health and status endpoint for Render probes and API discovery."""
    return JSONResponse({
        "name": "OpenJam API",
        "status": "online",
        "version": "1.0.0",
        "docs": "/docs"
    })


@app.get("/ping")
async def ping():
    """Lightweight health check — no DB, no room manager. For uptime monitors."""
    uptime = int(time.time() - _start_time)
    return JSONResponse({
        "status": "pong",
        "uptime_seconds": uptime,
        "cold_start": uptime < 30,
    })

@app.get("/health")
async def health(db=Depends(get_db)):
    # Test database connection to keep pooling/database active
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return JSONResponse({
            "status": "error",
            "detail": "Database connection failed"
        }, status_code=500)

    from backend.services.room_manager import room_manager
    from backend.services.room_closer import cancel_room_close
    active_rooms = room_manager.get_active_room_ids()
    for room_id in active_rooms:
        if room_manager.get_listener_count(room_id) > 0:
            cancel_room_close(room_id)
    return JSONResponse({
        "status": "ok",
        "app": "Open Jam",
        "active_rooms": len(active_rooms),
    })


from typing import Optional
from backend.services.og_generator import generate_og_image
from backend.services.queue_manager import queue_manager
from backend.services.room_manager import room_manager
from fastapi.responses import Response
from sqlalchemy.orm import Session

@app.get("/api/og/room/{room_id}.png")
async def get_og_image(
    room_id: str,
    inviter: Optional[str] = None,
    track_name: Optional[str] = None,
    artist: Optional[str] = None,
    listener_count: Optional[int] = None,
    cover_art_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from backend.models.room import Room
    room = db.query(Room).filter(Room.id == room_id).first()
    room_name = room.name if room else "OpenJam Room"
    
    # 1. Resolve host / inviter name
    host_name = room.host.display_name if (room and room.host) else "Someone"
    effective_inviter = inviter or host_name
    avatar_url = room.host.avatar_url if (room and room.host) else None

    # 2. Resolve now playing track if not explicitly passed
    effective_track = track_name
    effective_artist = artist
    effective_cover_art = cover_art_url

    if not effective_track and room:
        now_playing = queue_manager.get_now_playing(db, room_id)
        if now_playing:
            effective_track = now_playing.get("track_name")
            effective_artist = now_playing.get("artist")
            if not effective_cover_art:
                effective_cover_art = now_playing.get("album_art_url")

    # 3. Resolve listener count if not explicitly passed
    effective_listeners = listener_count
    if effective_listeners is None and room:
        effective_listeners = room_manager.get_listener_count(room_id)

    # 4. Generate OG image PNG
    image_bytes = await generate_og_image(
        inviter_name=effective_inviter,
        room_name=room_name,
        avatar_url=avatar_url,
        track_name=effective_track,
        artist=effective_artist,
        listener_count=effective_listeners,
        cover_art_url=effective_cover_art,
    )
    
    return Response(content=image_bytes, media_type="image/png", headers={
        "Cache-Control": "public, max-age=300, s-maxage=600"
    })






if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
