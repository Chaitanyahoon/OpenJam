"""Adversarial stress tests for OpenJam backend sockets, room manager, profile stats, and DB cascades.
Created by Challenger 2 (Backend, Sockets & DB Stress Challenger).
"""

import pytest
import time
import json
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

from backend.models.user import User
from backend.models.room import Room
from backend.models.queue_item import QueueItem
from backend.models.chat_message import ChatMessage
from backend.models.vote import Vote
from backend.models.like import UserLike
from backend.models.playlist import Playlist
from backend.models.listening_history import UserListeningHistory
from backend.models.room_visit import UserRoomVisit
from backend.services.room_manager import room_manager
from backend.sockets.trivia import register_trivia_handlers, generate_trivia_options


@pytest.fixture(autouse=True)
def reset_room_state():
    """Reset in-memory room store between tests."""
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


# ==============================================================================
# SECTION 1: ADVERSARIAL SOCKET & ROOM MANAGER TRIVIA STRESS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_adv_non_host_unauthorized_start_trivia_round():
    """Adversarial Test: Ensure non-host users are strictly rejected with trivia_error."""
    mock_sio = MagicMock()
    mock_sio.emit = AsyncMock()
    mock_sio.get_session = AsyncMock(return_value={"user_id": "u-guest", "display_name": "RogueGuest"})

    events = {}
    mock_sio.event = lambda fn: events.update({fn.__name__: fn}) or fn
    register_trivia_handlers(mock_sio)

    # Setup room with host and guest
    room_manager.join_room("room-adv-1", "u-host", "sid-host", "RealHost")
    room_manager.set_host("room-adv-1", "sid-host")
    room_manager.set_guest_controls("room-adv-1", False)

    room_manager.join_room("room-adv-1", "u-guest", "sid-guest", "RogueGuest")

    # Rogue guest attempts to start trivia round
    await events["start_trivia_round"]("sid-guest", {
        "room_id": "room-adv-1",
        "duration_sec": 10.0
    })

    # Verify rejection emitted specifically to sid-guest
    error_calls = [c for c in mock_sio.emit.call_args_list if c.args[0] == "trivia_error"]
    assert len(error_calls) == 1
    assert error_calls[0].kwargs.get("to") == "sid-guest"
    assert "Only the host" in error_calls[0].args[1]["message"]

    # Verify no trivia session was started
    state = room_manager.get_trivia_state("room-adv-1")
    assert state is None


def test_adv_duplicate_answer_rejection_in_single_round():
    """Adversarial Test: Ensure duplicate answers from same user are ignored and do not inflate score/streak."""
    room_manager.join_room("room-adv-dup", "u-spammer", "sid-spammer", "Spammer")
    room_manager.init_trivia_session(
        room_id="room-adv-dup",
        round_id="r-dup",
        correct_track={"track_name": "Song", "artist": "Artist"},
        options=[],
        duration_ms=10000,
        correct_option_id=2,
    )

    # First answer (correct)
    ans1 = room_manager.submit_trivia_answer("room-adv-dup", "r-dup", "u-spammer", 2, "Spammer")
    assert ans1 is not None
    assert ans1["is_correct"] is True
    assert ans1["streak"] == 1
    score1 = ans1["total_score"]
    assert score1 >= 500

    # Second answer attempt with correct option in same round
    ans2 = room_manager.submit_trivia_answer("room-adv-dup", "r-dup", "u-spammer", 2, "Spammer")
    assert ans2 is None

    # Third answer attempt with different option in same round
    ans3 = room_manager.submit_trivia_answer("room-adv-dup", "r-dup", "u-spammer", 0, "Spammer")
    assert ans3 is None

    # Verify state in room manager has only 1 answer record
    state = room_manager.get_trivia_state("room-adv-dup")
    assert len(state["answers"]) == 1
    assert state["scores"]["u-spammer"]["total_score"] == score1
    assert state["scores"]["u-spammer"]["streak"] == 1


