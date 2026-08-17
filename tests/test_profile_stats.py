"""Tests for profile statistics routes and aggregator."""

import pytest
import json
from datetime import datetime, timezone, timedelta
from backend.models.queue_item import QueueItem
from backend.models.like import UserLike
from backend.models.playlist import Playlist
from backend.models.chat_message import ChatMessage
from backend.models.vote import Vote
from backend.models.room import Room
from backend.models.listening_history import UserListeningHistory
from backend.models.room_visit import UserRoomVisit


def test_get_my_stats_unauthenticated(client):
    """Test getting profile stats when not signed in."""
    response = client.get("/profile/me/stats")
    assert response.status_code == 401


def test_get_my_stats_authenticated_empty(client, auth_headers, test_user):
    """Test getting profile stats when user has no activity yet."""
    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "stats" in data
    stats = data["stats"]
    assert stats["total_queued"] == 0
    assert stats["total_likes"] == 0
    assert stats["total_playlists"] == 0
    assert stats["total_chats"] == 0
    assert stats["total_votes"] == 0
    assert stats["listening_time_mins"] == 0
    assert stats["total_rooms_visited"] == 0
    assert stats["rooms_hosted"] == 0
    assert len(stats["top_tracks"]) == 0
    assert len(stats["top_artists"]) == 0
    assert len(stats["top_genres"]) == 0

    # Verify 7-day activity chart structure
    assert "activity_chart" in stats
    assert len(stats["activity_chart"]) == 7
    for item in stats["activity_chart"]:
        assert "date" in item
        assert "day" in item
        assert item["minutes"] == 0

    # Verify milestone badges
    assert "milestone_badges" in stats
    assert len(stats["milestone_badges"]) == 7
    for badge in stats["milestone_badges"]:
        assert "id" in badge
        assert "title" in badge
        assert "tier" in badge
        assert "unlocked" in badge
        assert badge["unlocked"] is False


def test_get_public_stats_not_found(client, auth_headers):
    """Test public stats with a non-existent user ID."""
    response = client.get("/profile/non-existent-user-id/stats", headers=auth_headers)
    assert response.status_code == 403


def test_get_profile_stats_with_data(client, auth_headers, test_user, test_room, db_session):
    """Test that profile stats aggregate database entries correctly."""
    test_user.discord_id = "discord_12345"
    db_session.commit()

    # 1. Add Liked song
    like = UserLike(user_id=test_user.id, track_uri="track_1", track_name="Song A", artist="Artist X")
    db_session.add(like)

    # 2. Add Playlist
    playlist = Playlist(name="My Stats Playlist", creator_id=test_user.id)
    db_session.add(playlist)

    # 3. Add Chat message
    chat = ChatMessage(room_id=test_room.id, user_id=test_user.id, user_name=test_user.display_name, content="Hello stats!")
    db_session.add(chat)

    # 4. Add QueueItem (played - contributes to listening time)
    played_item = QueueItem(
        room_id=test_room.id,
        track_uri="track_2",
        track_name="Song B",
        artist="Artist Y",
        duration_ms=180000,  # 3 mins
        added_by_user_id=test_user.id,
        status="played"
    )
    db_session.add(played_item)

    # 5. Add QueueItem (pending - doesn't count towards listening time but counts for queue/artists/tracks stats)
    pending_item = QueueItem(
        room_id=test_room.id,
        track_uri="track_2",
        track_name="Song B",
        artist="Artist Y",
        duration_ms=120000,
        added_by_user_id=test_user.id,
        status="pending"
    )
    db_session.add(pending_item)
    db_session.commit()

    # Query statistics (private me/stats)
    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    stats = data["stats"]

    assert stats["total_queued"] == 2
    assert stats["total_likes"] == 1
    assert stats["total_playlists"] == 1
    assert stats["total_chats"] == 1
    assert stats["listening_time_mins"] == 3

    # Verify Top Tracks/Artists list calculations
    assert len(stats["top_tracks"]) == 1
    assert stats["top_tracks"][0]["track_name"] == "Song B"
    assert stats["top_tracks"][0]["count"] == 2

    assert len(stats["top_artists"]) == 1
    assert stats["top_artists"][0]["artist"] == "Artist Y"

    # Query statistics (public stats)
    pub_response = client.get(f"/profile/{test_user.id}/stats", headers=auth_headers)
    assert pub_response.status_code == 200
    pub_data = pub_response.json()
    assert pub_data["stats"]["total_queued"] == 2

    # Query statistics without headers (unauthenticated)
    unauth_response = client.get(f"/profile/{test_user.id}/stats")
    assert unauth_response.status_code == 401


