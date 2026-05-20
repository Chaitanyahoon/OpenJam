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
from backend.sockets.connection import register_connection_handlers
from backend.sockets.chat import register_chat_handlers
from backend.sockets.playback import register_playback_handlers
from backend.sockets.queue import register_queue_handlers

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

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=False,
    engineio_logger=False,
)

app = FastAPI(title="Open Jam", version="1.0.0")
app.state.limiter = limiter
app.state.sio = sio
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
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

register_connection_handlers(sio)
register_chat_handlers(sio)
register_playback_handlers(sio)
register_queue_handlers(sio)

@app.get("/sw.js")
async def serve_sw():
    return FileResponse("frontend/sw.js", media_type="application/javascript")


socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")

app.mount("/static", StaticFiles(directory="frontend"), name="static")


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
                        # Calculate age based on created_at
                        compare_dt = now_dt
                        if r.created_at and r.created_at.tzinfo is None:
                            compare_dt = datetime.now()
                        
                        age_seconds = (compare_dt - r.created_at).total_seconds() if r.created_at else 9999
                        # If the room has been in DB for > 120 seconds but never joined/created in Redis, deactivate it
                        if age_seconds > 120:
                            rooms_to_delete.append(r.id)
                    else:
                        # Room is in Redis. Check if empty
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


@asynccontextmanager
async def lifespan(app):
    """Application startup/shutdown lifecycle."""
    logger.info("Starting Open Jam application...")
    init_db()
    logger.info(f"CORS allowed origins: {settings.ALLOWED_ORIGINS}")
    logger.info("Database initialized successfully")
    
    # Start background cleanup task
    import asyncio
    cleanup_task = asyncio.create_task(_room_cleanup_loop())
    
    logger.info("Open Jam startup complete")
    yield
    cleanup_task.cancel()
    logger.info("Open Jam shutting down")

app.router.lifespan_context = lifespan


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


@app.get("/")
async def serve_home():
    return FileResponse("frontend/index.html")

@app.get("/admin")
async def serve_admin():
    return FileResponse("frontend/admin.html")


@app.get("/room/{room_id}", response_class=HTMLResponse)
async def serve_room(room_id: str, request: Request):
    from backend.database import get_db
    from backend.models.room import Room
    from backend.services.queue_manager import queue_manager
    from sqlalchemy.orm import selectinload

    # Default fallbacks
    title = "Open Jam Room"
    description = "Join this listening room and discover music together in real-time."
    image = "/static/img/cover-banner.png"

    db = next(get_db())
    try:
        room = db.query(Room).options(selectinload(Room.host)).filter(Room.id == room_id).first()
        if room:
            host_name = room.host.display_name if room.host else "Jammer"
            title = f"{room.name} — Open Jam"
            
            now_playing = queue_manager.get_now_playing(db, room.id)
            if now_playing:
                track_name = now_playing.get("track_name", "Unknown Track")
                artist = now_playing.get("artist", "Unknown Artist")
                description = f"Listening with {host_name} to {track_name} by {artist}. Join the Jam and listen in sync!"
                track_art = now_playing.get("album_art_url")
                if track_art:
                    image = track_art
            else:
                description = f"Hosted by {host_name}. Join the room to queue tracks and listen together!"
    except Exception as e:
        logger.error(f"Error generating meta tags: {e}")
    finally:
        db.close()

    try:
        with open("frontend/room.html", "r", encoding="utf-8") as f:
            html_content = f.read()
    except Exception as e:
        logger.error(f"Failed to read room.html: {e}")
        return HTMLResponse(content="Room not found", status_code=404)

    # Inject Open Graph metadata
    html_content = html_content.replace("{{OG_TITLE}}", title)
    html_content = html_content.replace("{{OG_DESCRIPTION}}", description)
    
    base_url = str(request.base_url).rstrip("/")
    if image.startswith("/"):
        abs_image = f"{base_url}{image}"
    else:
        abs_image = image

    html_content = html_content.replace("{{OG_IMAGE}}", abs_image)
    return HTMLResponse(content=html_content)


@app.get("/privacy")
async def serve_privacy():
    return FileResponse("frontend/privacy.html")


@app.get("/terms")
async def serve_terms():
    return FileResponse("frontend/terms.html")





if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
