"""Tests for profile statistics routes and aggregator."""

import pytest
from datetime import datetime, timezone
from backend.models.queue_item import QueueItem
from backend.models.like import UserLike
from backend.models.playlist import Playlist
from backend.models.chat_message import ChatMessage
from backend.models.vote import Vote
from backend.models.room import Room


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
    assert len(stats["top_tracks"]) == 0
    assert len(stats["top_artists"]) == 0
    assert len(stats["top_genres"]) == 0


def test_get_public_stats_not_found(client):
    """Test public stats with a non-existent user ID."""
    response = client.get("/profile/non-existent-user-id/stats")
    assert response.status_code == 404


def test_get_profile_stats_with_data(client, auth_headers, test_user, test_room, db_session):
    """Test that profile stats aggregate database entries correctly."""
    # Ensure Discord registration so they show up as valid public user
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
        duration_ms=180000, # 3 mins
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
    assert stats["listening_time_mins"] == 3 # only played item counts: 180000 ms = 3 mins

    # Verify Top Tracks/Artists list calculations
    assert len(stats["top_tracks"]) == 1
    assert stats["top_tracks"][0]["track_name"] == "Song B"
    assert stats["top_tracks"][0]["count"] == 2 # queued twice

    assert len(stats["top_artists"]) == 1
    assert stats["top_artists"][0]["artist"] == "Artist Y"

    # Query statistics (public stats)
    pub_response = client.get(f"/profile/{test_user.id}/stats")
    assert pub_response.status_code == 200
    pub_data = pub_response.json()
    assert pub_data["stats"]["total_queued"] == 2
