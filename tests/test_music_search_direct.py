import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from backend.services.music_search import music_search_service

@pytest.mark.asyncio
async def test_direct_youtube_id_fast_path():
    with patch.object(music_search_service, "resolve_youtube_metadata", new_callable=AsyncMock) as mock_meta:
        mock_meta.return_value = {
            "title": "Rick Astley - Never Gonna Give You Up",
            "author": "Rick Astley",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        }
        res = await music_search_service.search_tracks("dQw4w9WgXcQ")
        assert len(res) == 1
        assert res[0]["uri"] == "dQw4w9WgXcQ"
        assert "Rick Astley" in res[0]["name"]
        mock_meta.assert_called_once_with("dQw4w9WgXcQ")

@pytest.mark.asyncio
async def test_direct_youtube_url_fast_path():
    with patch.object(music_search_service, "resolve_youtube_metadata", new_callable=AsyncMock) as mock_meta:
        mock_meta.return_value = {
            "title": "Lofi Hip Hop Radio",
            "author": "Lofi Girl",
            "thumbnail": "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg"
        }
        res = await music_search_service.search_tracks("https://www.youtube.com/watch?v=jfKfPfyJRdk")
        assert len(res) == 1
        assert res[0]["uri"] == "jfKfPfyJRdk"
        assert res[0]["artist"] == "Lofi Girl"
        mock_meta.assert_called_once_with("jfKfPfyJRdk")

@pytest.mark.asyncio
async def test_direct_spotify_url_fast_path():
    with patch.object(music_search_service, "resolve_youtube", new_callable=AsyncMock) as mock_resolve, \
         patch.object(music_search_service, "resolve_youtube_metadata", new_callable=AsyncMock) as mock_meta:
        mock_resolve.return_value = "dQw4w9WgXcQ"
        mock_meta.return_value = {
            "title": "Never Gonna Give You Up",
            "author": "Rick Astley",
            "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
        }
        res = await music_search_service.search_tracks("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")
        assert len(res) == 1
        assert res[0]["uri"] == "dQw4w9WgXcQ"
        assert res[0]["name"] == "Never Gonna Give You Up"
        mock_resolve.assert_called_once()
