"""Tests for queue routes."""


def _track_payload():
    return {
        "uri": "Example Artist Example Track official audio",
        "name": "Example Track",
        "artist": "Example Artist",
        "album_art_url": "https://example.com/art.jpg",
        "duration_ms": 180000,
    }


def test_add_to_queue_authenticated(client, test_room, auth_headers):
    response = client.post(
        f"/rooms/{test_room.id}/queue",
        json=_track_payload(),
        headers=auth_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["item"]["room_id"] == test_room.id
    assert data["item"]["track_name"] == "Example Track"
    assert data["item"]["artist"] == "Example Artist"


def test_add_to_queue_validation(client, test_room, auth_headers):
    response = client.post(
        f"/rooms/{test_room.id}/queue",
        json={"name": "", "artist": "Example Artist"},
        headers=auth_headers,
    )

    assert response.status_code == 422


def test_add_to_queue_requires_auth(client, test_room):
    response = client.post(f"/rooms/{test_room.id}/queue", json=_track_payload())

    assert response.status_code == 401


def test_vote_track_duplicate_rejected(client, test_room, auth_headers):
    add_response = client.post(
        f"/rooms/{test_room.id}/queue",
        json=_track_payload(),
        headers=auth_headers,
    )
    item_id = add_response.json()["item"]["id"]

    first_vote = client.post(
        f"/rooms/{test_room.id}/queue/{item_id}/vote",
        headers=auth_headers,
    )
    duplicate_vote = client.post(
        f"/rooms/{test_room.id}/queue/{item_id}/vote",
        headers=auth_headers,
    )

    assert first_vote.status_code == 200
    assert duplicate_vote.status_code == 409


def test_vote_track_missing_item(client, test_room, auth_headers):
    response = client.post(
        f"/rooms/{test_room.id}/queue/missing-item/vote",
        headers=auth_headers,
    )

    assert response.status_code == 404


def test_queue_duplicate_deduplication(db_session, test_room, test_user):
    """Test that adding a duplicate track to the queue throws a ValueError."""
    from backend.sockets.queue import _db_add_and_get_queue
    from unittest.mock import patch
    import pytest

    room_id = test_room.id
    user_id = test_user.id
    display_name = test_user.display_name

    track_data = {
        "uri": "dQw4w9WgXcQ",
        "name": "Never Gonna Give You Up",
        "artist": "Rick Astley",
    }

    with patch('backend.sockets.queue.SessionLocal', return_value=db_session):
        # 1. First add should succeed
        queue, next_item = _db_add_and_get_queue(
            room_id,
            track_data,
            user_id,
            display_name
        )
        assert len(queue) == 1
        assert queue[0]["track_name"] == "Never Gonna Give You Up"

        # 2. Second add of the same track should raise ValueError
        with pytest.raises(ValueError, match="This track is already in the queue"):
            _db_add_and_get_queue(
                room_id,
                track_data,
                user_id,
                display_name
            )


def test_queue_cap_limit(db_session, test_room, test_user):
    """Test that a user cannot queue more than 5 pending tracks."""
    from backend.sockets.queue import _db_add_and_get_queue
    from unittest.mock import patch
    import pytest

    room_id = test_room.id
    user_id = test_user.id
    display_name = test_user.display_name

    with patch('backend.sockets.queue.SessionLocal', return_value=db_session):
        # Add 6 distinct tracks successfully (1 becomes 'playing', 5 remain 'pending')
        for i in range(6):
            track_data = {
                "uri": f"track-uri-{i}",
                "name": f"Track {i}",
                "artist": "Test Artist",
            }
            queue, _ = _db_add_and_get_queue(
                room_id,
                track_data,
                user_id,
                display_name
            )
            # Ensure each one gets added
            assert len(queue) == i + 1

        # 7th track should raise ValueError as there are already 5 pending tracks
        seventh_track = {
            "uri": "track-uri-6",
            "name": "Track 6",
            "artist": "Test Artist",
        }
        with pytest.raises(ValueError, match="You can only queue up to 5 tracks at a time"):
            _db_add_and_get_queue(
                room_id,
                seventh_track,
                user_id,
                display_name
            )



