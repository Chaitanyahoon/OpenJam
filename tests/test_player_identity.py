import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.user import User
from backend.models.room import Room
from backend.models.queue_item import QueueItem
from backend.models.vote import Vote
from backend.services.music_search import lastfm_service
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager
from backend.sockets.connection import register_connection_handlers
from backend.sockets.queue import register_queue_handlers
from backend.sockets.playback import register_playback_handlers
from backend.services.room_closer import schedule_room_close, _close_room_after_delay


def test_resolve_youtube_metadata_success():
    """Test resolve_youtube_metadata returns correct dictionary structure."""
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"title": "Mock Video Title", "author_name": "Mock Channel", "thumbnail_url": "https://example.com/thumb.jpg"}'
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        
        result = lastfm_service.resolve_youtube_metadata("dQw4w9WgXcQ")
        assert result is not None
        assert result["title"] == "Mock Video Title"
        assert result["author"] == "Mock Channel"
        assert result["thumbnail"] == "https://example.com/thumb.jpg"


def test_resolve_youtube_metadata_invalid_id():
    """Test resolve_youtube_metadata with invalid inputs."""
    assert lastfm_service.resolve_youtube_metadata("") is None
    assert lastfm_service.resolve_youtube_metadata("short") is None


@pytest.mark.asyncio
async def test_shuffle_queue_socket_handler(db_session, test_user, test_room):
    """Test shuffle_queue socket handler successfully randomizes queue positions and deletes votes."""
    # Add multiple items to the queue in database
    q1 = QueueItem(
        room_id=test_room.id,
        track_uri="vid1",
        track_name="Song 1",
        artist="Artist 1",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="pending",
        position=0,
        votes=1,
    )
    q2 = QueueItem(
        room_id=test_room.id,
        track_uri="vid2",
        track_name="Song 2",
        artist="Artist 2",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="pending",
        position=1,
        votes=3,
    )
    db_session.add_all([q1, q2])
    db_session.commit()
    
    # Add votes to database to verify they get deleted
    vote1 = Vote(user_id=test_user.id, queue_item_id=q1.id)
    vote2 = Vote(user_id=test_user.id, queue_item_id=q2.id)
    db_session.add_all([vote1, vote2])
    db_session.commit()

    # Capture the shuffle_queue socket handler
    sio = MagicMock()
    events = {}
    
    # Mock event decorator
    def event_decorator(fn):
        events[fn.__name__] = fn
        return fn
    sio.event = event_decorator
    sio.get_session = AsyncMock(return_value={"user_id": test_user.id})
    sio.emit = AsyncMock()
    
    register_queue_handlers(sio)
    shuffle_handler = events["shuffle_queue"]
    
    # Mock room_manager state
    room_manager.join_room(test_room.id, test_user.id, "sid-host", test_user.display_name)
    room_manager.set_host(test_room.id, "sid-host")
    
    # Run the handler
    original_close = db_session.close
    db_session.close = MagicMock()
    try:
        with patch("backend.sockets.queue.SessionLocal", return_value=db_session):
            await shuffle_handler("sid-host", {})
    finally:
        db_session.close = original_close
    
    # Refresh items from database and assert votes are cleared
    db_session.refresh(q1)
    db_session.refresh(q2)
    assert q1.votes == 0
    assert q2.votes == 0
    
    # Verify no votes remaining in DB
    remaining_votes = db_session.query(Vote).filter(Vote.queue_item_id.in_([q1.id, q2.id])).count()
    assert remaining_votes == 0
    
    # Check that socket emitted queue_updated
    sio.emit.assert_called_once()
    args, kwargs = sio.emit.call_args
    assert args[0] == "queue_updated"
    assert "queue" in args[1]
    
    # Cleanup room_manager
    room_manager.leave_room("sid-host")


@pytest.mark.asyncio
async def test_toggle_repeat_socket_handler(test_user, test_room):
    """Test toggle_repeat updates loop playback state and broadcasts to room."""
    sio = MagicMock()
    events = {}
    
    def event_decorator(fn):
        events[fn.__name__] = fn
        return fn
    sio.event = event_decorator
    sio.get_session = AsyncMock(return_value={"user_id": test_user.id})
    sio.emit = AsyncMock()
    
    register_playback_handlers(sio)
    toggle_repeat_handler = events["toggle_repeat"]
    
    # Mock room_manager state
    room_manager.join_room(test_room.id, test_user.id, "sid-host", test_user.display_name)
    room_manager.set_host(test_room.id, "sid-host")
    room_manager.update_playback(
        room_id=test_room.id,
        track_uri="vid1",
        track_name="Song 1",
        artist="Artist 1",
        album_art_url="https://example.com/art.jpg",
        position_ms=0,
        duration_ms=10000,
        is_playing=True,
    )
    
    await toggle_repeat_handler("sid-host", {"loop": True})
    
    # Assert state updated in room_manager
    playback = room_manager.get_playback(test_room.id)
    assert playback["loop"] is True
    
    # Check emission
    sio.emit.assert_called_once()
    args, kwargs = sio.emit.call_args
    assert args[0] == "playback_sync"
    assert args[1]["loop"] is True
    assert kwargs.get("room") == test_room.id
    
    # Cleanup
    room_manager.leave_room("sid-host")


@pytest.mark.asyncio
async def test_connection_db_profile_sync(db_session, test_user):
    """Test that connection/join socket handler queries and overrides profiles using DB user record."""
    # Update test_user display name and avatar
    test_user.display_name = "Discord-Name"
    test_user.avatar_url = "https://discord.com/avatar.png"
    db_session.commit()
    
    # Signed session token mock
    from itsdangerous import URLSafeSerializer
    from backend.config import settings
    token = URLSafeSerializer(settings.SECRET_KEY).dumps({
        "user_id": test_user.id,
        "display_name": "Old-Name",
        "avatar_url": "https://old.com/avatar.png"
    })
    
    sio = MagicMock()
    events = {}
    
    def event_decorator(fn):
        events[fn.__name__] = fn
        return fn
    sio.event = event_decorator
    
    session_store = {}
    sio.save_session = AsyncMock(side_effect=lambda sid, data: session_store.update(data))
    
    register_connection_handlers(sio)
    connect_handler = events["connect"]
    
    # Run connect with Cookie header containing token
    environ = {"HTTP_COOKIE": f"session_token={token}"}
    with patch("backend.sockets.connection.SessionLocal", return_value=db_session):
        await connect_handler("sid-user", environ)
        
    # Assert profile is overwritten with latest database values
    assert session_store["display_name"] == "Discord-Name"
    assert session_store["avatar_url"] == "https://discord.com/avatar.png"


@pytest.mark.asyncio
async def test_room_closer_protects_active_listeners(db_session, test_user, test_room):
    """Test that room auto-close checks active listener count and aborts if count > 0."""
    # Put a listener in the room in memory
    room_manager.join_room(test_room.id, test_user.id, "sid-listener", test_user.display_name)
    
    # Schedule room close and run closure check
    sio = MagicMock()
    db_factory = lambda: db_session
    
    # Run _close_room_after_delay with 0 delay (runs immediately)
    await _close_room_after_delay(test_room.id, 0, sio, db_factory)
    
    # Verify room is still active in database
    db_session.refresh(test_room)
    assert test_room.is_active is True
    
    # Cleanup room_manager
    room_manager.leave_room("sid-listener")