def test_adv_timer_expiry_and_grace_period_boundaries():
    """Adversarial Test: Exact boundary condition testing for timer expiry (10s + 500ms grace)."""
    room_manager.join_room("room-adv-timer", "u-test", "sid-test", "Tester")

    # Case 1: Exact 10,499ms elapsed (< 10500ms limit -> accepted as correct)
    start_ts_valid = int(time.time() * 1000) - 10499
    room_manager.init_trivia_session(
        room_id="room-adv-timer",
        round_id="r-time-1",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=start_ts_valid,
        correct_option_id=1,
    )
    ans_valid = room_manager.submit_trivia_answer("room-adv-timer", "r-time-1", "u-test", 1, "Tester")
    assert ans_valid is not None
    assert ans_valid["is_correct"] is True
    assert ans_valid["round_points"] == 500  # Base points with 0 speed bonus

    # Case 2: 10,501ms elapsed (> 10500ms limit -> late rejection)
    start_ts_expired = int(time.time() * 1000) - 10501
    room_manager.init_trivia_session(
        room_id="room-adv-timer",
        round_id="r-time-2",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=start_ts_expired,
        correct_option_id=1,
    )
    ans_late = room_manager.submit_trivia_answer("room-adv-timer", "r-time-2", "u-test", 1, "Tester")
    assert ans_late is not None
    assert ans_late["is_correct"] is False
    assert ans_late["round_points"] == 0
    assert ans_late["streak"] == 0


def test_adv_speed_bonus_mathematical_bounds():
    """Adversarial Test: Verify exact mathematical bounds of the speed bonus algorithm.
    Formula: round_points = 500 + max(0, int((duration_ms - elapsed_ms) * 0.05))
    """
    room_manager.join_room("room-adv-speed", "u-speed", "sid-speed", "Speedy")

    # 1. 0ms answer -> 1000 pts
    ts_0 = int(time.time() * 1000)
    room_manager.init_trivia_session(
        room_id="room-adv-speed",
        round_id="r-spd-0",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=ts_0,
        correct_option_id=0,
    )
    ans_0 = room_manager.submit_trivia_answer("room-adv-speed", "r-spd-0", "u-speed", 0, "Speedy")
    assert ans_0["is_correct"] is True
    assert ans_0["round_points"] == 1000

    # 2. 5000ms answer -> 750 pts
    ts_5000 = int(time.time() * 1000) - 5000
    room_manager.init_trivia_session(
        room_id="room-adv-speed",
        round_id="r-spd-5000",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=ts_5000,
        correct_option_id=0,
    )
    ans_5000 = room_manager.submit_trivia_answer("room-adv-speed", "r-spd-5000", "u-speed", 0, "Speedy")
    assert ans_5000["is_correct"] is True
    assert ans_5000["round_points"] == 750

    # 3. 9999ms answer -> 500 pts
    ts_9999 = int(time.time() * 1000) - 9999
    room_manager.init_trivia_session(
        room_id="room-adv-speed",
        round_id="r-spd-9999",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=ts_9999,
        correct_option_id=0,
    )
    ans_9999 = room_manager.submit_trivia_answer("room-adv-speed", "r-spd-9999", "u-speed", 0, "Speedy")
    assert ans_9999["is_correct"] is True
    assert ans_9999["round_points"] == 500

    # 4. Incorrect answer at 0ms -> 0 pts
    room_manager.init_trivia_session(
        room_id="room-adv-speed",
        round_id="r-spd-wrong",
        correct_track={"track_name": "S", "artist": "A"},
        options=[],
        duration_ms=10000,
        start_timestamp=ts_0,
        correct_option_id=0,
    )
    ans_wrong = room_manager.submit_trivia_answer("room-adv-speed", "r-spd-wrong", "u-speed", 1, "Speedy")
    assert ans_wrong["is_correct"] is False
    assert ans_wrong["round_points"] == 0


def test_adv_consecutive_streaks_and_cumulative_score_reset():
    """Adversarial Test: Verify streak increment, reset on wrong answer, and cumulative total score."""
    room_manager.join_room("room-streak", "u-player", "sid-p", "Player")

    # Round 1: Correct (800 pts) -> Streak 1, Total 800
    ts_1 = int(time.time() * 1000) - 4000  # 6000ms left -> +300 bonus = 800 pts
    room_manager.init_trivia_session("room-streak", "r1", {}, [], start_timestamp=ts_1, correct_option_id=0)
    a1 = room_manager.submit_trivia_answer("room-streak", "r1", "u-player", 0, "Player")
    assert a1["round_points"] == 800
    assert a1["streak"] == 1
    assert a1["total_score"] == 800

    # Round 2: Correct (700 pts) -> Streak 2, Total 1500
    ts_2 = int(time.time() * 1000) - 6000  # 4000ms left -> +200 bonus = 700 pts
    room_manager.init_trivia_session("room-streak", "r2", {}, [], start_timestamp=ts_2, correct_option_id=2)
    a2 = room_manager.submit_trivia_answer("room-streak", "r2", "u-player", 2, "Player")
    assert a2["round_points"] == 700
    assert a2["streak"] == 2
    assert a2["total_score"] == 1500

    # Round 3: Incorrect (0 pts) -> Streak Reset to 0, Total Remains 1500
    room_manager.init_trivia_session("room-streak", "r3", {}, [], correct_option_id=3)
    a3 = room_manager.submit_trivia_answer("room-streak", "r3", "u-player", 1, "Player")
    assert a3["round_points"] == 0
    assert a3["streak"] == 0
    assert a3["total_score"] == 1500

    # Round 4: Correct (600 pts) -> Streak 1, Total 2100
    ts_4 = int(time.time() * 1000) - 8000  # 2000ms left -> +100 bonus = 600 pts
    room_manager.init_trivia_session("room-streak", "r4", {}, [], start_timestamp=ts_4, correct_option_id=1)
    a4 = room_manager.submit_trivia_answer("room-streak", "r4", "u-player", 1, "Player")
    assert a4["round_points"] == 600
    assert a4["streak"] == 1
    assert a4["total_score"] == 2100


