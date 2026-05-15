"""Open Jam — Main application entry point."""

import logging
import socketio
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import init_db
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

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    logger=False,
    engineio_logger=False,
)

app = FastAPI(title="Open Jam", version="1.0.0")
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


@app.on_event("startup")
async def startup():
    logger.info("Starting Open Jam application...")
    init_db()
    logger.info(f"CORS allowed origins: {settings.ALLOWED_ORIGINS}")
    logger.info("Database initialized successfully")
    logger.info("Open Jam startup complete")


@app.get("/health")
async def health():
    from backend.services.room_manager import room_manager
    from backend.services.room_closer import cancel_room_close
    active_rooms = room_manager.get_active_room_ids()
    # Keepalive: cancel pending close timers for any room that still has listeners
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





if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:socket_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
