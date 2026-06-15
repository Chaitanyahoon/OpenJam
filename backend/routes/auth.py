"""Authentication routes — anonymous join flow + Discord OAuth2."""

import re
import uuid
import logging
from urllib.parse import urlencode

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, RedirectResponse
import httpx

from backend.middleware.auth import create_session_token, get_current_user_id, revoke_token
from backend.config import settings

logger = logging.getLogger(__name__)

auth_logs = []

def log_auth_event(msg: str):
    logger.info(msg)
    auth_logs.append(msg)
    if len(auth_logs) > 50:
        auth_logs.pop(0)

def log_auth_error(msg: str):
    logger.error(msg)
    auth_logs.append(f"ERROR: {msg}")
    if len(auth_logs) > 50:
        auth_logs.pop(0)

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
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=False,
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
        
    password = body.get("password", "")
    import os
    admin_password = os.getenv("ADMIN_PASSWORD", "openjam-admin-123")
    
    if password.strip() != admin_password.strip():
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
    is_prod = settings.ENVIRONMENT == "production"
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=False,
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


@router.get("/config")
async def get_config():
    """Expose public settings like Discord Client ID to the frontend."""
    return {"discord_client_id": settings.DISCORD_CLIENT_ID}


@router.post("/logout")
async def logout(request: Request):
    token = request.cookies.get("session_token")
    if token:
        revoke_token(token)
        logger.info("User logged out")
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("session_token")
    return response


@router.get("/logs")
async def get_auth_logs():
    """Endpoint to fetch dynamic authentication diagnostics logs."""
    return {"logs": auth_logs}



# ════════════════════════════════════════════════════════════
# Discord OAuth2 Login
# ════════════════════════════════════════════════════════════

DISCORD_API_BASE = "https://discord.com/api/v10"
DISCORD_AUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


def get_redirect_uri(request: Request) -> str:
    import os
    env_uri = os.getenv("DISCORD_REDIRECT_URI")
    
    # 1. If DISCORD_REDIRECT_URI is explicitly set in environment, respect it!
    if env_uri:
        return env_uri
        
    # 2. Fallback to FRONTEND_URL if configured
    from backend.config import settings
    if settings.FRONTEND_URL:
        return f"{settings.FRONTEND_URL.rstrip('/')}/auth/discord/callback"
        
    # 3. Fallback to dynamic host detection
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_host:
        host = forwarded_host
    else:
        host = request.headers.get("host", "localhost:8000")
        
    is_local = "localhost" in host or "127.0.0.1" in host
    scheme = "http" if is_local else "https"
    
    forwarded_proto = request.headers.get("x-forwarded-proto")
    if forwarded_proto and not is_local:
        scheme = forwarded_proto
        
    return f"{scheme}://{host}/auth/discord/callback"


@router.get("/discord")
async def discord_login(request: Request):
    """Redirect user to Discord OAuth2 authorization page."""
    if not settings.DISCORD_CLIENT_ID:
        log_auth_error("discord_login: DISCORD_CLIENT_ID not configured")
        return JSONResponse({"error": "Discord login not configured"}, status_code=501)

    redirect_uri = get_redirect_uri(request)
    log_auth_event(f"discord_login: redirect_uri={redirect_uri}")

    params = {
        "client_id": settings.DISCORD_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "identify",
        "prompt": "consent",
    }
    return RedirectResponse(f"{DISCORD_AUTH_URL}?{urlencode(params)}")



@router.get("/discord/callback")
async def discord_callback(request: Request, code: str = ""):
    """Handle Discord OAuth2 callback — exchange code for token, fetch user, create session."""
    log_auth_event(f"discord_callback: callback invoked with code length={len(code) if code else 0}")
    if not code:
        log_auth_error("discord_callback: no code provided")
        return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_no_code")

    if not settings.DISCORD_CLIENT_ID or not settings.DISCORD_CLIENT_SECRET:
        log_auth_error("discord_callback: DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET not configured")
        return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_not_configured")

    try:
        # 1. Exchange authorization code for access token
        redirect_uri = get_redirect_uri(request)
        log_auth_event(f"discord_callback: using redirect_uri={redirect_uri}")
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_resp = await client.post(DISCORD_TOKEN_URL, data={
                "client_id": settings.DISCORD_CLIENT_ID,
                "client_secret": settings.DISCORD_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
            }, headers={"Content-Type": "application/x-www-form-urlencoded"})

            if token_resp.status_code != 200:
                log_auth_error(f"Discord token exchange failed (status={token_resp.status_code}): {token_resp.text}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_token_failed")

            token_data = token_resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                log_auth_error(f"discord_callback: token exchange response missing access_token. response={token_data}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_no_token")

            # 2. Fetch Discord user profile
            user_resp = await client.get(f"{DISCORD_API_BASE}/users/@me", headers={
                "Authorization": f"Bearer {access_token}",
            })

            if user_resp.status_code != 200:
                log_auth_error(f"Discord user fetch failed (status={user_resp.status_code}): {user_resp.text}")
                return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_user_failed")

            discord_user = user_resp.json()

        discord_id = discord_user["id"]
        discord_username = discord_user.get("global_name") or discord_user.get("username", "Jammer")
        discord_avatar_hash = discord_user.get("avatar")

        log_auth_event(f"discord_callback: fetched user '{discord_username}' (id={discord_id})")

        # Build avatar URL
        if discord_avatar_hash:
            avatar_ext = "gif" if discord_avatar_hash.startswith("a_") else "png"
            avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{discord_avatar_hash}.{avatar_ext}?size=256"
        else:
            # Default Discord avatar
            default_index = (int(discord_id) >> 22) % 6
            avatar_url = f"https://cdn.discordapp.com/embed/avatars/{default_index}.png"

        # 3. Find or create user in DB
        from backend.database import SessionLocal
        from backend.models.user import User

        db = SessionLocal()
        try:
            user = db.query(User).filter(User.discord_id == discord_id).first()
            if user:
                # Update existing user's profile
                user.display_name = discord_username
                user.avatar_url = avatar_url
                user.discord_username = discord_username
                db.commit()
                user_id = user.id
                log_auth_event(f"discord_callback: updated existing user in DB (id={user_id})")
            else:
                # Create new user
                user_id = str(uuid.uuid4())
                user = User(
                    id=user_id,
                    display_name=discord_username,
                    avatar_url=avatar_url,
                    discord_id=discord_id,
                    discord_username=discord_username,
                )
                db.add(user)
                db.commit()
                log_auth_event(f"discord_callback: created new user in DB (id={user_id})")
        finally:
            db.close()

        # 4. Create session token and set cookie
        session_token = create_session_token(
            user_id=user_id,
            display_name=discord_username,
            avatar_url=avatar_url,
        )

        response = RedirectResponse(f"{settings.FRONTEND_URL}/?token={session_token}")
        is_prod = settings.ENVIRONMENT == "production"
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=False,
            samesite="lax",
            secure=is_prod,
            max_age=86400 * 30,  # 30 days for Discord login
        )
        log_auth_event(f"Discord login successful: '{discord_username}' (discord_id={discord_id}, user_id={user_id})")
        return response

    except Exception as e:
        log_auth_error(f"Discord OAuth2 exception: {str(e)}")
        import traceback
        log_auth_error(traceback.format_exc())
        return RedirectResponse(f"{settings.FRONTEND_URL}/?error=discord_error")

