"""Tests for room routes."""

import json
import pytest

def test_list_rooms_empty(client, db_session):
    """Test listing rooms when none exist."""
    response = client.get("/rooms")
    assert response.status_code == 200
    data = response.json()
    assert data["rooms"] == []
    assert data["total"] == 0


def test_list_rooms_with_data(client, test_room, db_session):
    """Test listing rooms with existing data."""
    response = client.get("/rooms")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 1
    assert data["total"] == 1
    assert data["rooms"][0]["name"] == "Test Room"
    assert data["rooms"][0]["description"] == "A test room"


def test_list_rooms_search_filter(client, test_room, db_session):
    """Test listing rooms with search filter."""
    response = client.get("/rooms?search=Test")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 1
    
    response = client.get("/rooms?search=Nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 0


def test_list_rooms_pagination(client, db_session, test_user):
    """Test pagination of rooms list."""
    # Create multiple rooms
    for i in range(25):
        room = __import__('backend.models.room', fromlist=['Room']).Room(
            name=f"Room {i}",
            host_user_id=test_user.id,
            description=f"Room description {i}",
            genre_tags=json.dumps(["test"]),
            queue_mode="open",
        )
        db_session.add(room)
    db_session.commit()
    
    # Test pagination
    response = client.get("/rooms?skip=0&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 10
    assert data["total"] == 25
    
    response = client.get("/rooms?skip=10&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 10
    
    response = client.get("/rooms?skip=20&limit=10")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 5


def test_create_room_authenticated(client, auth_headers, test_user, db_session):
    """Test creating a room when authenticated."""
    payload = {
        "name": "New Room",
        "description": "A new test room",
        "genre_tags": ["jazz", "chill"],
        "queue_mode": "open",
    }
    response = client.post("/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["room"]["name"] == "New Room"
    assert data["room"]["host_user_id"] == test_user.id
    assert data["room"]["host_name"] == test_user.display_name
    assert "id" in data["room"]


def test_create_room_unauthenticated(client):
    """Test creating a room without authentication."""
    payload = {
        "name": "New Room",
        "description": "A new test room",
    }
    response = client.post("/rooms", json=payload)
    assert response.status_code == 401


def test_create_room_validation(client, auth_headers):
    """Test room creation with invalid data."""
    # Empty name
    payload = {"name": "", "description": "Test"}
    response = client.post("/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 422  # Validation error
    
    # Name too long
    payload = {"name": "x" * 101, "description": "Test"}
    response = client.post("/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_get_room_exists(client, test_room):
    """Test getting room details when room exists."""
    response = client.get(f"/rooms/{test_room.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["room"]["name"] == "Test Room"
    assert data["room"]["id"] == test_room.id
    assert "queue" in data
    assert "listeners" in data


def test_get_room_not_found(client):
    """Test getting room details when room doesn't exist."""
    response = client.get("/rooms/nonexistent-id")
    assert response.status_code == 404


def test_close_room_as_host(client, test_room, auth_headers, test_user, db_session):
    """Test closing room as host."""
    # Ensure test_user is the host
    assert test_room.host_user_id == test_user.id
    
    response = client.delete(f"/rooms/{test_room.id}", headers=auth_headers)
    assert response.status_code == 200
    
    # Verify room is closed
    db_session.refresh(test_room)
    assert test_room.is_active is False


def test_close_room_not_host(client, test_room, db_session, test_user):
    """Test closing room as non-host user."""
    # Create another user
    from backend.models.user import User
    other_user = User(
        display_name="Other User",
    )
    db_session.add(other_user)
    db_session.commit()
    
    # Create auth token for other user
    from backend.middleware.auth import create_session_token
    token = create_session_token(other_user.id, display_name=other_user.display_name)
    headers = {
        "Cookie": f"session_token={token}",
    }
    
    response = client.delete(f"/rooms/{test_room.id}", headers=headers)
    assert response.status_code == 403


def test_close_room_unauthenticated(client, test_room):
    """Test closing room without authentication."""
    response = client.delete(f"/rooms/{test_room.id}")
    assert response.status_code == 401


def test_create_private_room(client, auth_headers, test_user, db_session):
    """Test creating a private room with a password."""
    import hashlib
    from backend.models.room import Room

    payload = {
        "name": "Secret VIP Lounge",
        "description": "Invite only",
        "genre_tags": ["jazz", "chill"],
        "queue_mode": "open",
        "password": "secretpassword123",
    }
    response = client.post("/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["room"]["name"] == "Secret VIP Lounge"
    assert data["room"]["is_private"] is True
    assert "password" not in data["room"]
    assert "password_hash" not in data["room"]

    # Verify database state
    db_room = db_session.query(Room).filter(Room.id == data["room"]["id"]).first()
    assert db_room is not None
    assert db_room.is_private is True
    expected_hash = hashlib.sha256(b"secretpassword123").hexdigest()
    assert db_room.password_hash == expected_hash


def test_list_private_room(client, auth_headers, test_user, db_session):
    """Test listing rooms when a private room exists."""
    import hashlib
    from backend.models.room import Room

    room = Room(
        name="Private Room",
        host_user_id=test_user.id,
        description="A private room",
        genre_tags=json.dumps(["jazz"]),
        queue_mode="open",
        is_private=True,
        password_hash=hashlib.sha256(b"shh").hexdigest(),
    )
    db_session.add(room)
    db_session.commit()

    response = client.get("/rooms")
    assert response.status_code == 200
    data = response.json()
    
    # We should have the default test_room (if loaded) or just this room
    private_rooms = [r for r in data["rooms"] if r["name"] == "Private Room"]
    assert len(private_rooms) == 1
    assert private_rooms[0]["is_private"] is True
    assert "password" not in private_rooms[0]
    assert "password_hash" not in private_rooms[0]


@pytest.mark.asyncio
async def test_join_room_private_password_validation(db_session, test_user):
    """Test the socket join_room handler private room password logic."""
    import hashlib
    from backend.models.room import Room
    from backend.models.user import User
    from backend.sockets.connection import register_connection_handlers
    from unittest.mock import AsyncMock, patch

    # 1. Create a private room
    room = Room(
        name="Private Room",
        host_user_id="host_user_id",
        description="A private room",
        genre_tags='["jazz"]',
        queue_mode="open",
        is_private=True,
        password_hash=hashlib.sha256(b"secret123").hexdigest(),
    )
    db_session.add(room)
    
    # Also create a non-host guest user
    guest = User(id="guest_user_id", display_name="Guest Jammer")
    db_session.add(guest)
    db_session.commit()

    # 2. Mock sio (socketio AsyncServer)
    sio = AsyncMock()
    
    # We want to capture the event handlers registered
    handlers = {}
    def mock_event(func):
        handlers[func.__name__] = func
        return func
    
    sio.event = mock_event
    sio.on = mock_event

    # Register handlers
    register_connection_handlers(sio)
    
    # Retrieve the join_room handler
    join_room_handler = handlers.get("join_room")
    assert join_room_handler is not None

    # Patch SessionLocal to return our test database session
    with patch("backend.sockets.connection.SessionLocal", return_value=db_session):
        # 3. Try to join without password
        sio.get_session.return_value = {"user_id": "guest_user_id", "display_name": "Guest Jammer"}
        
        await join_room_handler("sid_123", {"room_id": room.id})
        
        # Verify join_error is emitted for password_required
        sio.emit.assert_called_with(
            "join_error",
            {"message": "This room is private. Password required.", "reason": "password_required"},
            to="sid_123"
        )
        
        # 4. Try to join with wrong password
        sio.emit.reset_mock()
        await join_room_handler("sid_123", {"room_id": room.id, "password": "wrongpassword"})
        sio.emit.assert_called_with(
            "join_error",
            {"message": "Incorrect password. Please try again.", "reason": "invalid_password"},
            to="sid_123"
        )
        
        # 5. Try to join with correct password
        sio.emit.reset_mock()
        await join_room_handler("sid_123", {"room_id": room.id, "password": "secret123"})
        
        # Verify no join_error was emitted
        error_calls = [c for c in sio.emit.call_args_list if c[0][0] == "join_error"]
        assert len(error_calls) == 0


def test_private_room_http_security(client, test_room, db_session, test_user, auth_headers):
    """Test full HTTP security integration for public vs private rooms."""
    import hashlib
    from backend.models.room import Room
    from backend.models.user import User
    from backend.middleware.auth import create_session_token
    from backend.services.room_manager import room_manager

    # 1. Accessing a public room (test_room) as guest works fully
    guest_user = User(display_name="Guest User")
    db_session.add(guest_user)
    db_session.commit()
    db_session.refresh(guest_user)

    guest_token = create_session_token(guest_user.id, display_name=guest_user.display_name)
    guest_headers = {
        "Cookie": f"session_token={guest_token}",
    }

    # Public room details should work
    res_public = client.get(f"/rooms/{test_room.id}", headers=guest_headers)
    assert res_public.status_code == 200
    data_public = res_public.json()
    assert "queue" in data_public
    assert "listeners" in data_public
    assert "password_required" not in data_public

    # Create a private room
    private_room = Room(
        name="Private Lounge",
        host_user_id=test_user.id,
        description="Private room description",
        genre_tags='["jazz"]',
        queue_mode="open",
        is_private=True,
        password_hash=hashlib.sha256(b"secret123").hexdigest(),
    )
    db_session.add(private_room)
    db_session.commit()
    db_session.refresh(private_room)

    # Make sure we clean up any pre-existing room_manager state for this room id
    room_manager.store.del_room(private_room.id)

    # 2. A guest accessing a private room via HTTP GET `/rooms/{room_id}` without joining
    # gets a `password_required: True` payload and empty queue/listeners.
    res_private_unauth = client.get(f"/rooms/{private_room.id}", headers=guest_headers)
    assert res_private_unauth.status_code == 200
    data_unauth = res_private_unauth.json()
    assert data_unauth["password_required"] is True
    assert data_unauth["queue"] == []
    assert data_unauth["listeners"] == []
    assert data_unauth["room"]["is_private"] is True

    # 3. The host accessing the private room gets the full details.
    res_private_host = client.get(f"/rooms/{private_room.id}", headers=auth_headers)
    assert res_private_host.status_code == 200
    data_host = res_private_host.json()
    assert "password_required" not in data_host
    assert "queue" in data_host
    assert "listeners" in data_host

    # 4. Once a guest is registered in `room_manager` for that room, they receive the full details
    # on subsequent HTTP GET room requests.
    room_manager.join_room(room_id=private_room.id, user_id=guest_user.id, sid="sid_guest", display_name=guest_user.display_name)
    
    res_private_auth_guest = client.get(f"/rooms/{private_room.id}", headers=guest_headers)
    assert res_private_auth_guest.status_code == 200
    data_auth_guest = res_private_auth_guest.json()
    assert "password_required" not in data_auth_guest
    assert "queue" in data_auth_guest
    assert "listeners" in data_auth_guest

    # 5. HTTP POST queue actions are blocked with `403 Forbidden` if the guest is not in the room.
    # Leave room to simulate unauthorized access again.
    room_manager.leave_room("sid_guest")

    payload = {
        "uri": "abcdefghijk",
        "name": "Unchained Melody",
        "artist": "The Righteous Brothers",
        "album_art_url": "https://example.com/art.jpg",
        "duration_ms": 180000,
    }
    res_add_unauth = client.post(f"/rooms/{private_room.id}/queue", json=payload, headers=guest_headers)
    assert res_add_unauth.status_code == 403
    assert "Room access denied" in res_add_unauth.json()["detail"]

    # Guest tries to fetch queue directly via `/queue/{room_id}` -> should get 403 Forbidden
    res_get_queue_unauth = client.get(f"/queue/{private_room.id}", headers=guest_headers)
    assert res_get_queue_unauth.status_code == 403
    assert "Room access denied" in res_get_queue_unauth.json()["detail"]


def test_private_room_stale_session(client, db_session, test_user):
    """Test that check_room_access denies access if the user's socket SID is stale/dead."""
    import hashlib
    from backend.models.room import Room
    from backend.models.user import User
    from backend.middleware.auth import create_session_token
    from backend.services.room_manager import room_manager

    # Create private room
    private_room = Room(
        name="Stale Lounge",
        host_user_id=test_user.id,
        description="Private room description",
        genre_tags='["jazz"]',
        queue_mode="open",
        is_private=True,
        password_hash=hashlib.sha256(b"secret123").hexdigest(),
    )
    db_session.add(private_room)

    # Create guest user
    guest_user = User(display_name="Guest User")
    db_session.add(guest_user)
    db_session.commit()
    db_session.refresh(guest_user)

    guest_token = create_session_token(guest_user.id, display_name=guest_user.display_name)
    guest_headers = {
        "Cookie": f"session_token={guest_token}",
    }

    # Simulate joining the room (setting users entry with SID)
    room_manager.join_room(room_id=private_room.id, user_id=guest_user.id, sid="sid_guest_stale", display_name=guest_user.display_name)
    
    # 1. Guest should have access when SID is active
    res_before = client.get(f"/rooms/{private_room.id}", headers=guest_headers)
    assert res_before.status_code == 200
    assert res_before.json().get("password_required") is not True

    # 2. Delete the user's SID to simulate disconnection/stale state
    room_manager.store.del_sid("sid_guest_stale")

    # 3. Guest should now be denied access (password_required: True)
    res_after = client.get(f"/rooms/{private_room.id}", headers=guest_headers)
    assert res_after.status_code == 200
    assert res_after.json().get("password_required") is True




