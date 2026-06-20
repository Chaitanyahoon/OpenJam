"""Socket.IO queue event handlers."""

import asyncio
import socketio
from backend.database import SessionLocal
from backend.logger import get_logger
from backend.services.room_manager import room_manager
from backend.services.queue_manager import queue_manager

logger = get_logger(__name__)


def _db_add_and_get_queue(room_id: str, track_data: dict, user_id: str, display_name: str):
    """Add a track and get current queue — runs in thread pool."""
    from backend.models.room import Room
    from backend.models.user import User
    from backend.models.queue_item import QueueItem
    db = SessionLocal()
    try:
        # Check queue mode permissions
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise ValueError("Room not found")
        if room.queue_mode == "curated" and room.host_user_id != user_id:
            raise ValueError("Queue is locked by host")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            db.add(User(id=user_id, display_name=display_name))
            db.flush()
        else:
            display_name = user.display_name

        # Check if the song will play immediately
        live_playback = room_manager.get_playback(room_id)
        is_playing_live = live_playback and live_playback.get("is_playing", False)
        now_playing = queue_manager.get_now_playing(db, room_id)
        is_playing_immediately = not now_playing and not is_playing_live

        # Resolve YouTube Video ID immediately if needed (only if playing immediately)
        uri = track_data.get("uri")
        if uri and (" " in uri or len(uri) != 11):
            if is_playing_immediately:
                from backend.services.music_search import music_search_service as lastfm_service
                resolved_id = lastfm_service.resolve_youtube(uri)
                if resolved_id:
                    track_data["uri"] = resolved_id
                    uri = resolved_id
                else:
                    raise ValueError(f"Could not resolve track: '{uri}'")

        # Resolve actual YouTube title, artist, and thumbnail if generic/missing (only if playing immediately)
        if uri and len(uri) == 11 and is_playing_immediately:
            if track_data.get("name") in ["YouTube Video", "", None, uri] or track_data.get("artist") in ["YouTube", "Search Query", "", None] or "spotify.com" in str(track_data.get("name")):
                from backend.services.music_search import music_search_service as lastfm_service
                metadata = lastfm_service.resolve_youtube_metadata(uri)
                if metadata:
                    track_data["name"] = metadata["title"]
                    track_data["artist"] = metadata["author"]
                    track_data["album_art_url"] = metadata["thumbnail"]

        if not track_data.get("uri") or not track_data.get("name"):
            raise ValueError("Track URI and Name are required")

        # 2. Song Deduplication (check if track is pending or playing)
        if uri:
            duplicate = db.query(QueueItem).filter(
                QueueItem.room_id == room_id,
                QueueItem.track_uri == uri,
                QueueItem.status.in_(["pending", "playing"]),
            ).first()
            if duplicate:
                raise ValueError("This track is already in the queue")

        queue_manager.add_track(db, room_id, track_data, user_id, display_name)
        # Cross-check DB status with live memory to prevent accidental autoplay interrupts
        live_playback = room_manager.get_playback(room_id)
        is_playing_live = live_playback and live_playback.get("is_playing", False)
        now_playing = queue_manager.get_now_playing(db, room_id)
        
        next_item = None
        if not now_playing and not is_playing_live:
            next_item = queue_manager.advance_queue(db, room_id)
        queue = queue_manager.get_queue(db, room_id, None)
        return queue, next_item
    finally:
        db.close()


def _db_get_queue_after_next(room_id: str):
    """Get queue after advancing — runs in thread pool."""
    db = SessionLocal()
    try:
        return queue_manager.get_queue(db, room_id, None)
    finally:
        db.close()


def _db_vote_track(room_id: str, queue_item_id: str, user_id: str):
    """Vote for a track and return updated queue — runs in thread pool."""
    db = SessionLocal()
    try:
        queue_manager.vote_track(db, queue_item_id, user_id)
        return queue_manager.get_queue(db, room_id, None)
    finally:
        db.close()