def test_user_listening_history_model(db_session, test_user, test_room):
    """Test UserListeningHistory model creation and to_dict method."""
    history_entry = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="spotify:track:xyz",
        track_name="Resonance",
        artist="HOME",
        album_art_url="https://example.com/art.jpg",
        genre="synthwave",
        duration_ms=212000
    )
    db_session.add(history_entry)
    db_session.commit()
    db_session.refresh(history_entry)

    assert history_entry.id is not None
    d = history_entry.to_dict()
    assert d["user_id"] == test_user.id
    assert d["track_name"] == "Resonance"
    assert d["artist"] == "HOME"
    assert d["genre"] == "synthwave"
    assert d["duration_ms"] == 212000
    assert d["created_at"] is not None


def test_user_room_visit_model(db_session, test_user, test_room):
    """Test UserRoomVisit model creation and to_dict method."""
    visit = UserRoomVisit(
        user_id=test_user.id,
        room_id=test_room.id
    )
    db_session.add(visit)
    db_session.commit()
    db_session.refresh(visit)

    assert visit.id is not None
    d = visit.to_dict()
    assert d["user_id"] == test_user.id
    assert d["room_id"] == test_room.id
    assert d["created_at"] is not None


def test_dual_listening_time_and_rooms_visited(client, auth_headers, test_user, test_room, db_session):
    """Test dual-source listening time and total_rooms_visited aggregation."""
    # 1. Add played QueueItem: 240,000 ms = 4 mins
    queue_item = QueueItem(
        room_id=test_room.id,
        track_uri="track_q1",
        track_name="Queue Track",
        artist="Queue Artist",
        duration_ms=240000,
        added_by_user_id=test_user.id,
        status="played"
    )
    db_session.add(queue_item)

    # 2. Add UserListeningHistory: 180,000 ms = 3 mins
    listen_entry = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="track_h1",
        track_name="History Track",
        artist="History Artist",
        genre="electronic",
        duration_ms=180000
    )
    db_session.add(listen_entry)

    # 3. Add room visits to other rooms
    extra_room = Room(name="Extra Room", host_user_id="other_user_id", genre_tags=json.dumps(["lofi"]))
    db_session.add(extra_room)
    db_session.commit()

    visit1 = UserRoomVisit(user_id=test_user.id, room_id=test_room.id)
    visit2 = UserRoomVisit(user_id=test_user.id, room_id=extra_room.id)
    db_session.add_all([visit1, visit2])
    db_session.commit()

    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    stats = response.json()["stats"]

    # 4 mins + 3 mins = 7 mins
    assert stats["listening_time_mins"] == 7
    # 2 distinct visited rooms + 1 hosted room (test_room) = 2 unique rooms
    assert stats["total_rooms_visited"] == 2


def test_7_day_activity_chart_aggregation(client, auth_headers, test_user, test_room, db_session):
    """Test 7-day daily listening minutes time-series aggregation."""
    now = datetime.now(timezone.utc)
    today_dt = datetime(now.year, now.month, now.day, 12, 0, 0, tzinfo=timezone.utc)
    two_days_ago = today_dt - timedelta(days=2)

    # Entry today: 120,000 ms = 2 mins
    h1 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t1",
        track_name="Track 1",
        artist="Artist 1",
        duration_ms=120000,
        created_at=today_dt
    )
    # Entry 2 days ago: 300,000 ms = 5 mins
    h2 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t2",
        track_name="Track 2",
        artist="Artist 2",
        duration_ms=300000,
        created_at=two_days_ago
    )
    db_session.add_all([h1, h2])
    db_session.commit()

    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    chart = response.json()["stats"]["activity_chart"]

    assert len(chart) == 7
    today_str = today_dt.strftime("%Y-%m-%d")
    two_days_ago_str = two_days_ago.strftime("%Y-%m-%d")

    chart_dict = {item["date"]: item["minutes"] for item in chart}
    assert chart_dict.get(today_str) == 2
    assert chart_dict.get(two_days_ago_str) == 5


