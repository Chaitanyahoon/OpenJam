"""Tests for room routes."""

import json

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