def _db_add_multiple_to_queue(room_id: str, track_list: list[dict], user_id: str, display_name: str):
    from backend.models.room import Room
    from backend.models.user import User
    from backend.models.queue_item import QueueItem
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise ValueError("Room not found")
        if room.queue_mode == "curated" and room.host_user_id != user_id:
            raise ValueError("Queue is locked by host")

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            db.add(User(id=user_id, display_name=display_name))
            db.flush()
        else:
            display_name = user.display_name

        max_pos = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status != "played",
        ).count()

        added_count = 0
        for track_data in track_list:
            uri = track_data.get("uri")
            if not uri or not track_data.get("name"):
                continue

            duplicate = db.query(QueueItem).filter(
                QueueItem.room_id == room_id,
                QueueItem.track_uri == uri,
                QueueItem.status.in_(["pending", "playing"]),
            ).first()
            if duplicate:
                continue

            item = QueueItem(
                room_id=room_id,
                track_uri=uri,
                track_name=track_data["name"],
                artist=track_data["artist"],
                album_art_url=track_data.get("album_art_url"),
                duration_ms=track_data.get("duration_ms", 0),
                added_by_user_id=user_id,
                added_by_name=display_name,
                votes=0,
                position=max_pos + added_count,
                status="pending",
            )
            db.add(item)
            added_count += 1

        if added_count > 0:
            db.commit()

        live_playback = room_manager.get_playback(room_id)
        is_playing_live = live_playback and live_playback.get("is_playing", False)
        now_playing = queue_manager.get_now_playing(db, room_id)
        
        next_item = None
        if not now_playing and not is_playing_live:
            next_item = queue_manager.advance_queue(db, room_id)

        queue = queue_manager.get_queue(db, room_id, None)
        return queue, next_item
    finally:
        db.close()


_room_resolve_locks = {}


async def resolve_room_queue_background(room_id: str, sio: socketio.AsyncServer):
    if room_id not in _room_resolve_locks:
        _room_resolve_locks[room_id] = asyncio.Lock()

    async with _room_resolve_locks[room_id]:
        from backend.models.queue_item import QueueItem
        from backend.services.music_search import music_search_service as lastfm_service
        
        db = SessionLocal()
        try:
            pending_items = db.query(QueueItem).filter(
                QueueItem.room_id == room_id,
                QueueItem.status == "pending"
            ).order_by(QueueItem.position.asc()).all()
            
            items_to_resolve = []
            for item in pending_items:
                uri = item.track_uri
                is_placeholder = item.track_name in ["YouTube Video", "", None, uri] or item.artist in ["YouTube", "Search Query", "", None] or "spotify.com" in str(item.track_name)
                if is_placeholder:
                    items_to_resolve.append(item.id)
        finally:
            db.close()

        for item_id in items_to_resolve:
            db = SessionLocal()
            try:
                item = db.query(QueueItem).filter(QueueItem.id == item_id).first()
                if not item or item.status != "pending":
                    continue
                
                uri = item.track_uri
                resolved_id = None
                
                if not uri or (" " in uri or len(uri) != 11):
                    try:
                        resolved_id = await asyncio.to_thread(lastfm_service.resolve_youtube, uri)
                    except Exception as e:
                        logger.error(f"Background resolve failed for query '{uri}': {e}")
                    
                    if resolved_id:
                        item.track_uri = resolved_id
                        uri = resolved_id
                    else:
                        continue
                
                is_placeholder = item.track_name in ["YouTube Video", "", None, uri] or item.artist in ["YouTube", "Search Query", "", None] or "spotify.com" in str(item.track_name)
                if uri and len(uri) == 11 and is_placeholder:
                    try:
                        metadata = await asyncio.to_thread(lastfm_service.resolve_youtube_metadata, uri)
                        if metadata:
                            item.track_name = metadata["title"]
                            item.artist = metadata["author"]
                            if metadata.get("thumbnail"):
                                item.album_art_url = metadata["thumbnail"]
                    except Exception as e:
                        logger.error(f"Background metadata fetch failed for {uri}: {e}")
                
                db.commit()
                
                queue = queue_manager.get_queue(db, room_id)
                await sio.emit("queue_updated", {"queue": queue}, room=room_id)
            except Exception as e:
                logger.error(f"Error in background item resolve {item_id}: {e}")
            finally:
                db.close()
                
            await asyncio.sleep(0.2)


