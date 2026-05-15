"""Tests for in-memory room state used by Socket.IO handlers."""

import pytest

from backend.services.room_manager import room_manager


@pytest.fixture(autouse=True)
def reset_room_manager():
    room_manager._rooms.clear()
    room_manager._sid_map.clear()
    yield
    room_manager._rooms.clear()
    room_manager._sid_map.clear()


def test_join_and_leave_room_updates_listener_count():
    room_manager.join_room("room-1", "user-1", "sid-1", "Ava")
    room_manager.join_room("room-1", "user-2", "sid-2", "Ben")

    assert room_manager.get_listener_count("room-1") == 2
    assert room_manager.get_active_room_ids() == ["room-1"]

    left = room_manager.leave_room("sid-1")

    assert left == {"user_id": "user-1", "room_id": "room-1"}
    assert room_manager.get_listener_count("room-1") == 1


def test_last_listener_leave_removes_room_state():
    room_manager.join_room("room-1", "user-1", "sid-1", "Ava")

    room_manager.leave_room("sid-1")

    assert room_manager.get_listener_count("room-1") == 0
    assert room_manager.get_active_room_ids() == []


def test_playback_skip_votes_are_serialized():
    room_manager.join_room("room-1", "user-1", "sid-1", "Ava")
    room_manager.update_playback(
        room_id="room-1",
        track_uri="track-1",
        track_name="Track One",
        artist="Artist",
        album_art_url=None,
        position_ms=0,
        duration_ms=1000,
        is_playing=True,
    )

    assert room_manager.add_skip_vote("room-1", "user-1") is True
    assert room_manager.add_skip_vote("room-1", "user-1") is False

    playback = room_manager.get_playback("room-1")
    assert playback["skip_voters"] == ["user-1"]
