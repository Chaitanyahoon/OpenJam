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


def test_queue_no_cap_limit(db_session, test_room, test_user):
    """Test that a user can queue many tracks (e.g. 10+) without capacity errors."""
    from backend.sockets.queue import _db_add_and_get_queue
    from unittest.mock import patch

    room_id = test_room.id
    user_id = test_user.id
    display_name = test_user.display_name

    with patch('backend.sockets.queue.SessionLocal', return_value=db_session), \
         patch('backend.services.music_search.music_search_service.resolve_youtube', side_effect=lambda q: f"video{int(q.split('-')[-1]):06d}"):
        # Add 12 distinct tracks successfully
        for i in range(12):
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
            # Ensure each one gets added successfully
            assert len(queue) == i + 1


def test_spotify_playlist_import_success(client, auth_headers):
    from unittest.mock import AsyncMock, patch
    import httpx

    mock_html = """
    <html>
      <body>
        <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "state": {
                "data": {
                  "entity": {
                    "trackList": [
                      {
                        "title": "Chereve",
                        "subtitle": "Aria Vega",
                        "duration": 219000
                      }
                    ]
                  }
                }
              }
            }
          }
        }
        </script>
      </body>
    </html>
    """

    mock_response = httpx.Response(200, text=mock_html)

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_response

        response = client.get(
            "/search/playlist?url=https://open.spotify.com/playlist/37i9dQZF1DX10zKzsJ2jva",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert "tracks" in data
        assert len(data["tracks"]) == 1
        assert data["tracks"][0]["name"] == "Chereve"
        assert data["tracks"][0]["artist"] == "Aria Vega"


def test_stream_audio_retry_failover(client):
    from unittest.mock import patch, AsyncMock
    import httpx
    
    mock_resolved_urls = ["http://failed-instance.com/stream", "http://success-instance.com/stream"]
    url_index = 0
    
    async def mock_resolve(*args, **kwargs):
        nonlocal url_index
        if url_index < len(mock_resolved_urls):
            url = mock_resolved_urls[url_index]
            url_index += 1
            return url
        return None
        
    mock_send_count = 0
    async def mock_send(req, **kwargs):
        nonlocal mock_send_count
        mock_send_count += 1
        if mock_send_count == 1:
            raise httpx.ConnectError("Mock connection failure")
        else:
            resp = httpx.Response(200, content=b"fake-audio-bytes")
            resp.aclose = AsyncMock()
            return resp

    mock_client = AsyncMock()
    mock_client.build_request = lambda method, url, **kwargs: httpx.Request(method, url)
    mock_client.send = mock_send

    with patch("backend.routes.queue._resolve_audio_url", side_effect=mock_resolve), \
         patch("backend.routes.queue._get_stream_client", return_value=mock_client), \
         patch("backend.routes.queue.report_stream_failure") as mock_report:
         
        response = client.get("/stream/dQw4w9WgXcQ")
        
        assert response.status_code == 200
        assert response.content == b"fake-audio-bytes"
        assert mock_send_count == 2
        mock_report.assert_called_once_with("http://failed-instance.com/stream")


def test_stream_audio_status_code_retry_failover(client):
    from unittest.mock import patch, AsyncMock
    import httpx
    
    mock_resolved_urls = ["http://403-instance.com/stream", "http://success-instance.com/stream"]
    url_index = 0
    
    async def mock_resolve(*args, **kwargs):
        nonlocal url_index
        if url_index < len(mock_resolved_urls):
            url = mock_resolved_urls[url_index]
            url_index += 1
            return url
        return None
        
    mock_send_count = 0
    async def mock_send(req, **kwargs):
        nonlocal mock_send_count
        mock_send_count += 1
        if mock_send_count == 1:
            resp = httpx.Response(403)
            resp.aclose = AsyncMock()
            return resp
        else:
            resp = httpx.Response(200, content=b"fake-audio-bytes-2")
            resp.aclose = AsyncMock()
            return resp

    mock_client = AsyncMock()
    mock_client.build_request = lambda method, url, **kwargs: httpx.Request(method, url)
    mock_client.send = mock_send

    with patch("backend.routes.queue._resolve_audio_url", side_effect=mock_resolve), \
         patch("backend.routes.queue._get_stream_client", return_value=mock_client), \
         patch("backend.routes.queue.report_stream_failure") as mock_report:
         
        response = client.get("/stream/dQw4w9WgXcQ")
        
        assert response.status_code == 200
        assert response.content == b"fake-audio-bytes-2"
        assert mock_send_count == 2
        mock_report.assert_called_once_with("http://403-instance.com/stream")


def test_add_multiple_tracks_endpoint(client, test_room, auth_headers, db_session):
    from unittest.mock import patch, MagicMock
    payload = [
        {
            "track_uri": "uri_1",
            "track_name": "Song One",
            "artist": "Artist One",
            "album_art_url": "http://img1.jpg",
            "duration_ms": 120000
        },
        {
            "track_uri": "uri_2",
            "track_name": "Song Two",
            "artist": "Artist Two",
            "album_art_url": "http://img2.jpg",
            "duration_ms": 180000
        }
    ]
    mock_session = MagicMock()
    mock_session.query = db_session.query
    mock_session.add = db_session.add
    mock_session.commit = db_session.commit
    mock_session.refresh = db_session.refresh
    mock_session.close = MagicMock()
    
    with patch("backend.sockets.queue.SessionLocal", return_value=mock_session):
        response = client.post(
            f"/rooms/{test_room.id}/queue/multiple",
            json=payload,
            headers=auth_headers
        )
    assert response.status_code == 200
    data = response.json()
    assert data["added_count"] == 2
