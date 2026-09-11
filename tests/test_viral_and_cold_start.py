"""Tests for 24/7 Chill Lounge, 1-Click Duo Jam, and Guest Onboarding."""

import json
import pytest
from datetime import datetime, timezone, timedelta
from backend.constants import (
    LOUNGE_ROOM_ID,
    SYSTEM_BOT_USER_ID,
    SYSTEM_BOT_NAME,
    LOUNGE_DISCOVERY_TRACKS,
)
from backend.models.user import User
from backend.models.room import Room
from backend.services.room_manager import room_manager
from backend.services.room_closer import schedule_room_close, _pending_close


def test_lounge_constants_integrity():
    """Verify backend discovery tracks and bot constants."""
    assert LOUNGE_ROOM_ID == "openjam-lounge"
    assert SYSTEM_BOT_USER_ID == "openjam-bot"
    assert SYSTEM_BOT_NAME == "OpenJam Bot"
    assert len(LOUNGE_DISCOVERY_TRACKS) >= 5
    for track in LOUNGE_DISCOVERY_TRACKS:
        assert "track_uri" in track
        assert "track_name" in track
        assert "artist" in track
        assert track["duration_ms"] > 0


def test_lounge_room_visible_even_when_empty(client, db_session):
    """Test that openjam-lounge is never pruned from list_rooms even with 0 listeners and old creation date."""
    bot_user = User(id=SYSTEM_BOT_USER_ID, display_name=SYSTEM_BOT_NAME)
    db_session.add(bot_user)
    db_session.commit()

    old_time = datetime.now(timezone.utc) - timedelta(hours=2)
    lounge = Room(
        id=LOUNGE_ROOM_ID,
        name="☕ 24/7 Lofi & Chill Lounge",
        host_user_id=SYSTEM_BOT_USER_ID,
        description="24/7 Lounge",
        genre_tags=json.dumps(["lofi", "chill"]),
        is_active=True,
        created_at=old_time,
    )
    db_session.add(lounge)
    db_session.commit()

    # Even with 0 listeners and age > 30s, lounge must be visible
    response = client.get("/rooms")
    assert response.status_code == 200
    data = response.json()
    assert len(data["rooms"]) == 1
    assert data["rooms"][0]["id"] == LOUNGE_ROOM_ID
    assert data["rooms"][0]["name"] == "☕ 24/7 Lofi & Chill Lounge"


def test_lounge_pinned_at_top_of_list(client, db_session, test_user):
    """Test that openjam-lounge is pinned to index 0 even when other rooms have higher listeners."""
    bot_user = User(id=SYSTEM_BOT_USER_ID, display_name=SYSTEM_BOT_NAME)
    db_session.add(bot_user)
    db_session.commit()

    lounge = Room(
        id=LOUNGE_ROOM_ID,
        name="☕ 24/7 Lofi & Chill Lounge",
        host_user_id=SYSTEM_BOT_USER_ID,
        description="24/7 Lounge",
        genre_tags=json.dumps(["lofi", "chill"]),
        is_active=True,
    )
    db_session.add(lounge)

    # Create active popular room
    popular_room = Room(
        id="popular-room",
        name="Popular Club",
        host_user_id=test_user.id,
        description="Lots of people",
        genre_tags=json.dumps(["edm"]),
        is_active=True,
    )
    db_session.add(popular_room)
    db_session.commit()

    # Simulate 5 listeners in popular room and 0 in lounge
    room_manager.join_room("popular-room", "u1", "s1", "User 1")
    room_manager.join_room("popular-room", "u2", "s2", "User 2")
    try:
        response = client.get("/rooms")
        assert response.status_code == 200
        data = response.json()
        assert len(data["rooms"]) == 2
        # Lounge must be pinned at index 0
        assert data["rooms"][0]["id"] == LOUNGE_ROOM_ID
        assert data["rooms"][1]["id"] == "popular-room"
    finally:
        room_manager.leave_room("s1")
        room_manager.leave_room("s2")


def test_lounge_room_closer_exempt():
    """Verify that schedule_room_close does not schedule a close task for openjam-lounge."""
    schedule_room_close(LOUNGE_ROOM_ID, sio=None, db_factory=None, delay=300)
    assert LOUNGE_ROOM_ID not in _pending_close


def test_lounge_room_capacity_extended():
    """Verify that openjam-lounge allows more than the default 10 listeners."""
    room_id = LOUNGE_ROOM_ID
    sids = []
    try:
        # Join 12 listeners into openjam-lounge
        for i in range(12):
            sid = f"s_lounge_{i}"
            uid = f"u_lounge_{i}"
            sids.append(sid)
            err, was_new = room_manager.join_room(room_id, uid, sid, f"Listener {i}", is_premium=False)
            assert err is None, f"Listener {i} should be allowed into 24/7 lounge"
        
        assert room_manager.get_listener_count(room_id) == 12
    finally:
        for s in sids:
            room_manager.leave_room(s)


def test_anonymous_guest_auth_default_moniker(client):
    """Test that POST /auth/join with empty display_name returns a Jammer-XXXX default."""
    response = client.post("/auth/join", json={})
    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert data["user"]["display_name"].startswith("Jammer-")
    assert "session_token" in response.cookies or "Set-Cookie" in response.headers


def test_duo_jam_room_creation(client, auth_headers):
    """Test creating a Duo Jam room with allow_guest_controls=True."""
    payload = {
        "name": "Velvet Sync #42",
        "description": "🎧 Duo Jam — real-time synced music for two.",
        "genre_tags": ["chill", "duo"],
        "queue_mode": "open",
        "password": None,
        "allow_guest_controls": True,
    }
    response = client.post("/rooms", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["room"]["name"] == "Velvet Sync #42"
    assert data["room"]["allow_guest_controls"] is True
    assert "duo" in data["room"]["genre_tags"]
