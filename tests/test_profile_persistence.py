import uuid
import pytest
from backend.models.user import User
from backend.models.room import Room
from backend.middleware.auth import create_session_token


def test_avatar_custom_persists_across_room_creation(client, db_session):
    """Verify that creating a room does not overwrite a user's customized avatar with stale token data."""
    user_id = str(uuid.uuid4())
    custom_avatar = "https://media.tenor.com/custom-cat.gif"
    custom_name = "SuperJammer"
    
    # User customized their profile in DB
    user = User(id=user_id, display_name=custom_name, avatar_url=custom_avatar)
    db_session.add(user)
    db_session.commit()
    
    # Stale token with old discord avatar
    stale_discord_avatar = "https://cdn.discordapp.com/avatars/123/old.png"
    stale_token = create_session_token(user_id, display_name="OldDiscordName", avatar_url=stale_discord_avatar)
    
    # Create room
    res = client.post(
        "/rooms",
        json={"name": "Test Room", "is_private": False, "genre_tags": ["rock"]},
        headers={"Authorization": f"Bearer {stale_token}"}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    
    # Room host avatar must be custom avatar, NOT stale token avatar
    assert data["room"]["host_avatar_url"] == custom_avatar
    assert data["room"]["host_name"] == custom_name
    
    # DB user record must NOT have been overwritten
    db_session.refresh(user)
    assert user.avatar_url == custom_avatar
    assert user.display_name == custom_name


def test_auth_join_preserves_custom_avatar(client):
    """Verify that POST /auth/join accepts and includes avatar_url in user and token."""
    custom_avatar = "https://media.tenor.com/cool-guest.gif"
    res = client.post(
        "/auth/join",
        json={"display_name": "GuestFan", "avatar_url": custom_avatar}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user"]["display_name"] == "GuestFan"
    assert data["user"]["avatar_url"] == custom_avatar
    assert "token" in data
