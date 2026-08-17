"""Room state manager utilizing Redis (with fallback to in-memory) for tracking active users and playback."""

import time
from datetime import datetime, timezone
from backend.services.redis_store import RedisStore

FREE_ROOM_LIMIT = 10


class RoomManager:
    def __init__(self):
        self.store = RedisStore()

    def join_room(self, room_id: str, user_id: str, sid: str, display_name: str, avatar_url: str = None, is_premium: bool = False, is_registered: bool = False) -> tuple:
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
                    "loop": False,
                    "is_buffering": False,
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

        # Clean up old sid mapping from store if user is rejoining from a new socket connection
        if is_in_room:
            old_sid = room["users"][user_id].get("sid")
            if old_sid and old_sid != sid:
                self.store.del_sid(old_sid)
        
        # Remove old sid mapping for this user if they were already in a room on a different connection
        old_info = self.store.get_sid(sid)
        if old_info and old_info["room_id"] != room_id:
            self._leave_room_internal(old_info, sid)

        # Refresh room object in case _leave_room_internal changed it
        room = self.store.get_room(room_id) or room

        if "empty_since" in room:
            del room["empty_since"]

        room["users"][user_id] = {
            "sid": sid,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "is_registered": is_registered,
        }
        self.store.set_room(room_id, room)
        self.store.set_sid(sid, {"user_id": user_id, "room_id": room_id})
        return None, was_new

    def _leave_room_internal(self, info: dict, sid: str):
        """Internal cleanup without broadcasting."""
        room_id = info["room_id"]
        user_id = info["user_id"]
        room = self.store.get_room(room_id)
        if room:
            user_info = room["users"].get(user_id)
            if user_info and user_info.get("sid") == sid:
                room["users"].pop(user_id, None)
                if not room["users"] and "empty_since" not in room:
                    room["empty_since"] = time.time()
                # Clear skip vote if user left
                pb = room.get("playback")
                if pb:
                    skip_voters = pb.get("skip_voters", set())
                    if isinstance(skip_voters, set):
                        skip_voters.discard(user_id)
                    pb["skip_voters"] = skip_voters
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
            user_info = room["users"].get(user_id)
            if user_info and user_info.get("sid") == sid:
                room["users"].pop(user_id, None)
                if not room["users"] and "empty_since" not in room:
                    room["empty_since"] = time.time()
                # Clear skip vote if user left
                pb = room.get("playback")
                if pb:
                    skip_voters = pb.get("skip_voters", set())
                    if isinstance(skip_voters, set):
                        skip_voters.discard(user_id)
                    pb["skip_voters"] = skip_voters
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

    def can_control(self, room_id: str, sid: str) -> bool:
        """Check if SID has playback control: either host or guest controls enabled."""
        room = self.store.get_room(room_id)
        if not room:
            return False
        if room.get("host_sid") == sid:
            return True
        return room.get("allow_guest_controls", False)

    def set_guest_controls(self, room_id: str, allow: bool):
        """Set whether guests can control playback in this room."""
        room = self.store.get_room(room_id)
        if room:
            room["allow_guest_controls"] = allow
            self.store.set_room(room_id, room)

    def get_guest_controls(self, room_id: str) -> bool:
        """Get whether guest controls are enabled for this room."""
        room = self.store.get_room(room_id)
        if room:
            return room.get("allow_guest_controls", False)
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
            {
                "user_id": uid,
                "display_name": info["display_name"],
                "avatar_url": info["avatar_url"],
                "is_registered": info.get("is_registered", False)
            }
            for uid, info in room["users"].items()
        ]

    def get_active_room_ids(self) -> list:
        return self.store.get_active_room_ids()

    def get_listener_counts(self) -> dict:
        rooms = self.store.get_all_rooms()
        return {rid: len(data["users"]) for rid, data in rooms.items()}

    def update_playback(self, room_id: str, track_uri: str, track_name: str, artist: str,
                        album_art_url: str, position_ms: int, duration_ms: int, is_playing: bool, loop: bool = False, is_buffering: bool = False):
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
                "loop": loop,
                "is_buffering": is_buffering,
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

    # ─── MUSIC TRIVIA STATE HELPERS ───────────────────────────────────────

    def init_trivia_session(
        self,
        room_id: str,
        round_id: str,
        correct_track: dict,
        options: list,
        duration_ms: int = 10000,
        start_timestamp: int = None,
        correct_option_id: int = 0
    ) -> dict | None:
        """Initialize or start a new round in a trivia session for a room."""
        room = self.store.get_room(room_id)
        if not room:
            return None

        now_ms = int(time.time() * 1000)
        start_ts = start_timestamp if start_timestamp is not None else now_ms

        existing_trivia = room.get("trivia") or {}
        scores = existing_trivia.get("scores", {})
        round_number = existing_trivia.get("round_number", 0) + 1

        trivia_state = {
            "active": True,
            "round_id": round_id,
            "round_number": round_number,
            "correct_option_id": correct_option_id,
            "correct_track": correct_track,
            "options": options,
            "start_timestamp": start_ts,
            "duration_ms": duration_ms,
            "answers": {},
            "scores": scores,
        }

        room["trivia"] = trivia_state
        self.store.set_room(room_id, room)
        return trivia_state

    def get_trivia_state(self, room_id: str) -> dict | None:
        """Get the current trivia session state for a room."""
        room = self.store.get_room(room_id)
        if room:
            return room.get("trivia")
        return None

    def submit_trivia_answer(
        self,
        room_id: str,
        round_id: str,
        user_id: str,
        option_id: int,
        display_name: str = "",
        avatar_url: str = "",
        client_time_ms: int = None
    ) -> dict | None:
        """Process and score a listener's trivia answer based on accuracy and speed.
        Returns answer record dict or None if invalid/duplicate.
        """
        room = self.store.get_room(room_id)
        if not room or "trivia" not in room or not room["trivia"]:
            return None

        trivia = room["trivia"]
        if not trivia.get("active") or trivia.get("round_id") != round_id:
            return None

        answers = trivia.setdefault("answers", {})
        if user_id in answers:
            # Duplicate answer ignored
            return None

        start_ts = trivia.get("start_timestamp", 0)
        duration_ms = trivia.get("duration_ms", 10000)
        now_ms = int(time.time() * 1000)
        elapsed_ms = max(0, now_ms - start_ts)

        # 500ms network latency grace period
        is_late = elapsed_ms > (duration_ms + 500)
        correct_option_id = trivia.get("correct_option_id")
        is_correct = (not is_late) and (option_id == correct_option_id)

        if is_correct:
            base_points = 500
            # Speed bonus up to 500 points based on remaining time in milliseconds
            speed_bonus = max(0, int((duration_ms - elapsed_ms) * 0.05))
            round_points = base_points + speed_bonus
        else:
            round_points = 0

        scores = trivia.setdefault("scores", {})
        user_score_data = scores.setdefault(user_id, {
            "user_id": user_id,
            "display_name": display_name or "Listener",
            "avatar_url": avatar_url or "",
            "total_score": 0,
            "streak": 0,
        })
        if display_name:
            user_score_data["display_name"] = display_name
        if avatar_url:
            user_score_data["avatar_url"] = avatar_url

        if is_correct:
            user_score_data["total_score"] += round_points
            user_score_data["streak"] += 1
        else:
            user_score_data["streak"] = 0

        answer_record = {
            "user_id": user_id,
            "display_name": user_score_data["display_name"],
            "avatar_url": user_score_data["avatar_url"],
            "option_id": option_id,
            "is_correct": is_correct,
            "round_points": round_points,
            "total_score": user_score_data["total_score"],
            "streak": user_score_data["streak"],
            "elapsed_ms": elapsed_ms,
        }

        answers[user_id] = answer_record
        self.store.set_room(room_id, room)
        return answer_record

    def end_trivia_round(self, room_id: str, round_id: str = None) -> dict | None:
        """Conclude the active trivia round, compute round scores and sorted leaderboard."""
        room = self.store.get_room(room_id)
        if not room or "trivia" not in room or not room["trivia"]:
            return None

        trivia = room["trivia"]
        if round_id and trivia.get("round_id") != round_id:
            return None

        trivia["active"] = False

        round_scores = list(trivia.get("answers", {}).values())

        scores = trivia.get("scores", {})
        sorted_users = sorted(
            scores.values(),
            key=lambda u: (u.get("total_score", 0), u.get("streak", 0)),
            reverse=True
        )

        leaderboard = []
        for rank, u in enumerate(sorted_users, 1):
            leaderboard.append({
                "rank": rank,
                "user_id": u.get("user_id"),
                "display_name": u.get("display_name", "Listener"),
                "avatar_url": u.get("avatar_url", ""),
                "total_score": u.get("total_score", 0),
                "streak": u.get("streak", 0),
            })

        correct_track = trivia.get("correct_track") or {}
        correct_answer = {
            "track_name": correct_track.get("track_name") or correct_track.get("name") or "Unknown Track",
            "artist": correct_track.get("artist") or "Unknown Artist",
            "album_art_url": correct_track.get("album_art_url") or correct_track.get("src") or "",
            "track_uri": correct_track.get("track_uri") or correct_track.get("uri") or "",
        }

        result = {
            "round_id": trivia.get("round_id"),
            "round_number": trivia.get("round_number", 1),
            "correct_option_id": trivia.get("correct_option_id"),
            "correct_answer": correct_answer,
            "round_scores": round_scores,
            "leaderboard": leaderboard,
        }

        self.store.set_room(room_id, room)
        return result

    def get_trivia_leaderboard(self, room_id: str) -> list:
        """Get the current sorted leaderboard list for a room's trivia session."""
        room = self.store.get_room(room_id)
        if not room or "trivia" not in room or not room["trivia"]:
            return []

        scores = room["trivia"].get("scores", {})
        sorted_users = sorted(
            scores.values(),
            key=lambda u: (u.get("total_score", 0), u.get("streak", 0)),
            reverse=True
        )
        return [
            {
                "rank": rank,
                "user_id": u.get("user_id"),
                "display_name": u.get("display_name", "Listener"),
                "avatar_url": u.get("avatar_url", ""),
                "total_score": u.get("total_score", 0),
                "streak": u.get("streak", 0),
            }
            for rank, u in enumerate(sorted_users, 1)
        ]

    def clear_trivia_session(self, room_id: str) -> dict | None:
        """End and clear the trivia session from a room, returning final summary."""
        room = self.store.get_room(room_id)
        if not room or "trivia" not in room:
            return None

        final_trivia = room.pop("trivia", None)
        self.store.set_room(room_id, room)
        return final_trivia


room_manager = RoomManager()
