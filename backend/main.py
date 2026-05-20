"""Open Jam — Main application entry point."""

import logging
import os
import time
from contextlib import asynccontextmanager
import socketio
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
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

register_connection_handlers(sio)
register_chat_handlers(sio)
register_playback_handlers(sio)
register_queue_handlers(sio)

socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@asynccontextmanager
async def lifespan(app):
    """Application startup/shutdown lifecycle."""
    logger.info("Starting Open Jam application...")
    init_db()
    logger.info(f"CORS allowed origins: {settings.ALLOWED_ORIGINS}")
    logger.info("Database initialized successfully")
    logger.info("Open Jam startup complete")
    yield
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


@app.get("/room/{room_id}")
async def serve_room(room_id: str):
    return FileResponse("frontend/room.html")


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