# ==============================================================================
# SECTION 2: STATS, BADGE BOUNDARIES & DB CASCADE TESTS
# ==============================================================================

def test_adv_milestone_badge_exact_boundary_conditions(client, auth_headers, test_user, test_room, db_session):
    """Adversarial Test: Milestone badge boundary conditions (target - 1 vs exact target)."""
    from backend.routes.profile import get_user_stats_internal

    # 1. Test Audiophile Novice (listener_100): 99 mins (5,940,000ms) vs 100 mins (6,000,000ms)
    # Add 99 mins
    h_99 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t99",
        track_name="Song 99",
        artist="Artist",
        duration_ms=5940000
    )
    db_session.add(h_99)
    db_session.commit()

    stats_99 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_99 = {b["id"]: b for b in stats_99["milestone_badges"]}
    assert badge_99["listener_100"]["unlocked"] is False
    assert badge_99["listener_100"]["progress"] == 99

    # Add 1 more min (60,000ms) -> exactly 100 mins
    h_1 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t1",
        track_name="Song 1",
        artist="Artist",
        duration_ms=60000
    )
    db_session.add(h_1)
    db_session.commit()

    stats_100 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_100 = {b["id"]: b for b in stats_100["milestone_badges"]}
    assert badge_100["listener_100"]["unlocked"] is True
    assert badge_100["listener_100"]["progress"] == 100

    # 2. Test Vibe Selector (dj_curator): 19 songs vs 20 songs
    for i in range(19):
        db_session.add(QueueItem(
            room_id=test_room.id,
            track_uri=f"q_{i}",
            track_name=f"Q {i}",
            artist="A",
            added_by_user_id=test_user.id,
            duration_ms=60000
        ))
    db_session.commit()

    stats_q19 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_q19 = {b["id"]: b for b in stats_q19["milestone_badges"]}
    assert badge_q19["dj_curator"]["unlocked"] is False
    assert badge_q19["dj_curator"]["progress"] == 19

    # Add 20th song
    db_session.add(QueueItem(
        room_id=test_room.id,
        track_uri="q_20",
        track_name="Q 20",
        artist="A",
        added_by_user_id=test_user.id,
        duration_ms=60000
    ))
    db_session.commit()

    stats_q20 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_q20 = {b["id"]: b for b in stats_q20["milestone_badges"]}
    assert badge_q20["dj_curator"]["unlocked"] is True
    assert badge_q20["dj_curator"]["progress"] == 20

    # 3. Test Community Voice (chat_spark): 49 chats vs 50 chats
    for i in range(49):
        db_session.add(ChatMessage(
            room_id=test_room.id,
            user_id=test_user.id,
            user_name=test_user.display_name,
            content=f"msg {i}"
        ))
    db_session.commit()

    stats_c49 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_c49 = {b["id"]: b for b in stats_c49["milestone_badges"]}
    assert badge_c49["chat_spark"]["unlocked"] is False
    assert badge_c49["chat_spark"]["progress"] == 49

    db_session.add(ChatMessage(
        room_id=test_room.id,
        user_id=test_user.id,
        user_name=test_user.display_name,
        content="msg 50"
    ))
    db_session.commit()

    stats_c50 = get_user_stats_internal(db_session, test_user.id)["stats"]
    badge_c50 = {b["id"]: b for b in stats_c50["milestone_badges"]}
    assert badge_c50["chat_spark"]["unlocked"] is True
    assert badge_c50["chat_spark"]["progress"] == 50


