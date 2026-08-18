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