def test_top_genres_percentage_distribution(client, auth_headers, test_user, test_room, db_session):
    """Test top genres aggregation and percentage distribution normalization."""
    h1 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t1",
        track_name="Track 1",
        artist="Artist 1",
        genre="synthwave",
        duration_ms=60000
    )
    h2 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t2",
        track_name="Track 2",
        artist="Artist 2",
        genre="synthwave",
        duration_ms=60000
    )
    h3 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t3",
        track_name="Track 3",
        artist="Artist 3",
        genre="synthwave",
        duration_ms=60000
    )
    h4 = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t4",
        track_name="Track 4",
        artist="Artist 4",
        genre="lo-fi",
        duration_ms=60000
    )
    db_session.add_all([h1, h2, h3, h4])
    db_session.commit()

    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    top_genres = response.json()["stats"]["top_genres"]

    assert len(top_genres) >= 2
    genre_names = [g["genre"] for g in top_genres]
    assert "synthwave" in genre_names
    assert "lo-fi" in genre_names

    synth_item = next(g for g in top_genres if g["genre"] == "synthwave")
    lofi_item = next(g for g in top_genres if g["genre"] == "lo-fi")

    assert synth_item["count"] == 3
    assert synth_item["percentage"] == 75
    assert lofi_item["count"] == 1
    assert lofi_item["percentage"] == 25


def test_milestone_badges_unlocking(client, auth_headers, test_user, test_room, db_session):
    """Test milestone badge threshold evaluation engine."""
    # 1. Add listening time > 100 mins (6,600,000 ms = 110 mins)
    h = UserListeningHistory(
        user_id=test_user.id,
        room_id=test_room.id,
        track_uri="t1",
        track_name="Long Jam",
        artist="Jam Artist",
        duration_ms=6600000
    )
    db_session.add(h)

    # 2. Add 10 room visits to 10 distinct rooms
    for i in range(10):
        room = Room(name=f"Room {i}", host_user_id="other_user")
        db_session.add(room)
        db_session.flush()
        db_session.add(UserRoomVisit(user_id=test_user.id, room_id=room.id))

    # 3. Add 20 queued songs
    for i in range(20):
        db_session.add(QueueItem(
            room_id=test_room.id,
            track_uri=f"queue_{i}",
            track_name=f"Queue Song {i}",
            artist="Queue Artist",
            added_by_user_id=test_user.id,
            duration_ms=60000
        ))

    # 4. Add 50 chat messages
    for i in range(50):
        db_session.add(ChatMessage(
            room_id=test_room.id,
            user_id=test_user.id,
            user_name=test_user.display_name,
            content=f"Chat {i}"
        ))

    db_session.commit()

    response = client.get("/profile/me/stats", headers=auth_headers)
    assert response.status_code == 200
    badges = response.json()["stats"]["milestone_badges"]
    badge_dict = {b["id"]: b for b in badges}

    # Audiophile Novice (100 mins target, 110 mins progress) -> Unlocked
    assert badge_dict["listener_100"]["unlocked"] is True
    assert badge_dict["listener_100"]["progress"] == 110

    # Sound Voyager (500 mins target, 110 mins progress) -> Locked
    assert badge_dict["listener_500"]["unlocked"] is False

    # Room Hopper (10 rooms target, 11 rooms progress) -> Unlocked
    assert badge_dict["rooms_10"]["unlocked"] is True
    assert badge_dict["rooms_10"]["progress"] >= 10

    # Vibe Selector (20 songs target, 20 progress) -> Unlocked
    assert badge_dict["dj_curator"]["unlocked"] is True

    # Stage Master (1 room hosted target, 1 hosted - test_room) -> Unlocked
    assert badge_dict["host_pioneer"]["unlocked"] is True

    # Community Voice (50 chats target, 50 progress) -> Unlocked
    assert badge_dict["chat_spark"]["unlocked"] is True
