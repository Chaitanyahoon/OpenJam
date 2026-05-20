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


