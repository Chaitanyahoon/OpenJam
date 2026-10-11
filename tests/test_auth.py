"""Tests for authentication routes."""

import pytest

def test_get_me_authenticated(client, auth_headers, test_user):
    """Test getting current user info when authenticated."""
    response = client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["id"] == test_user.id
    assert data["user"]["display_name"] == test_user.display_name
    assert data["user"]["avatar_url"] == test_user.avatar_url


def test_get_me_unauthenticated(client):
    """Test getting current user info when not authenticated."""
    response = client.get("/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["user"] is None


def test_logout_authenticated(client, auth_headers):
    """Test logout when authenticated and verify token is revoked."""
    response = client.post("/auth/logout", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Logged out"

    # Subsequent request using the revoked token must not resolve the user
    subsequent = client.get("/auth/me", headers=auth_headers)
    assert subsequent.status_code == 200
    assert subsequent.json()["user"] is None


def test_logout_unauthenticated(client):
    """Test logout when not authenticated."""
    response = client.post("/auth/logout")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Logged out"


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "Open Jam"


def test_admin_login_success(client):
    """Test admin login with correct password."""
    response = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert response.status_code == 200
    assert "session_token" in response.cookies
    assert "token" in response.json()
    assert response.json()["user"]["is_admin"] is True


def test_admin_login_failure(client):
    """Test admin login with incorrect password."""
    response = client.post("/auth/admin-login", json={"password": "wrong-password"})
    assert response.status_code == 401


def test_admin_get_rooms_unauthorized(client):
    """Test fetching rooms list without admin privilege."""
    response = client.get("/admin/rooms")
    assert response.status_code in (401, 403)


def test_admin_get_rooms_success(client):
    """Test fetching rooms list as an authorized admin."""
    # First login
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200
    
    # Extract session token from cookie
    session_cookie = login_resp.cookies.get("session_token")
    assert session_cookie is not None
    
    # Use cookie to fetch rooms
    client.cookies.set("session_token", session_cookie)
    response = client.get("/admin/rooms")
    assert response.status_code == 200
    data = response.json()
    assert "rooms" in data


def test_admin_trigger_healthcheck_success(client):
    """Test manual triggering of background healthcheck as admin."""
    # Login
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200
    
    session_cookie = login_resp.cookies.get("session_token")
    client.cookies.set("session_token", session_cookie)
    
    # POST to trigger
    response = client.post("/admin/healthcheck/resolve")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Background healthcheck task started" in data["message"]


@pytest.mark.asyncio
async def test_socket_connect_rejects_revoked_token(monkeypatch):
    """Assert socket connect treats revoked session token as anonymous."""
    from unittest.mock import AsyncMock
    from backend.middleware.auth import create_session_token, revoke_token
    from backend.sockets.connection import register_connection_handlers

    token = create_session_token("victim_user", display_name="Victim")
    revoke_token(token)

    saved_session = {}
    sio = AsyncMock()
    async def mock_save_session(sid, session_data):
        saved_session.update(session_data)
    sio.save_session.side_effect = mock_save_session

    events = {}
    def mock_event(func):
        events[func.__name__] = func
        return func
    sio.event = mock_event
    sio.on = mock_event

    register_connection_handlers(sio)

    connect_handler = events["connect"]
    await connect_handler("sid_123", {}, auth={"token": token})

    # The saved session should not have the revoked user_id
    assert saved_session.get("user_id") != "victim_user"


def test_admin_get_stats_and_broadcast(client):
    """Test getting admin stats with infrastructure gauges and broadcasting announcement."""
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 1. Stats endpoint
    stats_resp = client.get("/admin/stats")
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()
    assert "stats" in stats_data
    assert "redis" in stats_data["stats"]
    assert "total_users" in stats_data["stats"]

    # 2. Broadcast endpoint
    broadcast_resp = client.post("/admin/broadcast", json={"message": "Server restart in 10 minutes"})
    assert broadcast_resp.status_code == 200
    assert broadcast_resp.json()["success"] is True

    # 3. Broadcast validation (empty message)
    empty_broadcast_resp = client.post("/admin/broadcast", json={"message": "   "})
    assert empty_broadcast_resp.status_code == 400


def test_admin_purge_room_chat(client, db_session, test_user, test_room):
    """Test admin purging chat messages in a room."""
    from backend.models.chat_message import ChatMessage

    # 1. Add chat messages
    msg = ChatMessage(id="msg-purge-1", room_id=test_room.id, user_id=test_user.id, content="Spam message")
    db_session.add(msg)
    db_session.commit()

    # 2. Unauthenticated request rejected
    unauth_resp = client.delete(f"/admin/rooms/{test_room.id}/chat")
    assert unauth_resp.status_code in (401, 403)

    # 3. Authenticate as admin
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 4. Purge chat
    purge_resp = client.delete(f"/admin/rooms/{test_room.id}/chat")
    assert purge_resp.status_code == 200
    assert purge_resp.json()["success"] is True

    # 5. Verify message deleted
    remaining = db_session.query(ChatMessage).filter(ChatMessage.room_id == test_room.id).count()
    assert remaining == 0


def test_admin_private_room_access_and_skip(client, db_session, test_user):
    """Test admin bypassing private room password and skipping tracks."""
    from backend.models.room import Room
    import hashlib

    # 1. Create a private password-protected room hosted by a different user
    private_room = Room(
        id="private-room-test",
        name="VIP Room",
        host_user_id="other-host-id",
        is_private=True,
        password_hash=hashlib.sha256(b"secret123").hexdigest(),
    )
    db_session.add(private_room)
    db_session.commit()

    # 2. Unauthenticated / non-admin sees password_required: True
    guest_resp = client.get(f"/rooms/{private_room.id}")
    assert guest_resp.status_code == 200
    assert guest_resp.json().get("password_required") is True

    # 3. Log in as admin
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 4. Admin bypasses password_required
    admin_room_resp = client.get(f"/rooms/{private_room.id}")
    assert admin_room_resp.status_code == 200
    assert admin_room_resp.json().get("password_required") is not True

    # 5. Admin skip track endpoint
    skip_resp = client.post(f"/admin/rooms/{private_room.id}/skip")
    assert skip_resp.status_code == 200
    assert skip_resp.json()["success"] is True


def test_admin_clear_audio_cache(client):
    """Test admin clearing the audio cache."""
    # 1. Unauthenticated request rejected
    unauth = client.delete("/admin/cache")
    assert unauth.status_code in (401, 403)

    # 2. Authenticated as admin
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 3. Flushes cache successfully
    resp = client.delete("/admin/cache")
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_admin_stats_registered_vs_guest_separation(client, db_session):
    """Test admin system stats separating registered Discord accounts from ephemeral guest rows."""
    from backend.models.user import User
    import uuid

    # 1. Create a guest user (no discord_id, no username)
    guest_user = User(id=str(uuid.uuid4()), display_name="Jammer-Guest1")
    # 2. Create a registered discord user
    reg_user = User(id=str(uuid.uuid4()), display_name="DiscordUser", discord_id="discord-987654")
    db_session.add_all([guest_user, reg_user])
    db_session.commit()

    # 3. Authenticate as admin
    client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    resp = client.get("/admin/stats")
    assert resp.status_code == 200
    stats = resp.json()["stats"]

    # Verify registered vs guest counts
    assert stats["registered_users"] >= 1
    assert stats["guest_users"] >= 1
    assert stats["total_users"] == stats["registered_users"]
    assert stats["total_db_users"] >= stats["registered_users"] + stats["guest_users"]

    # Verify /admin/users has is_registered flags
    users_resp = client.get("/admin/users")
    assert users_resp.status_code == 200
    all_users = {u["id"]: u for u in users_resp.json()["users"]}
    assert all_users[reg_user.id]["is_registered"] is True
    assert all_users[guest_user.id]["is_registered"] is False


def test_admin_inspect_private_playlist_bypass(client, db_session):
    """Test admin inspecting private playlist without 403 Forbidden."""
    from backend.models.user import User
    from backend.models.playlist import Playlist, PlaylistTrack
    import uuid

    # 1. Create creator and private playlist with tracks
    creator = User(id=str(uuid.uuid4()), display_name="PrivateUser", discord_id="disc-priv")
    db_session.add(creator)
    db_session.commit()

    playlist = Playlist(
        id=str(uuid.uuid4()),
        name="Top Secret Mixtape",
        creator_id=creator.id,
        is_private=True
    )
    track = PlaylistTrack(
        id=str(uuid.uuid4()),
        playlist_id=playlist.id,
        track_uri="yt-12345",
        track_name="Confidential Groove",
        artist="Secret Artist",
        position=0
    )
    db_session.add_all([playlist, track])
    db_session.commit()

    # 2. Unauthenticated / anonymous visitor gets 403
    unauth_resp = client.get(f"/playlists/{playlist.id}")
    assert unauth_resp.status_code == 403

    # 3. Authenticate as admin
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 4. Admin accesses private playlist via standard endpoint
    admin_pl_resp = client.get(f"/playlists/{playlist.id}")
    assert admin_pl_resp.status_code == 200
    assert admin_pl_resp.json()["playlist"]["name"] == "Top Secret Mixtape"
    assert len(admin_pl_resp.json()["playlist"]["tracks"]) == 1

    # 5. Admin lists playlists via /admin/playlists with tracks included
    admin_list_resp = client.get("/admin/playlists")
    assert admin_list_resp.status_code == 200
    matching = [p for p in admin_list_resp.json()["playlists"] if p["id"] == playlist.id]
    assert len(matching) == 1
    assert len(matching[0]["tracks"]) == 1
    assert matching[0]["tracks"][0]["track_name"] == "Confidential Groove"


def test_admin_prune_stale_guests_and_db_ping(client, db_session):
    """Test db_ping_ms in /admin/stats and safe pruning of stale ephemeral guest rows."""
    from datetime import datetime, timezone, timedelta
    from backend.models.user import User
    from backend.models.playlist import Playlist
    import uuid

    # 1. Admin login
    login_resp = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_resp.status_code == 200

    # 2. Check /admin/stats includes db_ping_ms
    stats_resp = client.get("/admin/stats")
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()["stats"]
    assert "db_ping_ms" in stats_data
    assert stats_data["db_ping_ms"] is not None

    # 3. Create test users:
    # Stale guest (> 7 days)
    old_guest = User(
        id=str(uuid.uuid4()),
        display_name="Guest Old",
        created_at=datetime.now(timezone.utc) - timedelta(days=10)
    )
    # Recent guest (< 7 days)
    recent_guest = User(
        id=str(uuid.uuid4()),
        display_name="Guest Recent",
        created_at=datetime.now(timezone.utc) - timedelta(days=2)
    )
    # Stale guest with a saved playlist
    guest_with_playlist = User(
        id=str(uuid.uuid4()),
        display_name="Guest With Playlist",
        created_at=datetime.now(timezone.utc) - timedelta(days=15)
    )
    # Registered Discord user
    registered_user = User(
        id=str(uuid.uuid4()),
        display_name="Registered Discord User",
        discord_id="discord-user-123",
        created_at=datetime.now(timezone.utc) - timedelta(days=20)
    )
    db_session.add_all([old_guest, recent_guest, guest_with_playlist, registered_user])
    db_session.commit()

    saved_playlist = Playlist(
        id=str(uuid.uuid4()),
        name="Guest Favs",
        creator_id=guest_with_playlist.id,
        is_private=False
    )
    db_session.add(saved_playlist)
    db_session.commit()

    # 4. Prune guests older than 7 days
    prune_resp = client.post("/admin/users/guests/prune", json={"days": 7})
    assert prune_resp.status_code == 200
    prune_data = prune_resp.json()
    assert prune_data["success"] is True
    assert prune_data["pruned_count"] == 1

    # 5. Verify database records
    assert db_session.query(User).filter(User.id == old_guest.id).first() is None
    assert db_session.query(User).filter(User.id == recent_guest.id).first() is not None
    assert db_session.query(User).filter(User.id == guest_with_playlist.id).first() is not None
    assert db_session.query(User).filter(User.id == registered_user.id).first() is not None



