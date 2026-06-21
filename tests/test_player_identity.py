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


@pytest.mark.asyncio
async def test_resolve_youtube_metadata_success():
    """Test resolve_youtube_metadata returns correct dictionary structure."""
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "title": "Mock Video Title",
            "author_name": "Mock Channel",
            "thumbnail_url": "https://example.com/thumb.jpg"
        }
        mock_resp.raise_for_status = MagicMock()
        mock_client.get.return_value = mock_resp
        mock_client_cls.return_value.__aenter__.return_value = mock_client
        
        result = await lastfm_service.resolve_youtube_metadata("dQw4w9WgXcQ")
        assert result is not None
        assert result["title"] == "Mock Video Title"
        assert result["author"] == "Mock Channel"
        assert result["thumbnail"] == "https://example.com/thumb.jpg"


@pytest.mark.asyncio
async def test_resolve_youtube_metadata_invalid_id():
    """Test resolve_youtube_metadata with invalid inputs."""
    assert await lastfm_service.resolve_youtube_metadata("") is None
    assert await lastfm_service.resolve_youtube_metadata("short") is None


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
    from itsdangerous import URLSafeTimedSerializer
    from backend.config import settings
    token = URLSafeTimedSerializer(settings.SECRET_KEY).dumps({
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


@pytest.mark.asyncio
async def test_add_multiple_to_queue(db_session, test_user, test_room):
    """Test bulk track addition handler and background resolution invocation."""
    sio = MagicMock()
    events = {}
    sio.event = lambda fn: events.update({fn.__name__: fn}) or fn
    sio.get_session = AsyncMock(return_value={"user_id": test_user.id})
    sio.emit = AsyncMock()

    register_queue_handlers(sio)
    add_multiple_handler = events["add_multiple_to_queue"]

    # Mock room_manager membership
    room_manager.join_room(test_room.id, test_user.id, "sid-user", test_user.display_name)

    tracks = [
        {"track_uri": "bulk1", "track_name": "Bulk Song 1", "artist": "Artist 1"},
        {"track_uri": "bulk2", "track_name": "Bulk Song 2", "artist": "Artist 2"}
    ]

    original_close = db_session.close
    db_session.close = MagicMock()
    try:
        with patch("backend.sockets.queue.SessionLocal", return_value=db_session), \
             patch("backend.sockets.queue.resolve_room_queue_background", new_callable=AsyncMock) as mock_resolve:
            await add_multiple_handler("sid-user", {"tracks": tracks})
            
            # Verify tracks were inserted
            items = db_session.query(QueueItem).filter(QueueItem.room_id == test_room.id).order_by(QueueItem.position.asc()).all()
            assert len(items) == 2
            assert items[0].track_name == "Bulk Song 1"
            assert items[1].track_name == "Bulk Song 2"
            
            # Verify background resolver task was triggered
            mock_resolve.assert_called_once_with(test_room.id, sio)
    finally:
        db_session.close = original_close

    room_manager.leave_room("sid-user")


@pytest.mark.asyncio
async def test_play_now_handler(db_session, test_user, test_room):
    """Test that play_now instantly plays a track and updates DB status."""
    # Add a track currently playing
    q_playing = QueueItem(
        room_id=test_room.id,
        track_uri="old_playing",
        track_name="Old Song",
        artist="Old Artist",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="playing",
        position=0
    )
    db_session.add(q_playing)
    db_session.commit()

    sio = MagicMock()
    events = {}
    sio.event = lambda fn: events.update({fn.__name__: fn}) or fn
    sio.get_session = AsyncMock(return_value={"user_id": test_user.id})
    sio.emit = AsyncMock()

    register_queue_handlers(sio)
    play_now_handler = events["play_now"]

    room_manager.join_room(test_room.id, test_user.id, "sid-host", test_user.display_name)
    room_manager.set_host(test_room.id, "sid-host")

    track_to_play = {
        "track_uri": "new_playing",
        "track_name": "New Song",
        "artist": "New Artist"
    }

    original_close = db_session.close
    db_session.close = MagicMock()
    try:
        with patch("backend.sockets.queue.SessionLocal", return_value=db_session):
            await play_now_handler("sid-host", track_to_play)

            # Check DB states
            db_session.refresh(q_playing)
            assert q_playing.status == "played"

            new_item = db_session.query(QueueItem).filter(
                QueueItem.room_id == test_room.id,
                QueueItem.track_uri == "new_playing"
            ).first()
            assert new_item is not None
            assert new_item.status == "playing"
    finally:
        db_session.close = original_close

    room_manager.leave_room("sid-host")


@pytest.mark.asyncio
async def test_remove_playing_track_handler(db_session, test_user, test_room):
    """Test remove_from_queue handler automatically advances the queue if playing track is removed."""
    q_playing = QueueItem(
        room_id=test_room.id,
        track_uri="playing_vid",
        track_name="Playing Song",
        artist="Artist",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="playing",
        position=0
    )
    q_pending = QueueItem(
        room_id=test_room.id,
        track_uri="pending_vid",
        track_name="Pending Song",
        artist="Artist",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="pending",
        position=1
    )
    db_session.add_all([q_playing, q_pending])
    db_session.commit()

    sio = MagicMock()
    events = {}
    sio.event = lambda fn: events.update({fn.__name__: fn}) or fn
    sio.get_session = AsyncMock(return_value={"user_id": test_user.id})
    sio.emit = AsyncMock()

    register_queue_handlers(sio)
    remove_handler = events["remove_from_queue"]

    room_manager.join_room(test_room.id, test_user.id, "sid-host", test_user.display_name)
    room_manager.set_host(test_room.id, "sid-host")

    original_close = db_session.close
    db_session.close = MagicMock()
    try:
        with patch("backend.sockets.queue.SessionLocal", return_value=db_session):
            await remove_handler("sid-host", {"queue_item_id": q_playing.id})

            # Verify playing track is deleted from DB
            deleted = db_session.query(QueueItem).filter(QueueItem.id == q_playing.id).first()
            assert deleted is None

            # Verify pending track was advanced to playing
            db_session.refresh(q_pending)
            assert q_pending.status == "playing"
    finally:
        db_session.close = original_close

    room_manager.leave_room("sid-host")


@pytest.mark.asyncio
async def test_lazy_resolution_logic(db_session, test_user, test_room):
    """Test that resolve_room_queue_background skips clean tracks and pre_resolve_next_track_background resolves them."""
    # 1. Add a clean/non-placeholder track but unresolved (query URI)
    clean_track = QueueItem(
        room_id=test_room.id,
        track_uri="clean query",
        track_name="Clean Song",
        artist="Clean Artist",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="pending",
        position=0
    )
    # 2. Add a placeholder track (generic name)
    placeholder_track = QueueItem(
        room_id=test_room.id,
        track_uri="placeholder query",
        track_name="YouTube Video",
        artist="Search Query",
        added_by_user_id=test_user.id,
        added_by_name=test_user.display_name,
        status="pending",
        position=1
    )
    db_session.add_all([clean_track, placeholder_track])
    db_session.commit()

    sio = MagicMock()
    sio.emit = AsyncMock()

    # We mock lastfm_service.resolve_youtube and resolve_youtube_metadata
    from backend.services.music_search import music_search_service
    
    original_close = db_session.close
    db_session.close = MagicMock()
    try:
        with patch.object(music_search_service, "resolve_youtube", return_value="11char_vid0") as mock_resolve, \
             patch.object(music_search_service, "resolve_youtube_metadata", return_value={"title": "Resolved Placeholder", "author": "Resolved Author", "thumbnail": "thumb"}) as mock_meta, \
             patch("backend.sockets.queue.SessionLocal", return_value=db_session), \
             patch("backend.database.SessionLocal", return_value=db_session):

            # Run resolve_room_queue_background
            from backend.sockets.queue import resolve_room_queue_background
            await resolve_room_queue_background(test_room.id, sio)

            # Refresh database items
            db_session.refresh(clean_track)
            db_session.refresh(placeholder_track)

            # Clean track should NOT have been resolved in the background resolver
            assert clean_track.track_uri == "clean query"
            assert clean_track.track_name == "Clean Song"

            # Placeholder track SHOULD have been resolved in the background resolver
            assert placeholder_track.track_uri == "11char_vid0"
            assert placeholder_track.track_name == "Resolved Placeholder"
            assert placeholder_track.artist == "Resolved Author"

            # Now, call pre_resolve_next_track_background on the queue (which contains clean_track as next pending)
            from backend.sockets.playback import pre_resolve_next_track_background
            queue_data = [clean_track.to_dict()]
            
            # We mock pre_resolve_url to prevent actual cache download task triggering
            with patch("backend.routes.queue.pre_resolve_url", new_callable=AsyncMock) as mock_pre_url:
                await pre_resolve_next_track_background(test_room.id, queue_data, sio)

                # Clean track SHOULD now be resolved
                db_session.refresh(clean_track)
                assert clean_track.track_uri == "11char_vid0"
                mock_pre_url.assert_called_once_with("11char_vid0")
    finally:
        db_session.close = original_close


