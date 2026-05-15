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
