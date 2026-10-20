"""Automated tests for dual Room slug and UUID resolution across REST and WebSocket."""

import pytest
import re
from backend.models.room import Room, generate_room_slug
from backend.sockets.connection import register_connection_handlers
from unittest.mock import AsyncMock, patch


def test_generate_room_slug():
    """Verify generate_room_slug creates URL-safe alphanumeric slugs with short hashes."""
    slug1 = generate_room_slug("Chill Beats")
    assert slug1.startswith("chill-beats-")
    assert re.match(r"^chill-beats-[a-f0-9]{4}$", slug1)

    # Unicode & special characters
    slug2 = generate_room_slug("🎶 Synthwave & Pop 🚀")
    assert slug2.startswith("synthwave-pop-")
    assert re.match(r"^synthwave-pop-[a-f0-9]{4}$", slug2)

    # Empty or symbol-only names
    slug3 = generate_room_slug("!@#$%^")
    assert slug3.startswith("room-")
    assert re.match(r"^room-[a-f0-9]{4}$", slug3)


def test_room_model_auto_populates_slug(db_session, test_user):
    """Verify creating a Room without a slug auto-generates an indexed slug."""
    room = Room(
        name="Lo-Fi Study Session",
        host_user_id=test_user.id,
        genre_tags='["lofi", "study"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    assert room.slug is not None
    assert room.slug.startswith("lo-fi-study-session-")
    assert room.id != room.slug

    room_dict = room.to_dict()
    assert room_dict["id"] == room.id
    assert room_dict["slug"] == room.slug


def test_dual_slug_and_uuid_get_room_identical(client, auth_headers, test_user):
    """Automated backend test verifying GET /rooms/{slug} and GET /rooms/{uuid} return the identical room object."""
    # 1. Create a room through REST API
    payload = {
        "name": "Midnight Jazz Club",
        "description": "Smooth jazz and rain sounds",
        "genre_tags": ["jazz", "chill"],
        "queue_mode": "open",
    }
    create_res = client.post("/rooms", json=payload, headers=auth_headers)
    assert create_res.status_code == 200
    created_room = create_res.json()["room"]

    room_uuid = created_room["id"]
    room_slug = created_room["slug"]
    assert room_slug is not None
    assert room_slug != room_uuid
    assert room_slug.startswith("midnight-jazz-club-")

    # 2. Fetch using UUID
    res_uuid = client.get(f"/rooms/{room_uuid}")
    assert res_uuid.status_code == 200
    data_uuid = res_uuid.json()

    # 3. Fetch using Slug
    res_slug = client.get(f"/rooms/{room_slug}")
    assert res_slug.status_code == 200
    data_slug = res_slug.json()

    # 4. Assert identical room object
    assert data_uuid["room"]["id"] == room_uuid
    assert data_slug["room"]["id"] == room_uuid
    assert data_uuid["room"]["slug"] == room_slug
    assert data_slug["room"]["slug"] == room_slug
    assert data_uuid == data_slug


@pytest.mark.asyncio
async def test_websocket_handshake_succeeds_with_both_slug_and_uuid(db_session, test_user):
    """Verify WebSocket handshake succeeds with both room slug and room UUID."""
    room = Room(
        name="Indie Rock Live",
        host_user_id=test_user.id,
        genre_tags='["indie", "rock"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    room_uuid = room.id
    room_slug = room.slug
    assert room_slug is not None

    # Setup mock Socket.IO server
    sio = AsyncMock()
    handlers = {}

    def mock_event(func):
        handlers[func.__name__] = func
        return func

    sio.event = mock_event
    sio.on = mock_event
    register_connection_handlers(sio)

    join_room_handler = handlers.get("join_room")
    assert join_room_handler is not None

    with patch("backend.sockets.connection.SessionLocal", return_value=db_session):
        # 1. Handshake with Room UUID
        sio.get_session.return_value = {"user_id": test_user.id, "display_name": test_user.display_name}
        sio.emit.reset_mock()
        sio.enter_room.reset_mock()

        await join_room_handler("sid_uuid", {"room_id": room_uuid})

        # Ensure join_error was NOT emitted
        for call in sio.emit.call_args_list:
            assert call[0][0] != "join_error"

        # Ensure join_success was emitted
        success_emits = [call for call in sio.emit.call_args_list if call[0][0] == "join_success"]
        assert len(success_emits) == 1
        join_payload = success_emits[0][0][1]
        assert join_payload["room"]["id"] == room_uuid
        assert join_payload["room"]["slug"] == room_slug

        # 2. Handshake with Room Slug
        sio.emit.reset_mock()
        sio.enter_room.reset_mock()

        await join_room_handler("sid_slug", {"room_id": room_slug})

        # Ensure join_error was NOT emitted
        for call in sio.emit.call_args_list:
            assert call[0][0] != "join_error"

        # Ensure join_success was emitted with identical room metadata
        slug_success_emits = [call for call in sio.emit.call_args_list if call[0][0] == "join_success"]
        assert len(slug_success_emits) == 1
        slug_payload = slug_success_emits[0][0][1]
        assert slug_payload["room"]["id"] == room_uuid
        assert slug_payload["room"]["slug"] == room_slug
        assert slug_payload["room"]["name"] == "Indie Rock Live"


def test_queue_dual_resolution_with_slug_and_uuid(client, auth_headers, test_user, db_session):
    """Test adding track via slug and reading via UUID."""
    room = Room(
        name="Electronic Beats",
        host_user_id=test_user.id,
        genre_tags='["electronic"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    # Add track using slug in URL
    track_payload = {
        "uri": "8GW6sLrK40k",
        "name": "Resonance",
        "artist": "HOME",
        "duration_ms": 212000,
    }
    add_res = client.post(f"/rooms/{room.slug}/queue", json=track_payload, headers=auth_headers)
    assert add_res.status_code == 200
    assert add_res.json()["item"]["track_name"] == "Resonance"

    # Fetch queue using UUID in URL
    queue_res = client.get(f"/queue/{room.id}")
    assert queue_res.status_code == 200
    queue_items = queue_res.json()["queue"]
    assert len(queue_items) == 1
    assert queue_items[0]["track_name"] == "Resonance"

    # Fetch history using slug
    hist_res = client.get(f"/rooms/{room.slug}/history")
    assert hist_res.status_code == 200


def test_add_multiple_tracks_endpoint_with_room_slug(client, auth_headers, test_user, db_session):
    """Test POST /rooms/{slug}/queue/multiple adds multiple tracks successfully."""
    room = Room(
        name="Synthwave City",
        host_user_id=test_user.id,
        genre_tags='["synthwave"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    tracks_payload = [
        {"track_uri": "8GW6sLrK40k", "track_name": "Track One", "artist": "Artist A", "duration_ms": 180000},
        {"track_uri": "dQw4w9WgXcQ", "track_name": "Track Two", "artist": "Artist B", "duration_ms": 210000},
    ]

    from unittest.mock import patch, MagicMock
    mock_session = MagicMock()
    mock_session.query = db_session.query
    mock_session.add = db_session.add
    mock_session.commit = db_session.commit
    mock_session.refresh = db_session.refresh
    mock_session.close = MagicMock()

    with patch("backend.sockets.queue.SessionLocal", return_value=mock_session):
        res = client.post(f"/rooms/{room.slug}/queue/multiple", json=tracks_payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["added_count"] == 2

    # Fetch queue by slug
    q_res = client.get(f"/queue/{room.slug}", headers=auth_headers)
    assert q_res.status_code == 200
    queue = q_res.json()["queue"]
    assert len(queue) == 2


@pytest.mark.asyncio
async def test_socket_chat_reactions_and_typing_via_room_slug(db_session, test_user):
    """Verify chat, reactions, and typing operate properly when client emits room slug."""
    from backend.sockets.chat import register_chat_handlers
    from backend.services.room_manager import room_manager
    from backend.models.chat_message import ChatMessage

    room = Room(
        name="Acoustic Vibes",
        host_user_id=test_user.id,
        genre_tags='["acoustic"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    sio = AsyncMock()
    handlers = {}

    def mock_event(func):
        handlers[func.__name__] = func
        return func

    sio.event = mock_event
    sio.on = mock_event
    register_connection_handlers(sio)
    register_chat_handlers(sio)

    join_room_handler = handlers.get("join_room")
    send_chat_handler = handlers.get("send_chat")
    send_reaction_handler = handlers.get("send_reaction")
    typing_handler = handlers.get("typing")
    stop_typing_handler = handlers.get("stop_typing")

    with patch("backend.sockets.connection.SessionLocal", return_value=db_session), \
         patch("backend.sockets.chat.SessionLocal", return_value=db_session):

        # Join via room slug
        sid = "sid_chat_test"
        sio.get_session.return_value = {
            "user_id": test_user.id,
            "display_name": test_user.display_name,
            "avatar_url": None,
        }
        await join_room_handler(sid, {"room_id": room.slug})

        # Send chat message using room slug
        sio.emit.reset_mock()
        await send_chat_handler(sid, {"room_id": room.slug, "message": "Hello OpenJam room!", "temp_id": "tmp123"})

        # Verify chat_message emitted to canonical room UUID
        chat_emits = [call for call in sio.emit.call_args_list if call[0][0] == "chat_message"]
        assert len(chat_emits) == 1
        msg_payload = chat_emits[0][0][1]
        assert msg_payload["content"] == "Hello OpenJam room!"
        assert msg_payload["room_id"] == room.id
        assert chat_emits[0][1]["room"] == room.id

        # Verify message persisted in DB under canonical room ID
        db_msg = db_session.query(ChatMessage).filter(ChatMessage.room_id == room.id).first()
        assert db_msg is not None
        assert db_msg.content == "Hello OpenJam room!"

        # Send reaction using room slug
        sio.emit.reset_mock()
        await send_reaction_handler(sid, {"room_id": room.slug, "emoji": "🔥"})
        reaction_emits = [call for call in sio.emit.call_args_list if call[0][0] == "reaction"]
        assert len(reaction_emits) == 1
        assert reaction_emits[0][0][1]["emoji"] == "🔥"
        assert reaction_emits[0][1]["room"] == room.id

        # Send typing using room slug
        sio.emit.reset_mock()
        await typing_handler(sid, {"room_id": room.slug})
        typing_emits = [call for call in sio.emit.call_args_list if call[0][0] == "user_typing"]
        assert len(typing_emits) == 1
        assert typing_emits[0][1]["room"] == room.id

        # Send stop_typing using room slug
        sio.emit.reset_mock()
        await stop_typing_handler(sid, {"room_id": room.slug})
        stop_typing_emits = [call for call in sio.emit.call_args_list if call[0][0] == "user_stop_typing"]
        assert len(stop_typing_emits) == 1
        assert stop_typing_emits[0][1]["room"] == room.id

        # Cleanup
        room_manager.leave_room(sid)


def test_og_image_resolution_with_room_slug(client, db_session, test_user):
    """Test GET /api/og/room/{slug}.png resolves room and returns binary image."""
    room = Room(
        name="Dreamscape Lounge",
        host_user_id=test_user.id,
        genre_tags='["ambient", "dream"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    res = client.get(f"/api/og/room/{room.slug}.png")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert len(res.content) > 100


def test_admin_operations_with_room_slug(client, test_user, db_session):
    """Test admin skip, purge chat, and force delete via room slug."""
    login_res = client.post("/auth/admin-login", json={"password": "openjam-admin-123"})
    assert login_res.status_code == 200
    token = login_res.json()["token"]
    admin_headers = {
        "Authorization": f"Bearer {token}",
        "Cookie": f"session_token={token}",
    }

    room = Room(
        name="Admin Test Room",
        host_user_id=test_user.id,
        genre_tags='["test"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    # Purge chat via slug
    purge_res = client.delete(f"/admin/rooms/{room.slug}/chat", headers=admin_headers)
    assert purge_res.status_code == 200

    # Delete room via slug
    del_res = client.delete(f"/admin/rooms/{room.slug}", headers=admin_headers)
    assert del_res.status_code == 200

    # Room is now inactive
    db_session.refresh(room)
    assert room.is_active is False


def test_non_ascii_and_emoji_room_slug_fallback():
    """Verify room names with emojis or non-ASCII scripts fall back cleanly and safely."""
    slug_emoji = generate_room_slug("🔥🎧✨🎉")
    assert re.match(r"^room-[a-f0-9]{4}$", slug_emoji)

    slug_intl = generate_room_slug("เพลงและดนตรี")
    assert re.match(r"^room-[a-f0-9]{4}$", slug_intl)

    slug_empty = generate_room_slug("")
    assert re.match(r"^room-[a-f0-9]{4}$", slug_empty)


def test_concurrent_room_creation_collision_retry(client, auth_headers):
    """Verify creating multiple rooms with the exact same name generates unique slugs without 500 error."""
    slugs = set()
    for _ in range(5):
        payload = {
            "name": "Identical Chill Beats",
            "description": "Concurrency test room",
            "genre_tags": ["lofi"],
            "queue_mode": "open",
        }
        res = client.post("/rooms", json=payload, headers=auth_headers)
        assert res.status_code == 200
        data = res.json()["room"]
        slug = data["slug"]
        assert slug is not None
        assert slug not in slugs
        slugs.add(slug)
    assert len(slugs) == 5


@pytest.mark.asyncio
async def test_kick_user_leaves_both_uuid_and_slug_groups(db_session, test_user):
    """Verify kicking a user removes them from both canonical room UUID and slug socket groups."""
    from backend.models.user import User
    from backend.services.room_manager import room_manager

    room = Room(
        name="Kick Test Room",
        host_user_id=test_user.id,
        genre_tags='["test"]',
        queue_mode="open",
    )
    listener_user = User(id="listener_uid_123", display_name="ListenerToKick")
    db_session.add_all([room, listener_user])
    db_session.commit()
    db_session.refresh(room)

    sio = AsyncMock()
    handlers = {}

    def mock_event(func):
        handlers[func.__name__] = func
        return func

    sio.event = mock_event
    sio.on = mock_event
    register_connection_handlers(sio)

    host_sid = "sid_host_1"
    listener_sid = "sid_listener_1"

    # Simulate host and listener in room_manager
    room_manager.join_room(room.id, test_user.id, host_sid, test_user.display_name)
    room_manager.set_host(room.id, host_sid)
    room_manager.join_room(room.id, listener_user.id, listener_sid, listener_user.display_name)

    kick_user_handler = handlers.get("kick_user")
    assert kick_user_handler is not None

    with patch("backend.sockets.connection.SessionLocal", return_value=db_session):
        await kick_user_handler(host_sid, {"target_user_id": listener_user.id})

    # Verify sio.leave_room called for both room.id and room.slug
    leave_calls = [call[0] for call in sio.leave_room.call_args_list if call[0][0] == listener_sid]
    left_rooms = [call[1] for call in leave_calls]
    assert room.id in left_rooms
    assert room.slug in left_rooms

    # Cleanup
    room_manager.leave_room(host_sid)
    room_manager.leave_room(listener_sid)


def test_update_and_close_room_broadcasts_to_slug_group(client, auth_headers, test_user, db_session):
    """Verify PATCH /rooms/{slug} and DELETE /rooms/{slug} emit to both canonical UUID and slug groups."""
    room = Room(
        name="Broadcast Test Room",
        host_user_id=test_user.id,
        genre_tags='["broadcast"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    from unittest.mock import AsyncMock
    mock_sio = AsyncMock()
    client.app.state.sio = mock_sio

    # 1. Update room via slug
    update_res = client.patch(
        f"/rooms/{room.slug}",
        json={"name": "Renamed Broadcast Room", "allow_guest_controls": True},
        headers=auth_headers,
    )
    assert update_res.status_code == 200

    # Verify room_updated emitted to both room.id and room.slug
    updated_emits = [call for call in mock_sio.emit.call_args_list if call[0][0] == "room_updated"]
    target_rooms = [call[1].get("room") for call in updated_emits]
    assert room.id in target_rooms
    assert room.slug in target_rooms

    # 2. Close room via slug
    mock_sio.emit.reset_mock()
    close_res = client.delete(f"/rooms/{room.slug}", headers=auth_headers)
    assert close_res.status_code == 200

    closed_emits = [call for call in mock_sio.emit.call_args_list if call[0][0] == "room_closed"]
    close_target_rooms = [call[1].get("room") for call in closed_emits]
    assert room.id in close_target_rooms
    assert room.slug in close_target_rooms


def test_is_valid_room_target_caching(db_session, test_user):
    """Verify chat room slug target validation caches result and avoids duplicate DB queries."""
    from backend.sockets.chat import _is_valid_room_target, _room_slug_cache

    room = Room(
        name="Cache Check Room",
        host_user_id=test_user.id,
        genre_tags='["cache"]',
        queue_mode="open",
    )
    db_session.add(room)
    db_session.commit()
    db_session.refresh(room)

    _room_slug_cache.clear()

    # First lookup populates cache
    with patch("backend.sockets.chat.SessionLocal", return_value=db_session) as mock_sl:
        valid_slug = _is_valid_room_target(room.id, room.slug)
        assert valid_slug is True
        assert mock_sl.call_count == 1
        assert _room_slug_cache.get(room.id) == room.slug

    # Second lookup hits cache without touching SessionLocal
    with patch("backend.sockets.chat.SessionLocal", side_effect=RuntimeError("DB should not be queried")):
        cached_valid = _is_valid_room_target(room.id, room.slug)
        assert cached_valid is True
        # Canonical id matches directly without DB
        direct_valid = _is_valid_room_target(room.id, room.id)
        assert direct_valid is True
        # Non-matching slug returns False
        invalid = _is_valid_room_target(room.id, "wrong-slug-1234")
        assert invalid is False


@pytest.mark.asyncio
async def test_room_switching_leaves_old_slug_group(db_session, test_user):
    """Verify switching rooms removes the socket from both the old room's UUID and slug channels."""
    from backend.services.room_manager import room_manager
    from backend.sockets.chat import _room_slug_cache

    room_a = Room(name="Room Alpha", host_user_id=test_user.id, genre_tags='["lofi"]', queue_mode="open")
    room_b = Room(name="Room Beta", host_user_id=test_user.id, genre_tags='["jazz"]', queue_mode="open")
    db_session.add_all([room_a, room_b])
    db_session.commit()
    db_session.refresh(room_a)
    db_session.refresh(room_b)

    sio = AsyncMock()
    handlers = {}

    def mock_event(func):
        handlers[func.__name__] = func
        return func

    sio.event = mock_event
    sio.on = mock_event
    register_connection_handlers(sio)

    join_room_handler = handlers.get("join_room")
    assert join_room_handler is not None

    sid = "sid_switcher_123"
    sio.get_session.return_value = {"user_id": test_user.id, "display_name": test_user.display_name}

    with patch("backend.sockets.connection.SessionLocal", return_value=db_session):
        # 1. Join Room A via slug
        await join_room_handler(sid, {"room_id": room_a.slug})
        assert _room_slug_cache.get(room_a.id) == room_a.slug

        sio.leave_room.reset_mock()

        # 2. Switch to Room B via slug
        await join_room_handler(sid, {"room_id": room_b.slug})
        assert _room_slug_cache.get(room_b.id) == room_b.slug

        # 3. Verify socket left BOTH Room A's UUID and Room A's slug
        leave_calls = [call[0] for call in sio.leave_room.call_args_list if call[0][0] == sid]
        left_rooms = [call[1] for call in leave_calls]
        assert room_a.id in left_rooms, f"Socket did not leave old canonical id {room_a.id}: {left_rooms}"
        assert room_a.slug in left_rooms, f"Socket did not leave old slug group {room_a.slug}: {left_rooms}"

    # Cleanup
    room_manager.leave_room(sid)



