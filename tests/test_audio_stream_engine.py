"""Tests for AudioStreamEngine service."""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from backend.services.audio_stream_engine import (
    AudioStreamEngine,
    get_stream_response,
    is_valid_video_id,
    resolve_stream_url,
)


def test_is_valid_video_id():
    assert is_valid_video_id("dQw4w9WgXcQ") is True
    assert is_valid_video_id("12345678901") is True
    assert is_valid_video_id("too_short") is False
    assert is_valid_video_id("toolongstring123") is False
    assert is_valid_video_id("invalid/char") is False
    assert is_valid_video_id("") is False
    assert is_valid_video_id(None) is False
    assert is_valid_video_id(12345) is False
    assert is_valid_video_id("   ") is False


@pytest.mark.asyncio
async def test_resolve_stream_url_invalid_id():
    engine = AudioStreamEngine()
    url = await engine.resolve_stream_url("invalid_id")
    assert url is None


@pytest.mark.asyncio
async def test_resolve_stream_url_memory_cache():
    engine = AudioStreamEngine()
    engine._url_cache["testvideo12"] = ("http://cached-url.com/stream", 9999999999.0)
    url = await engine.resolve_stream_url("testvideo12")
    assert url == "http://cached-url.com/stream"


@pytest.mark.asyncio
async def test_resolve_stream_url_redis_cache():
    mock_redis = MagicMock()
    mock_redis.client.get.return_value = "http://redis-url.com/stream"
    engine = AudioStreamEngine(redis_store=mock_redis)

    url = await engine.resolve_stream_url("testvideo12")
    assert url == "http://redis-url.com/stream"
    mock_redis.client.get.assert_called_with("openjam:url:testvideo12")
    assert "testvideo12" in engine._url_cache


@pytest.mark.asyncio
async def test_resolve_stream_url_race_fastest_wins():
    engine = AudioStreamEngine()

    async def mock_cobalt(vid):
        await asyncio.sleep(0.01)
        return "https://cobalt.stream/audio"

    async def mock_invidious(vid):
        await asyncio.sleep(0.1)
        return "https://invidious.stream/audio"

    with patch("backend.services.cobalt.get_cobalt_stream_url", side_effect=mock_cobalt), \
         patch("backend.services.invidious.get_stream_url", side_effect=mock_invidious):
        url = await engine.resolve_stream_url("dQw4w9WgXcQ")
        assert url == "https://cobalt.stream/audio"


@pytest.mark.asyncio
async def test_get_stream_response_invalid_id():
    scope = {"type": "http", "method": "GET", "path": "/stream/bad", "headers": []}
    req = Request(scope)
    with pytest.raises(HTTPException) as exc_info:
        await get_stream_response("bad_id", req)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_stream_response_cached_file(tmp_path):
    engine = AudioStreamEngine(cache_dir=tmp_path)
    # Create fake cached audio file (> 500,000 bytes)
    cached_file = tmp_path / "dQw4w9WgXcQ.webm"
    cached_file.write_bytes(b"0" * 600000)

    scope = {"type": "http", "method": "GET", "path": "/stream/dQw4w9WgXcQ", "headers": []}
    req = Request(scope)

    resp = await engine.get_stream_response("dQw4w9WgXcQ", req)
    assert resp.status_code == 200
    assert resp.media_type == "audio/webm"


@pytest.mark.asyncio
async def test_get_stream_response_live_proxy_failover(tmp_path):
    engine = AudioStreamEngine(cache_dir=tmp_path)

    mock_urls = ["http://bad.com/audio", "http://good.com/audio"]
    url_idx = 0

    async def mock_resolve(vid, low=False):
        nonlocal url_idx
        res = mock_urls[url_idx]
        url_idx += 1
        return res

    mock_send_count = 0

    async def mock_send(request, stream=True):
        nonlocal mock_send_count
        mock_send_count += 1
        if mock_send_count == 1:
            r = httpx.Response(500)
            r.aclose = AsyncMock()
            return r
        else:
            r = httpx.Response(200, content=b"stream-chunks")
            r.aclose = AsyncMock()
            return r

    mock_client = AsyncMock()
    mock_client.build_request = lambda method, url, **kwargs: httpx.Request(method, url)
    mock_client.send = mock_send

    engine.resolve_stream_url = mock_resolve
    engine.get_stream_client = lambda: mock_client

    scope = {"type": "http", "method": "GET", "path": "/stream/dQw4w9WgXcQ", "headers": []}
    req = Request(scope)

    with patch("backend.services.audio_stream_engine.report_stream_failure") as mock_report:
        resp = await engine.get_stream_response("dQw4w9WgXcQ", req)
        assert resp.status_code == 200
        assert mock_send_count == 2
        mock_report.assert_called_once_with("http://bad.com/audio")
        chunks = [chunk async for chunk in resp.body_iterator]
        assert b"".join(chunks) == b"stream-chunks"


