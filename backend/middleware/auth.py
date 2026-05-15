"""Auth middleware — anonymous session-based identification."""

from fastapi import Request, HTTPException
from itsdangerous import URLSafeSerializer
from backend.config import settings

serializer = URLSafeSerializer(settings.SECRET_KEY)


def create_session_token(user_id: str, display_name: str = "") -> str:
    return serializer.dumps({"user_id": user_id, "display_name": display_name})


def get_user_id_from_token(token: str) -> str | None:
    try:
        if token in settings.REVOKED_TOKENS:
            return None
        data = serializer.loads(token)
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
        data = serializer.loads(token)
    except Exception:
        return None

    user_id = data.get("user_id")
    if not user_id:
        return None

    if include_name:
        return {
            "id": user_id,
            "display_name": data.get("display_name", "Jammer"),
            "avatar_url": None,
        }
    return user_id


def revoke_token(token: str) -> None:
    settings.REVOKED_TOKENS.add(token)


def require_auth(request: Request) -> str:
    user_id = get_current_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id
