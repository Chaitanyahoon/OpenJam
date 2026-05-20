"""Room state manager utilizing Redis (with fallback to in-memory) for tracking active users and playback."""

import time
from datetime import datetime, timezone
from backend.services.redis_store import RedisStore

FREE_ROOM_LIMIT = 10


class RoomManager:
    def __init__(self):
        self.store = RedisStore()

    def join_room(self, room_id: str, user_id: str, sid: str, display_name: str, avatar_url: str = None, is_premium: bool = False) -> tuple:
        """Join a room. Returns (error_or_none, was_new_user_bool)."""
        now = time.time()
        
        # Prune old recently_left entries (older than 30s)
        recently_left = self.store.get_recently_left()
        recently_left = {u: ts for u, ts in recently_left.items() if now - ts < 30.0}

        room = self.store.get_room(room_id)
        if not room:
            room = {
                "users": {},
                "host_sid": None,
                "playback": {
                    "track_uri": None,
                    "track_name": None,
                    "artist": None,
                    "album_art_url": None,
                    "position_ms": 0,
                    "duration_ms": 0,
                    "is_playing": False,
                    "updated_at": None,
                    "skip_voters": set(),
                },
            }

        is_in_room = user_id in room["users"]
        is_recently_left = user_id in recently_left
        was_new = not is_in_room and not is_recently_left

        # Clear them from recently left since they are joining now
        if is_recently_left:
            del recently_left[user_id]
        self.store.set_recently_left(recently_left)

        limit = FREE_ROOM_LIMIT if not is_premium else 999
        if not is_in_room and len(room["users"]) >= limit:
            return f"Room is full ({limit} listeners max). Try again later.", False

        # Remove old sid mapping for this user if they were already in the room
        if not is_in_room:
            old_info = self.store.get_sid(sid)
            if old_info and old_info["room_id"] != room_id:
                self._leave_room_internal(old_info)
        else:
            old_info = self.store.get_sid(sid)
            if old_info and old_info["room_id"] != room_id:
                self._leave_room_internal(old_info)

        # Refresh room object in case _leave_room_internal changed it
        room = self.store.get_room(room_id) or room

        room["users"][user_id] = {
            "sid": sid,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }
        self.store.set_room(room_id, room)
        self.store.set_sid(sid, {"user_id": user_id, "room_id": room_id})
        return None, was_new

    def _leave_room_internal(self, info: dict):
        """Internal cleanup without broadcasting."""
        room_id = info["room_id"]
        user_id = info["user_id"]
        room = self.store.get_room(room_id)
        if room:
            room["users"].pop(user_id, None)
            if not room["users"]:
                self.store.del_room(room_id)
            else:
                self.store.set_room(room_id, room)

    def leave_room(self, sid: str) -> dict | None:
        info = self.store.get_sid(sid)
        if not info:
            return None
        self.store.del_sid(sid)
        room_id = info["room_id"]
        user_id = info["user_id"]
        
        # Mark as recently left to prevent duplicate join messages on quick reconnect
        recently_left = self.store.get_recently_left()
        recently_left[user_id] = time.time()
        self.store.set_recently_left(recently_left)
        
        room = self.store.get_room(room_id)
        if room:
            room["users"].pop(user_id, None)
            if not room["users"]:
                self.store.del_room(room_id)
            else:
                self.store.set_room(room_id, room)
        return info

    def get_user_by_sid(self, sid: str) -> dict | None:
        return self.store.get_sid(sid)

    def set_host(self, room_id: str, sid: str):
        room = self.store.get_room(room_id)
        if room:
            room["host_sid"] = sid
            self.store.set_room(room_id, room)

    def is_host(self, room_id: str, sid: str) -> bool:
        room = self.store.get_room(room_id)
        if room:
            return room.get("host_sid") == sid
        return False

    def get_host_sid(self, room_id: str) -> str | None:
        room = self.store.get_room(room_id)
        if room:
            return room.get("host_sid")
        return None

    def get_listener_count(self, room_id: str) -> int:
        room = self.store.get_room(room_id)
        if room:
            return len(room["users"])
        return 0

    def get_listeners(self, room_id: str) -> list:
        room = self.store.get_room(room_id)
        if not room:
            return []
        return [
            {"user_id": uid, "display_name": info["display_name"], "avatar_url": info["avatar_url"]}
            for uid, info in room["users"].items()
        ]

    def get_active_room_ids(self) -> list:
        return self.store.get_active_room_ids()

    def get_listener_counts(self) -> dict:
        rooms = self.store.get_all_rooms()
        return {rid: len(data["users"]) for rid, data in rooms.items()}

    def update_playback(self, room_id: str, track_uri: str, track_name: str, artist: str,
                        album_art_url: str, position_ms: int, duration_ms: int, is_playing: bool):
        room = self.store.get_room(room_id)
        if room:
            # Carry over old skip voters if the track uri hasn't changed (just a pause/play/seek update)
            old_pb = room.get("playback", {})
            skip_voters = set()
            if old_pb and old_pb.get("track_uri") == track_uri:
                skip_voters = old_pb.get("skip_voters", set())

            room["playback"] = {
                "track_uri": track_uri,
                "track_name": track_name,
                "artist": artist,
                "album_art_url": album_art_url,
                "position_ms": position_ms,
                "duration_ms": duration_ms,
                "is_playing": is_playing,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "skip_voters": skip_voters,
            }
            self.store.set_room(room_id, room)

    def get_playback(self, room_id: str) -> dict | None:
        room = self.store.get_room(room_id)
        if room:
            playback = room.get("playback")
            if playback is None:
                return None
            serialized_playback = playback.copy()
            skip_voters = serialized_playback.get("skip_voters")
            if isinstance(skip_voters, set):
                serialized_playback["skip_voters"] = list(skip_voters)
            return serialized_playback
        return None

    def update_display_name(self, user_id: str, new_name: str):
        """Update display name for a user across all rooms they are in."""
        rooms = self.store.get_all_rooms()
        for room_id, room in rooms.items():
            if user_id in room["users"]:
                room["users"][user_id]["display_name"] = new_name
                self.store.set_room(room_id, room)

    def add_skip_vote(self, room_id: str, user_id: str) -> bool:
        """Returns True if the vote was added, False if already voted."""
        room = self.store.get_room(room_id)
        if room:
            pb = room.get("playback")
            if pb:
                skip_voters = pb.get("skip_voters", set())
                if user_id not in skip_voters:
                    skip_voters.add(user_id)
                    pb["skip_voters"] = skip_voters
                    self.store.set_room(room_id, room)
                    return True
        return False

    def get_skip_votes(self, room_id: str) -> int:
        room = self.store.get_room(room_id)
        if room:
            pb = room.get("playback")
            if pb:
                return len(pb.get("skip_voters", set()))
        return 0

    def update_user_profile(self, sid: str, new_name: str, avatar_url: str):
        """Update display name and avatar URL for a user by their sid."""
        info = self.store.get_sid(sid)
        if info:
            room_id = info["room_id"]
            user_id = info["user_id"]
            room = self.store.get_room(room_id)
            if room and user_id in room["users"]:
                if new_name:
                    room["users"][user_id]["display_name"] = new_name
                if avatar_url:
                    room["users"][user_id]["avatar_url"] = avatar_url
                self.store.set_room(room_id, room)

    def force_close_room(self, room_id: str):
        """Force-remove a room and all its users.
        Used when host deletes room via REST API."""
        room = self.store.get_room(room_id)
        if room:
            self.store.del_room(room_id)
            # Clean up all sid mappings for users in this room
            for sid, info in self.store.get_sid_map_items():
                if info["room_id"] == room_id:
                    self.store.del_sid(sid)


room_manager = RoomManager()