@pytest.mark.asyncio
async def test_download_and_cache_track_invalid_id():
    engine = AudioStreamEngine()
    assert await engine.download_and_cache_track("invalid_id") is None
    assert await engine.download_and_cache_track(None) is None


@pytest.mark.asyncio
async def test_pre_resolve_url_invalid_id():
    engine = AudioStreamEngine()
    # Should not raise exception
    await engine.pre_resolve_url("invalid_id")
    await engine.pre_resolve_url(None)


@pytest.mark.asyncio
async def test_get_stream_response_nocache_bypasses_file_cache(tmp_path):
    engine = AudioStreamEngine(cache_dir=tmp_path)
    cached_file = tmp_path / "dQw4w9WgXcQ.webm"
    cached_file.write_bytes(b"0" * 600000)

    scope = {"type": "http", "method": "GET", "path": "/stream/dQw4w9WgXcQ?nocache=true", "headers": []}
    req = Request(scope)

    async def mock_resolve(vid, low=False):
        return "http://live-source.com/stream"

    mock_client = AsyncMock()
    mock_client.build_request = lambda method, url, **kwargs: httpx.Request(method, url)
    mock_resp = httpx.Response(200, content=b"live-audio-stream")
    mock_resp.aclose = AsyncMock()
    mock_client.send = AsyncMock(return_value=mock_resp)

    engine.resolve_stream_url = mock_resolve
    engine.get_stream_client = lambda: mock_client

    resp = await engine.get_stream_response("dQw4w9WgXcQ", req, nocache=True)
    # When nocache=True, it returns StreamingResponse, not FileResponse
    assert resp.status_code == 200
    chunks = [chunk async for chunk in resp.body_iterator]
    assert b"".join(chunks) == b"live-audio-stream"


@pytest.mark.asyncio
async def test_get_stream_response_low_quality_preference(tmp_path):
    engine = AudioStreamEngine(cache_dir=tmp_path)
    high_file = tmp_path / "dQw4w9WgXcQ.webm"
    high_file.write_bytes(b"H" * 600000)
    low_file = tmp_path / "dQw4w9WgXcQ_low.webm"
    low_file.write_bytes(b"L" * 600000)

    scope = {"type": "http", "method": "GET", "path": "/stream/dQw4w9WgXcQ?low=true", "headers": []}
    req = Request(scope)

    # With low=True, it should prefer the _low file
    resp = await engine.get_stream_response("dQw4w9WgXcQ", req, low=True)
    assert resp.status_code == 200
    assert resp.path == str(low_file)


@pytest.mark.asyncio
async def test_cleanup_old_cache(tmp_path):
    engine = AudioStreamEngine(cache_dir=tmp_path)
    # Create 3 files of 1MB each
    f1 = tmp_path / "file1.cache"
    f1.write_bytes(b"1" * 1024 * 1024)
    import time
    time.sleep(0.02)
    f2 = tmp_path / "file2.cache"
    f2.write_bytes(b"2" * 1024 * 1024)

    # Cleanup with max 1MB limit should prune oldest
    await engine.cleanup_old_cache(max_cache_size_mb=1)
    assert not f1.exists()
    assert f2.exists()


def test_prune_url_cache_ttl_and_max():
    import time
    engine = AudioStreamEngine()
    engine._url_cache["expired"] = ("http://old.com", time.time() - 10)
    engine._url_cache["valid"] = ("http://valid.com", time.time() + 1000)

    engine.prune_url_cache()
    assert "expired" not in engine._url_cache
    assert "valid" in engine._url_cache


@pytest.mark.asyncio
async def test_get_stream_response_resolve_exception_retry_and_recovery(tmp_path):
    """Test get_stream_response handles resolver exceptions on attempt 1 and recovers on attempt 2."""
    engine = AudioStreamEngine(cache_dir=tmp_path)

    attempts = 0

    async def mock_resolve(vid, low=False):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("Temporary resolver network timeout")
        return "http://recovered.com/stream"

    mock_client = AsyncMock()
    mock_client.build_request = lambda method, url, **kwargs: httpx.Request(method, url)
    mock_resp = httpx.Response(200, content=b"recovered-bytes")
    mock_resp.aclose = AsyncMock()
    mock_client.send = AsyncMock(return_value=mock_resp)

    engine.resolve_stream_url = mock_resolve
    engine.get_stream_client = lambda: mock_client

    scope = {"type": "http", "method": "GET", "path": "/stream/dQw4w9WgXcQ", "headers": []}
    req = Request(scope)

    resp = await engine.get_stream_response("dQw4w9WgXcQ", req)
    assert resp.status_code == 200
    assert attempts == 2
    chunks = [chunk async for chunk in resp.body_iterator]
    assert b"".join(chunks) == b"recovered-bytes"


