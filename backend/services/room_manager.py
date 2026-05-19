"""In-memory room state manager for tracking active users and playback."""

from datetime import datetime, timezone

FREE_ROOM_LIMIT = 10


class RoomManager:
    def __init__(self):
        self._rooms: dict = {}
        self._sid_map: dict = {}
        self._recently_left: dict = {}  # { "user_id": timestamp }

    def join_room(self, room_id: str, user_id: str, sid: str, display_name: str, avatar_url: str = None, is_premium: bool = False) -> tuple:
        """Join a room. Returns (error_or_none, was_new_user_bool)."""
        import time
        now = time.time()
        
        # Prune old recently_left entries (older than 30s)
        self._recently_left = {u: ts for u, ts in self._recently_left.items() if now - ts < 30.0}

        if room_id not in self._rooms:
            self._rooms[room_id] = {
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

        is_in_room = user_id in self._rooms[room_id]["users"]
        is_recently_left = user_id in self._recently_left
        was_new = not is_in_room and not is_recently_left

        # Clear them from recently left since they are joining now
        if is_recently_left:
            del self._recently_left[user_id]

        limit = FREE_ROOM_LIMIT if not is_premium else 999
        if not is_in_room and len(self._rooms[room_id]["users"]) >= limit:
            return f"Room is full ({limit} listeners max). Try again later.", False

        # Remove old sid mapping for this user if they were already in the room
        if not is_in_room:
            old_info = self._sid_map.get(sid)
            if old_info and old_info["room_id"] != room_id:
                self._leave_room_internal(old_info)
        elif sid in self._sid_map:
            old_info = self._sid_map[sid]
            if old_info["room_id"] != room_id:
                self._leave_room_internal(old_info)

        self._rooms[room_id]["users"][user_id] = {
            "sid": sid,
            "display_name": display_name,
            "avatar_url": avatar_url,
        }
        self._sid_map[sid] = {"user_id": user_id, "room_id": room_id}
        return None, was_new

    def _leave_room_internal(self, info: dict):
        """Internal cleanup without broadcasting."""
        room_id = info["room_id"]
        user_id = info["user_id"]
        if room_id in self._rooms:
            self._rooms[room_id]["users"].pop(user_id, None)
            if not self._rooms[room_id]["users"]:
                del self._rooms[room_id]

    def leave_room(self, sid: str) -> dict | None:
        import time
        info = self._sid_map.pop(sid, None)
        if not info:
            return None
        room_id = info["room_id"]
        user_id = info["user_id"]
        
        # Mark as recently left to prevent duplicate join messages on quick reconnect
        self._recently_left[user_id] = time.time()
        
        if room_id in self._rooms:
            self._rooms[room_id]["users"].pop(user_id, None)
            if not self._rooms[room_id]["users"]:
                del self._rooms[room_id]
        return info

    def get_user_by_sid(self, sid: str) -> dict | None:
        return self._sid_map.get(sid)

    def set_host(self, room_id: str, sid: str):
        if room_id in self._rooms:
            self._rooms[room_id]["host_sid"] = sid

    def is_host(self, room_id: str, sid: str) -> bool:
        if room_id in self._rooms:
            return self._rooms[room_id]["host_sid"] == sid
        return False

    def get_host_sid(self, room_id: str) -> str | None:
        if room_id in self._rooms:
            return self._rooms[room_id]["host_sid"]
        return None

    def get_listener_count(self, room_id: str) -> int:
        if room_id in self._rooms:
            return len(self._rooms[room_id]["users"])
        return 0

    def get_listeners(self, room_id: str) -> list:
        if room_id not in self._rooms:
            return []
        return [
            {"user_id": uid, "display_name": info["display_name"], "avatar_url": info["avatar_url"]}
            for uid, info in self._rooms[room_id]["users"].items()
        ]

    def get_active_room_ids(self) -> list:
        return list(self._rooms.keys())

    def get_listener_counts(self) -> dict:
        return {rid: len(data["users"]) for rid, data in self._rooms.items()}

    def update_playback(self, room_id: str, track_uri: str, track_name: str, artist: str,
                        album_art_url: str, position_ms: int, duration_ms: int, is_playing: bool):
        if room_id in self._rooms:
            # Carry over old skip voters if the track uri hasn't changed (just a pause/play/seek update)
            old_pb = self._rooms[room_id].get("playback", {})
            skip_voters = set()
            if old_pb and old_pb.get("track_uri") == track_uri:
                skip_voters = old_pb.get("skip_voters", set())

            self._rooms[room_id]["playback"] = {
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

    def get_playback(self, room_id: str) -> dict | None:
        if room_id in self._rooms:
            playback = self._rooms[room_id]["playback"]
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
        for room_data in self._rooms.values():
            if user_id in room_data["users"]:
                room_data["users"][user_id]["display_name"] = new_name

    def add_skip_vote(self, room_id: str, user_id: str) -> bool:
        """Returns True if the vote was added, False if already voted."""
        if room_id in self._rooms:
            pb = self._rooms[room_id].get("playback")
            if pb and user_id not in pb.get("skip_voters", set()):
                pb["skip_voters"].add(user_id)
                return True
        return False

    def get_skip_votes(self, room_id: str) -> int:
        if room_id in self._rooms:
            pb = self._rooms[room_id].get("playback")
            if pb:
                return len(pb.get("skip_voters", set()))
        return 0


    def update_user_profile(self, sid: str, new_name: str, avatar_url: str):
        """Update display name and avatar URL for a user by their sid."""
        info = self._sid_map.get(sid)
        if info:
            room_id = info["room_id"]
            user_id = info["user_id"]
            if room_id in self._rooms and user_id in self._rooms[room_id]["users"]:
                if new_name:
                    self._rooms[room_id]["users"][user_id]["display_name"] = new_name
                if avatar_url:
                    self._rooms[room_id]["users"][user_id]["avatar_url"] = avatar_url

    def force_close_room(self, room_id: str):
        """Force-remove a room and all its users from in-memory state.
        Used when host deletes room via REST API."""
        room = self._rooms.pop(room_id, None)
        if room:
            # Clean up all sid mappings for users in this room
            sids_to_remove = [
                sid for sid, info in self._sid_map.items()
                if info["room_id"] == room_id
            ]
            for sid in sids_to_remove:
                del self._sid_map[sid]

room_manager = RoomManager()
