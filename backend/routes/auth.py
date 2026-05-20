"""Authentication routes — anonymous join flow (no OAuth required)."""

import re
import uuid
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from backend.middleware.auth import create_session_token, get_current_user_id, revoke_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_HTML_TAG_RE = re.compile(r'<[^>]+>')

def _sanitize_name(name: str) -> str:
    """Strip HTML tags and excessive whitespace from display names."""
    name = _HTML_TAG_RE.sub('', name).strip()
    # Collapse multiple spaces
    name = re.sub(r'\s+', ' ', name)
    return name


@router.post("/join")
async def join(request: Request):
    """Create an anonymous session. Accepts { display_name } and sets a session cookie."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    display_name = _sanitize_name(body.get("display_name") or "")
    if not display_name:
        display_name = f"Jammer-{uuid.uuid4().hex[:4].upper()}"
    if len(display_name) > 30:
        display_name = display_name[:30]

    # Generate a stable user_id for this session (not persisted to DB)
    user_id = str(uuid.uuid4())
    token = create_session_token(user_id, display_name=display_name)

    response = JSONResponse(content={
        "user": {"id": user_id, "display_name": display_name, "avatar_url": None}
    })
    from backend.config import settings
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=86400 * 7,
    )
    logger.info(f"Anonymous session created: '{display_name}' ({user_id})")
    return response


@router.post("/admin-login")
async def admin_login(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
        
    password = body.get("password")
    import os
    admin_password = os.getenv("ADMIN_PASSWORD", "openjam-admin-123")
    
    if password != admin_password:
        return JSONResponse({"error": "Invalid admin password"}, status_code=401)
        
    # Get current session or create new one
    user_data = get_current_user_id(request, include_name=True)
    if user_data:
        user_id = user_data["id"]
        display_name = user_data["display_name"]
    else:
        user_id = str(uuid.uuid4())
        display_name = "Admin"
        
    token = create_session_token(user_id, display_name=display_name, is_admin=True)
    
    response = JSONResponse(content={
        "user": {"id": user_id, "display_name": display_name, "avatar_url": None, "is_admin": True}
    })
    from backend.config import settings
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        max_age=86400 * 7,
    )
    logger.info(f"Admin session created/upgraded for user: {user_id}")
    return response


@router.get("/me")
async def get_me(request: Request):
    """Return current session info from cookie (no DB lookup needed)."""
    user_data = get_current_user_id(request, include_name=True)
    if not user_data:
        return JSONResponse(content={"user": None}, status_code=200)
    return {"user": user_data}


@router.post("/logout")
async def logout(request: Request):
    token = request.cookies.get("session_token")
    if token:
        revoke_token(token)
        logger.info("User logged out")
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("session_token")
    return response
