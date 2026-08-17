"""Unit and integration tests for OpenJam Music Trivia Mini-Game and Image Proxy."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.room_manager import room_manager
from backend.sockets.trivia import generate_trivia_options, register_trivia_handlers, CURATED_TRIVIA_TRACKS


@pytest.fixture(autouse=True)
def reset_room_store():
    """Reset the room manager store before and after each test."""
    def _clear():
        if room_manager.store.client:
            keys = room_manager.store.client.keys("openjam:*")
            if keys:
                room_manager.store.client.delete(*keys)
        else:
            room_manager.store._rooms.clear()
            room_manager.store._sid_map.clear()
            room_manager.store._recently_left.clear()

    _clear()
    yield
    _clear()


# ─── 1. ROOM MANAGER TRIVIA STATE LIFECYCLE TESTS ───────────────────────────

def test_trivia_session_init_and_state():
    """Test initializing a trivia session in RoomManager."""
    room_manager.join_room("room-t1", "user-host", "sid-host", "HostUser")
    room_manager.set_host("room-t1", "sid-host")

    correct_track = {
        "track_name": "Blinding Lights",
        "artist": "The Weeknd",
        "track_uri": "fHI8X4OX3Lw",
        "album_art_url": "https://example.com/art.jpg",
    }
    options = [
        {"id": 0, "title": "Sweater Weather", "artist": "The Neighbourhood"},
        {"id": 1, "title": "Blinding Lights", "artist": "The Weeknd"},
        {"id": 2, "title": "Starboy", "artist": "The Weeknd"},
        {"id": 3, "title": "Do I Wanna Know?", "artist": "Arctic Monkeys"},
    ]

    state = room_manager.init_trivia_session(
        room_id="room-t1",
        round_id="tr_round_1",
        correct_track=correct_track,
        options=options,
        duration_ms=10000,
        correct_option_id=1,
    )

    assert state is not None
    assert state["active"] is True
    assert state["round_id"] == "tr_round_1"
    assert state["round_number"] == 1
    assert state["correct_option_id"] == 1
    assert state["duration_ms"] == 10000

    stored = room_manager.get_trivia_state("room-t1")
    assert stored is not None
    assert stored["round_id"] == "tr_round_1"


def test_trivia_answer_scoring_and_speed_bonus():
    """Test trivia answer scoring formula with latency speed bonus."""
    room_manager.join_room("room-t2", "u-alice", "sid-alice", "Alice")
    room_manager.join_room("room-t2", "u-bob", "sid-bob", "Bob")

    correct_track = {"track_name": "Starboy", "artist": "The Weeknd"}
    options = [
        {"id": 0, "title": "Starboy", "artist": "The Weeknd"},
        {"id": 1, "title": "Bad Guy", "artist": "Billie Eilish"},
        {"id": 2, "title": "Heat Waves", "artist": "Glass Animals"},
        {"id": 3, "title": "Levitating", "artist": "Dua Lipa"},
    ]

    start_ts = int(time.time() * 1000)
    room_manager.init_trivia_session(
        room_id="room-t2",
        round_id="tr_round_speed",
        correct_track=correct_track,
        options=options,
        duration_ms=10000,
        start_timestamp=start_ts,
        correct_option_id=0,
    )

    # 1. Fast answer (simulated by start_ts being close to now)
    ans_alice = room_manager.submit_trivia_answer(
        room_id="room-t2",
        round_id="tr_round_speed",
        user_id="u-alice",
        option_id=0,
        display_name="Alice",
    )
    assert ans_alice is not None
    assert ans_alice["is_correct"] is True
    # Fast answer should be in 500-1000 range
    assert 500 <= ans_alice["round_points"] <= 1000
    assert ans_alice["streak"] == 1

    # 2. Incorrect answer
    ans_bob = room_manager.submit_trivia_answer(
        room_id="room-t2",
        round_id="tr_round_speed",
        user_id="u-bob",
        option_id=1,
        display_name="Bob",
    )
    assert ans_bob is not None
    assert ans_bob["is_correct"] is False
    assert ans_bob["round_points"] == 0
    assert ans_bob["streak"] == 0


def test_trivia_duplicate_answer_ignored():
    """Test that a listener cannot submit multiple answers in the same round."""
    room_manager.join_room("room-t3", "u-1", "sid-1", "Charlie")
    room_manager.init_trivia_session(
        room_id="room-t3",
        round_id="tr_round_dup",
        correct_track={"track_name": "Test", "artist": "Artist"},
        options=[],
        duration_ms=10000,
        correct_option_id=2,
    )

    first = room_manager.submit_trivia_answer("room-t3", "tr_round_dup", "u-1", 2, "Charlie")
    assert first is not None

    second = room_manager.submit_trivia_answer("room-t3", "tr_round_dup", "u-1", 0, "Charlie")
    assert second is None


def test_trivia_late_answer_rejected():
    """Test that answers submitted after countdown + grace period receive 0 points."""
    room_manager.join_room("room-t4", "u-late", "sid-late", "Dave")
    # Start timestamp in the past (12 seconds ago)
    past_start_ts = int(time.time() * 1000) - 12000

    room_manager.init_trivia_session(
        room_id="room-t4",
        round_id="tr_round_late",
        correct_track={"track_name": "Song", "artist": "Band"},
        options=[],
        duration_ms=10000,
        start_timestamp=past_start_ts,
        correct_option_id=1,
    )

    ans = room_manager.submit_trivia_answer("room-t4", "tr_round_late", "u-late", 1, "Dave")
    assert ans is not None
    assert ans["is_correct"] is False
    assert ans["round_points"] == 0


def test_trivia_multi_round_streaks_and_leaderboard():
    """Test cumulative scores, streak tracking, and sorted leaderboard across rounds."""
    room_manager.join_room("room-t5", "u-1", "s-1", "Player1")
    room_manager.join_room("room-t5", "u-2", "s-2", "Player2")

    # Round 1
    room_manager.init_trivia_session(
        room_id="room-t5",
        round_id="r1",
        correct_track={"track_name": "Song 1", "artist": "A1"},
        options=[],
        correct_option_id=0,
    )
    room_manager.submit_trivia_answer("room-t5", "r1", "u-1", 0, "Player1")
    room_manager.submit_trivia_answer("room-t5", "r1", "u-2", 0, "Player2")
    end_r1 = room_manager.end_trivia_round("room-t5", "r1")

    assert end_r1["leaderboard"][0]["streak"] == 1
    assert end_r1["leaderboard"][1]["streak"] == 1

    # Round 2
    room_manager.init_trivia_session(
        room_id="room-t5",
        round_id="r2",
        correct_track={"track_name": "Song 2", "artist": "A2"},
        options=[],
        correct_option_id=3,
    )
    # Player1 gets it right again, Player2 gets it wrong
    room_manager.submit_trivia_answer("room-t5", "r2", "u-1", 3, "Player1")
    room_manager.submit_trivia_answer("room-t5", "r2", "u-2", 1, "Player2")
    end_r2 = room_manager.end_trivia_round("room-t5", "r2")

    lb = end_r2["leaderboard"]
    assert lb[0]["user_id"] == "u-1"
    assert lb[0]["streak"] == 2
    assert lb[0]["rank"] == 1

    p2 = [u for u in lb if u["user_id"] == "u-2"][0]
    assert p2["streak"] == 0
    assert p2["rank"] == 2

    # Clear session
    cleared = room_manager.clear_trivia_session("room-t5")
    assert cleared is not None
    assert room_manager.get_trivia_state("room-t5") is None


# ─── 2. DECOY GENERATION TESTS ──────────────────────────────────────────────

def test_generate_trivia_options_distinct_and_correct():
    """Test that generate_trivia_options generates 4 distinct options with 1 correct answer."""
    correct_track = {
        "track_name": "Midnight City",
        "artist": "M83",
    }
    candidate_decoys = [
        {"track_name": "Resonance", "artist": "HOME"},
        {"track_name": "Instant Crush", "artist": "Daft Punk"},
    ]

    options, correct_id = generate_trivia_options(correct_track, candidate_decoys)

    assert len(options) == 4
    option_titles = [opt["title"].lower() for opt in options]
    # Check all options are distinct
    assert len(set(option_titles)) == 4
    # Check correct option matches
    assert options[correct_id]["title"].lower() == "midnight city"
    assert options[correct_id]["artist"].lower() == "m83"


# ─── 3. IMAGE PROXY ROUTE & CORS TESTS ─────────────────────────────────────

def test_proxy_image_cors_headers(client: TestClient):
    """Test that /api/proxy/image endpoint sets Access-Control-Allow-Origin: *."""
    # Test OPTIONS preflight
    options_res = client.options("/api/proxy/image")
    assert options_res.status_code == 204
    assert options_res.headers.get("access-control-allow-origin") == "*"

    # Test invalid / missing url
    bad_res = client.get("/api/proxy/image")
    assert bad_res.status_code == 422 or bad_res.status_code == 400

    # Test SSRF block on localhost
    ssrf_res = client.get("/api/proxy/image?url=http://localhost:8000/secret")
    assert ssrf_res.status_code == 403
    assert ssrf_res.headers.get("access-control-allow-origin") == "*"


@pytest.mark.asyncio
async def test_proxy_image_successful_fetch():
    """Test that /api/proxy/image successfully proxies valid remote images."""
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b"fake-image-bytes"
        mock_resp.headers = {"content-type": "image/jpeg"}
        mock_get.return_value = mock_resp

        client = TestClient(app)
        res = client.get("/api/proxy/image?url=https://is1-ssl.mzstatic.com/image/thumb/test.jpg")

        assert res.status_code == 200
        assert res.content == b"fake-image-bytes"
        assert res.headers.get("access-control-allow-origin") == "*"
        assert res.headers.get("content-type") == "image/jpeg"


# ─── 4. SOCKET EVENT HANDLERS AND HOST PERMISSIONS ─────────────────────────

@pytest.mark.asyncio
async def test_trivia_socket_lifecycle_and_host_validation():
    """Test Socket.IO trivia handlers for start, submit, and end events."""
    mock_sio = MagicMock()
    mock_sio.emit = AsyncMock()
    mock_sio.get_session = AsyncMock(return_value={"user_id": "u-host", "display_name": "HostUser"})

    # Setup room with host
    room_manager.join_room("room-sock", "u-host", "sid-host", "HostUser")
    room_manager.set_host("room-sock", "sid-host")

    # Register handlers on mock server
    registered_events = {}

    def mock_event(func):
        registered_events[func.__name__] = func
        return func

    mock_sio.event = mock_event
    register_trivia_handlers(mock_sio)

    assert "start_trivia_round" in registered_events
    assert "trivia_submit_answer" in registered_events
    assert "end_trivia_session" in registered_events

    # 1. Non-host attempt should be rejected
    room_manager.join_room("room-sock", "u-guest", "sid-guest", "Guest")
    await registered_events["start_trivia_round"]("sid-guest", {"room_id": "room-sock"})
    assert any(call.args[0] == "trivia_error" for call in mock_sio.emit.call_args_list)

    # 2. Host starts trivia round
    mock_sio.emit.reset_mock()
    await registered_events["start_trivia_round"]("sid-host", {
        "room_id": "room-sock",
        "duration_sec": 10.0,
        "correct_track": {"track_name": "Blinding Lights", "artist": "The Weeknd"},
    })

    # Verify trivia_round_started broadcast
    start_calls = [c for c in mock_sio.emit.call_args_list if c.args[0] == "trivia_round_started"]
    assert len(start_calls) == 1
    round_payload = start_calls[0].args[1]
    assert "round_id" in round_payload
    assert len(round_payload["options"]) == 4
    # Ensure correct_option_id is NOT leaked in broadcast payload
    assert "correct_option_id" not in round_payload

    # 3. Guest submits an answer
    mock_sio.get_session = AsyncMock(return_value={"user_id": "u-guest", "display_name": "Guest"})
    await registered_events["trivia_submit_answer"]("sid-guest", {
        "room_id": "room-sock",
        "round_id": round_payload["round_id"],
        "option_id": 0,
    })

    user_answered_calls = [c for c in mock_sio.emit.call_args_list if c.args[0] == "trivia_user_answered"]
    assert len(user_answered_calls) == 1

    # 4. Host ends trivia session
    await registered_events["end_trivia_session"]("sid-host", {"room_id": "room-sock"})
    end_calls = [c for c in mock_sio.emit.call_args_list if c.args[0] == "trivia_session_ended"]
    assert len(end_calls) == 1