def test_adv_7day_activity_chart_boundary_transitions(client, auth_headers, test_user, test_room, db_session):
    """Adversarial Test: Verify 7-day chart behavior at day boundaries and >7 day drop-offs."""
    from backend.routes.profile import get_user_stats_internal

    now_utc = datetime.now(timezone.utc)
    today_midnight = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

    # 1. Entry 8 days ago (beyond 7-day window) -> Should be excluded from chart
    h_old = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t_old",
        track_name="Old Jam",
        artist="Artist",
        duration_ms=600000,  # 10 mins
        created_at=today_midnight - timedelta(days=8)
    )

    # 2. Entry at exactly 6 days ago (boundary start of 7-day window) -> Included
    h_boundary_start = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t_bstart",
        track_name="Boundary Start",
        artist="Artist",
        duration_ms=180000,  # 3 mins
        created_at=today_midnight - timedelta(days=6) + timedelta(minutes=5)
    )

    # 3. Entry at yesterday 23:59:59 UTC -> Correctly assigned to yesterday
    h_yesterday_end = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t_yend",
        track_name="Yesterday Late",
        artist="Artist",
        duration_ms=240000,  # 4 mins
        created_at=today_midnight - timedelta(seconds=1)
    )

    # 4. Entry today 00:00:01 UTC -> Correctly assigned to today
    h_today_start = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t_tstart",
        track_name="Today Early",
        artist="Artist",
        duration_ms=300000,  # 5 mins
        created_at=today_midnight + timedelta(seconds=1)
    )

    db_session.add_all([h_old, h_boundary_start, h_yesterday_end, h_today_start])
    db_session.commit()

    stats = get_user_stats_internal(db_session, test_user.id)["stats"]
    chart = stats["activity_chart"]
    assert len(chart) == 7

    chart_dict = {item["date"]: item["minutes"] for item in chart}
    today_str = today_midnight.strftime("%Y-%m-%d")
    yesterday_str = (today_midnight - timedelta(days=1)).strftime("%Y-%m-%d")
    day6_ago_str = (today_midnight - timedelta(days=6)).strftime("%Y-%m-%d")

    assert chart_dict[today_str] == 5
    assert chart_dict[yesterday_str] == 4
    assert chart_dict[day6_ago_str] == 3


def test_adv_foreign_key_cascade_deletion_on_user(db_session):
    """Adversarial Test: Verify deleting a User cascades to user_listening_history and user_room_visits."""
    # Create test user
    u = User(display_name="Cascade User", discord_id="disc_cascade_123")
    r = Room(name="Cascade Room", host_user_id="other_host")
    db_session.add_all([u, r])
    db_session.commit()
    user_id = u.id
    room_id = r.id

    # Add Listening History and Room Visit
    lh = UserListeningHistory(
        user_id=user_id,
        room_id=room_id,
        track_uri="uri1",
        track_name="Track",
        artist="Artist",
        duration_ms=100000
    )
    rv = UserRoomVisit(
        user_id=user_id,
        room_id=room_id
    )
    u.listening_history.append(lh)
    u.room_visits.append(rv)
    db_session.commit()

    # Verify records exist
    assert db_session.query(UserListeningHistory).filter(UserListeningHistory.user_id == user_id).count() == 1
    assert db_session.query(UserRoomVisit).filter(UserRoomVisit.user_id == user_id).count() == 1

    # Delete User
    db_session.delete(u)
    db_session.commit()

    # Verify foreign key cascade deleted both records
    assert db_session.query(UserListeningHistory).filter(UserListeningHistory.user_id == user_id).count() == 0
    assert db_session.query(UserRoomVisit).filter(UserRoomVisit.user_id == user_id).count() == 0


def test_adv_room_deletion_set_null_and_cascade(db_session):
    """Adversarial Test: Verify deleting a Room sets room_id NULL on UserListeningHistory and cascades UserRoomVisit."""
    u = User(display_name="Room Del User", discord_id="disc_rdel_456")
    r = Room(name="Deletable Room", host_user_id="other_host")
    db_session.add_all([u, r])
    db_session.commit()
    user_id = u.id
    room_id = r.id

    lh = UserListeningHistory(
        user_id=user_id,
        room_id=room_id,
        track_uri="uri_setnull",
        track_name="Track",
        artist="Artist",
        duration_ms=100000
    )
    rv = UserRoomVisit(
        user_id=user_id,
        room_id=room_id
    )
    r.listening_history.append(lh)
    r.room_visits.append(rv)
    db_session.commit()

    # Delete Room
    db_session.delete(r)
    db_session.commit()

    # UserListeningHistory should still exist, with room_id set to NULL
    remaining_lh = db_session.query(UserListeningHistory).filter(UserListeningHistory.user_id == user_id).first()
    assert remaining_lh is not None
    assert remaining_lh.room_id is None

    # UserRoomVisit should be deleted (CASCADE)
    remaining_rv = db_session.query(UserRoomVisit).filter(UserRoomVisit.user_id == user_id).first()
    assert remaining_rv is None
