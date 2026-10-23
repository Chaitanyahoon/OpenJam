"""Open Jam — Development server launcher.

Usage:
    python run.py

Visit: http://localhost:8000

NOTE: reload=True breaks WebSocket transport (uvicorn reloader doesn't proxy
WS upgrades). Run without reload for proper real-time Socket.IO via WebSocket.
"""

import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "backend.main:socket_app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )
