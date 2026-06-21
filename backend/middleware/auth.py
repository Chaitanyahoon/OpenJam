"""Auth middleware — anonymous session-based identification and database-backed checks."""

from fastapi import Request, HTTPException, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from itsdangerous import URLSafeTimedSerializer
from backend.config import settings

serializer = URLSafeTimedSerializer(settings.SECRET_KEY)


def create_session_token(user_id: str, display_name: str = "", is_admin: bool = False, avatar_url: str = None) -> str:
    return serializer.dumps({"user_id": user_id, "display_name": display_name, "is_admin": is_admin, "avatar_url": avatar_url})


def get_user_id_from_token(token: str) -> str | None:
    try:
        if token in settings.REVOKED_TOKENS:
            return None
        data = serializer.loads(token, max_age=86400 * 30)  # 30-day token lifetime
        return data.get("user_id")
    except Exception:
        return None


def get_current_user_id(request: Request, include_name: bool = False):
    """Return user_id string, or full dict when include_name=True."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        return None
    if token in settings.REVOKED_TOKENS:
        return None
    try:
        data = serializer.loads(token, max_age=86400 * 30)  # 30-day token lifetime
    except Exception:
        return None

    user_id = data.get("user_id")
    if not user_id:
        return None

    if include_name:
        return {
            "id": user_id,
            "display_name": data.get("display_name", "Jammer"),
            "avatar_url": data.get("avatar_url"),
            "is_admin": data.get("is_admin", False),
        }
    return user_id


def revoke_token(token: str) -> None:
    settings.REVOKED_TOKENS.add(token)


def require_auth(request: Request) -> str:
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


def require_admin(request: Request, db: Session = Depends(get_db)) -> str:
    """Enforces that the user has admin privileges based on the database user record."""
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    from backend.models.user import User
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user_id


def require_registered_user(request: Request) -> str:
    """Enforces that the user has a valid active session AND exists in the database (i.e. is not a guest)."""
    user_id = require_auth(request)
    
    from backend.database import SessionLocal
    from backend.models.user import User
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=403, 
                detail="Registered account required for this feature. Please sign in with Discord."
            )
        return user_id
    finally:
        db.close()