def _db_play_now(room_id: str, track_data: dict, user_id: str, display_name: str):
    from backend.models.room import Room
    from backend.models.user import User
    from backend.models.queue_item import QueueItem
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise ValueError("Room not found")
            
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            db.add(User(id=user_id, display_name=display_name))
            db.flush()
        else:
            display_name = user.display_name

        uri = track_data.get("uri")
        if uri and (" " in uri or len(uri) != 11):
            from backend.services.music_search import music_search_service as lastfm_service
            resolved_id = lastfm_service.resolve_youtube(uri)
            if resolved_id:
                track_data["uri"] = resolved_id
                uri = resolved_id
            else:
                raise ValueError(f"Could not resolve track: '{uri}'")

        if uri and len(uri) == 11:
            is_placeholder = track_data.get("name") in ["YouTube Video", "", None, uri] or track_data.get("artist") in ["YouTube", "Search Query", "", None] or "spotify.com" in str(track_data.get("name"))
            if is_placeholder:
                from backend.services.music_search import music_search_service as lastfm_service
                metadata = lastfm_service.resolve_youtube_metadata(uri)
                if metadata:
                    track_data["name"] = metadata["title"]
                    track_data["artist"] = metadata["author"]
                    track_data["album_art_url"] = metadata["thumbnail"]

        playing_items = db.query(QueueItem).filter(
            QueueItem.room_id == room_id,
            QueueItem.status == "playing",
        ).all()
        for item in playing_items:
            item.status = "played"

        item = None
        if uri:
            item = db.query(QueueItem).filter(
                QueueItem.room_id == room_id,
                QueueItem.track_uri == uri,
                QueueItem.status == "pending",
            ).first()

        if item:
            item.status = "playing"
        else:
            item = QueueItem(
                room_id=room_id,
                track_uri=uri or track_data["name"],
                track_name=track_data["name"],
                artist=track_data["artist"],
                album_art_url=track_data.get("album_art_url"),
                duration_ms=track_data.get("duration_ms", 0),
                added_by_user_id=user_id,
                added_by_name=display_name,
                votes=0,
                position=0,
                status="playing",
            )
            db.add(item)

        db.commit()
        db.refresh(item)
        queue = queue_manager.get_queue(db, room_id, None)
        return queue, item.to_dict()
    finally:
        db.close()


