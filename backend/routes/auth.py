"""Authentication routes — anonymous join flow (no OAuth required)."""

import uuid
import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from backend.middleware.auth import create_session_token, get_current_user_id, revoke_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/join")
async def join(request: Request):
    """Create an anonymous session. Accepts { display_name } and sets a session cookie."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    display_name = (body.get("display_name") or "").strip()
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
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=86400 * 7,
    )
    logger.info(f"Anonymous session created: '{display_name}' ({user_id})")
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