def register_queue_handlers(sio: socketio.AsyncServer):

    @sio.event
    async def add_to_queue(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            await sio.emit("queue_error", {"message": "Access denied. Room membership required."}, to=sid)
            return
        room_id = info["room_id"]

        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name", "Jammer")

        track_data = {
            "uri": data.get("track_uri", ""),
            "name": data.get("track_name", ""),
            "artist": data.get("artist", ""),
            "album_art_url": data.get("album_art_url"),
            "duration_ms": data.get("duration_ms", 0),
        }

        try:
            queue, next_item = await asyncio.to_thread(
                _db_add_and_get_queue, room_id, track_data, user_id, display_name
            )
            logger.info(f"add_to_queue called for room={room_id} user={user_id} track={(track_data.get('name') or '')[:120]} uri={track_data.get('uri')}")
        except ValueError as ve:
            await sio.emit("queue_error", {"message": str(ve)}, to=sid)
            return
        except Exception as e:
            logger.error(f"add_to_queue error: {e}")
            return

        # Auto-play: if a first track was found, emit track_changed and start sync loop
        if next_item:
            logger.info(f"Auto-playing next_item for room={room_id}: {next_item.get('track_name')} ({next_item.get('track_uri')})")
            # Pre-resolve stream URL before emitting so playback starts instantly
            track_uri = next_item.get("track_uri", "")
            if track_uri and len(track_uri) == 11:
                from backend.routes.queue import pre_resolve_url
                asyncio.create_task(pre_resolve_url(track_uri))
            room_manager.update_playback(
                room_id=room_id,
                track_uri=next_item["track_uri"],
                track_name=next_item["track_name"],
                artist=next_item["artist"],
                album_art_url=next_item.get("album_art_url", ""),
                position_ms=0,
                duration_ms=next_item.get("duration_ms", 0),
                is_playing=True,
            )
            from backend.sockets.playback import ensure_sync_loop
            ensure_sync_loop(room_id, sio)
            await sio.emit("track_changed", next_item, room=room_id)
            # Re-fetch queue after auto-advance (no blocking — already in thread)
            try:
                queue = await asyncio.to_thread(_db_get_queue_after_next, room_id)
            except Exception:
                pass  # use the queue we already have

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

        # Pre-resolve the next track in queue in background (fire-and-forget)
        from backend.sockets.playback import pre_resolve_next_track_background
        asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))
        asyncio.create_task(resolve_room_queue_background(room_id, sio))

    @sio.event
    async def vote_track(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            await sio.emit("queue_error", {"message": "Access denied. Room membership required."}, to=sid)
            return
        room_id = info["room_id"]

        queue_item_id = data.get("queue_item_id")
        if not queue_item_id:
            return

        user_id = session.get("user_id") or f"guest_{sid}"

        try:
            queue = await asyncio.to_thread(_db_vote_track, room_id, queue_item_id, user_id)
        except Exception as e:
            logger.error(f"vote_track error: {e}")
            return

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

    @sio.event
    async def remove_from_queue(sid, data):
        """Host-only: remove a pending or playing track from the queue."""
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        # Only host can remove tracks
        if not room_manager.is_host(room_id, sid):
            await sio.emit("queue_error", {"message": "Only the host can remove tracks"}, to=sid)
            return

        queue_item_id = data.get("queue_item_id")
        if not queue_item_id:
            return

        def _db_remove(room_id, queue_item_id):
            from backend.models.queue_item import QueueItem
            db = SessionLocal()
            try:
                item = db.query(QueueItem).filter(
                    QueueItem.id == queue_item_id,
                    QueueItem.room_id == room_id,
                    QueueItem.status.in_(["pending", "playing"]),
                ).first()
                
                was_playing = False
                if item:
                    if item.status == "playing":
                        was_playing = True
                    db.delete(item)
                    db.commit()
                
                next_item = None
                if was_playing:
                    next_item = queue_manager.advance_queue(db, room_id)
                
                queue = queue_manager.get_queue(db, room_id, None)
                return queue, was_playing, next_item
            finally:
                db.close()

        try:
            queue, was_playing, next_item = await asyncio.to_thread(_db_remove, room_id, queue_item_id)
        except Exception as e:
            logger.error(f"remove_from_queue error: {e}")
            return

        if was_playing:
            if next_item:
                logger.info(f"Advancing to next track after playing track removal: {next_item.get('track_name')}")
                track_uri = next_item.get("track_uri", "")
                if track_uri and len(track_uri) == 11:
                    from backend.routes.queue import pre_resolve_url
                    asyncio.create_task(pre_resolve_url(track_uri))
                room_manager.update_playback(
                    room_id=room_id,
                    track_uri=next_item["track_uri"],
                    track_name=next_item["track_name"],
                    artist=next_item["artist"],
                    album_art_url=next_item.get("album_art_url", ""),
                    position_ms=0,
                    duration_ms=next_item.get("duration_ms", 0),
                    is_playing=True,
                )
                from backend.sockets.playback import ensure_sync_loop
                ensure_sync_loop(room_id, sio)
                await sio.emit("track_changed", next_item, room=room_id)
            else:
                from backend.sockets.playback import stop_sync_loop
                stop_sync_loop(room_id)
                room_manager.update_playback(room_id, "", "", "", "", 0, 0, False)
                await sio.emit("track_changed", None, room=room_id)

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

    @sio.event
    async def reorder_queue(sid, data):
        """Host-only: reorder the pending tracks in the queue."""
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        # Only host can reorder tracks
        if not room_manager.is_host(room_id, sid):
            await sio.emit("queue_error", {"message": "Only the host can reorder tracks"}, to=sid)
            return

        ordered_ids = data.get("ordered_ids")  # list of queue item IDs in new order
        if not ordered_ids:
            return

        def _db_reorder(room_id, ordered_ids):
            from backend.models.queue_item import QueueItem
            from backend.models.vote import Vote
            db = SessionLocal()
            try:
                # Fetch all pending items in this room
                pending_items = db.query(QueueItem).filter(
                    QueueItem.room_id == room_id,
                    QueueItem.status == "pending",
                ).all()
                
                # Build a map of id -> item
                items_map = {item.id: item for item in pending_items}
                
                # Update positions and clear votes in the specified order
                position = 0
                for item_id in ordered_ids:
                    if item_id in items_map:
                        item = items_map[item_id]
                        item.position = position
                        item.votes = 0
                        # Clear existing votes for this item to ensure custom sorting is respected
                        db.query(Vote).filter(Vote.queue_item_id == item.id).delete()
                        position += 1
                
                # For any pending items not in the list (if any), put them at the end
                for item in pending_items:
                    if item.id not in ordered_ids:
                        item.position = position
                        item.votes = 0
                        db.query(Vote).filter(Vote.queue_item_id == item.id).delete()
                        position += 1
                
                db.commit()
                return queue_manager.get_queue(db, room_id, None)
            except Exception as e:
                db.rollback()
                raise e
            finally:
                db.close()

        try:
            queue = await asyncio.to_thread(_db_reorder, room_id, ordered_ids)
        except Exception as e:
            logger.error(f"reorder_queue error: {e}")
            return

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

    @sio.event
    async def shuffle_queue(sid, data):
        """Host-only: shuffle all pending tracks in the queue."""
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        # Only host can shuffle tracks
        if not room_manager.is_host(room_id, sid):
            await sio.emit("queue_error", {"message": "Only the host can shuffle the queue"}, to=sid)
            return

        def _db_shuffle(room_id):
            import random
            from backend.models.queue_item import QueueItem
            from backend.models.vote import Vote
            db = SessionLocal()
            try:
                # Fetch all pending items in this room
                pending_items = db.query(QueueItem).filter(
                    QueueItem.room_id == room_id,
                    QueueItem.status == "pending",
                ).all()
                
                # Shuffle them in memory
                random.shuffle(pending_items)
                
                # Update positions and clear votes in the shuffled order
                for position, item in enumerate(pending_items):
                    item.position = position
                    item.votes = 0
                    # Clear existing votes for this item to ensure shuffled order is respected
                    db.query(Vote).filter(Vote.queue_item_id == item.id).delete()
                
                db.commit()
                return queue_manager.get_queue(db, room_id, None)
            except Exception as e:
                db.rollback()
                raise e
            finally:
                db.close()

        try:
            queue = await asyncio.to_thread(_db_shuffle, room_id)
        except Exception as e:
            logger.error(f"shuffle_queue error: {e}")
            return

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

    @sio.event
    async def add_multiple_to_queue(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            await sio.emit("queue_error", {"message": "Access denied. Room membership required."}, to=sid)
            return
        room_id = info["room_id"]

        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name", "Jammer")

        tracks = data.get("tracks", [])
        if not tracks:
            return

        track_list_data = []
        for track in tracks:
            track_list_data.append({
                "uri": track.get("track_uri", ""),
                "name": track.get("track_name", ""),
                "artist": track.get("artist", ""),
                "album_art_url": track.get("album_art_url"),
                "duration_ms": track.get("duration_ms", 0),
            })

        try:
            queue, next_item = await asyncio.to_thread(
                _db_add_multiple_to_queue, room_id, track_list_data, user_id, display_name
            )
            logger.info(f"add_multiple_to_queue: added {len(track_list_data)} tracks for room={room_id}")
        except ValueError as ve:
            await sio.emit("queue_error", {"message": str(ve)}, to=sid)
            return
        except Exception as e:
            logger.error(f"add_multiple_to_queue error: {e}")
            return

        if next_item:
            logger.info(f"Auto-playing next_item from bulk add for room={room_id}: {next_item.get('track_name')}")
            track_uri = next_item.get("track_uri", "")
            if track_uri and len(track_uri) == 11:
                from backend.routes.queue import pre_resolve_url
                asyncio.create_task(pre_resolve_url(track_uri))
            room_manager.update_playback(
                room_id=room_id,
                track_uri=next_item["track_uri"],
                track_name=next_item["track_name"],
                artist=next_item["artist"],
                album_art_url=next_item.get("album_art_url", ""),
                position_ms=0,
                duration_ms=next_item.get("duration_ms", 0),
                is_playing=True,
            )
            from backend.sockets.playback import ensure_sync_loop
            ensure_sync_loop(room_id, sio)
            await sio.emit("track_changed", next_item, room=room_id)
            try:
                queue = await asyncio.to_thread(_db_get_queue_after_next, room_id)
            except Exception:
                pass

        await sio.emit("queue_updated", {"queue": queue}, room=room_id)
        
        from backend.sockets.playback import pre_resolve_next_track_background
        asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))
        asyncio.create_task(resolve_room_queue_background(room_id, sio))

    @sio.event
    async def play_now(sid, data):
        session = await sio.get_session(sid)
        if not session:
            return

        info = room_manager.get_user_by_sid(sid)
        if not info:
            return
        room_id = info["room_id"]

        if not room_manager.is_host(room_id, sid):
            await sio.emit("queue_error", {"message": "Only the host can play a track instantly"}, to=sid)
            return

        user_id = session.get("user_id") or f"guest_{sid}"
        display_name = session.get("display_name", "Jammer")

        track_data = {
            "uri": data.get("track_uri", ""),
            "name": data.get("track_name", ""),
            "artist": data.get("artist", ""),
            "album_art_url": data.get("album_art_url"),
            "duration_ms": data.get("duration_ms", 0),
        }

        try:
            queue, playing_item = await asyncio.to_thread(
                _db_play_now, room_id, track_data, user_id, display_name
            )
            logger.info(f"play_now called for room={room_id} track={playing_item.get('track_name')}")
        except Exception as e:
            logger.error(f"play_now error: {e}")
            return

        track_uri = playing_item.get("track_uri", "")
        if track_uri and len(track_uri) == 11:
            from backend.routes.queue import pre_resolve_url
            asyncio.create_task(pre_resolve_url(track_uri))

        room_manager.update_playback(
            room_id=room_id,
            track_uri=playing_item["track_uri"],
            track_name=playing_item["track_name"],
            artist=playing_item["artist"],
            album_art_url=playing_item.get("album_art_url", ""),
            position_ms=0,
            duration_ms=playing_item.get("duration_ms", 0),
            is_playing=True,
            loop=False,
        )
        from backend.sockets.playback import ensure_sync_loop
        ensure_sync_loop(room_id, sio)
        
        await sio.emit("track_changed", playing_item, room=room_id)
        await sio.emit("queue_updated", {"queue": queue}, room=room_id)

        # Pre-resolve the new next track in queue in background
        from backend.sockets.playback import pre_resolve_next_track_background
        asyncio.create_task(pre_resolve_next_track_background(room_id, queue, sio))


