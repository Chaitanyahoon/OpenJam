import json
import logging
import time
from backend.config import settings

logger = logging.getLogger(__name__)


class RedisStore:
    """A hybrid state store with L1 in-memory caching and resilient fallbacks.
    
    If settings.REDIS_URL is provided, it uses Redis with L1 caching.
    If Redis fails, exceeds rate limits, or is offline, it falls back seamlessly.
    """

    def __init__(self):
        self.client = None
        self.redis_url = settings.REDIS_URL
        self._rooms = {}
        self._room_expiries = {}
        self._sid_map = {}
        self._sid_expiries = {}
        self._recently_left = {}
        self._all_rooms_expiry = 0

        if self.redis_url:
            try:
                import redis
                self.client = redis.Redis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_timeout=2.0,
                    socket_connect_timeout=2.0,
                    retry_on_timeout=False,
                )
                # Ping to check connectivity
                self.client.ping()
                logger.info("Connected to Redis successfully.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis, falling back to in-memory: {e}")
                self.client = None

    def get_room(self, room_id: str) -> dict | None:
        now = time.time()
        if room_id in self._rooms and now < self._room_expiries.get(room_id, 0):
            return self._rooms[room_id]

        if self.client:
            try:
                data = self.client.get(f"openjam:room:{room_id}")
                if data:
                    room = json.loads(data)
                    # Convert list back to set for skip_voters
                    if (
                        "playback" in room
                        and room["playback"]
                        and "skip_voters" in room["playback"]
                    ):
                        room["playback"]["skip_voters"] = set(room["playback"]["skip_voters"])
                    self._rooms[room_id] = room
                    self._room_expiries[room_id] = now + 2.5
                    return room
                self._rooms.pop(room_id, None)
                self._room_expiries.pop(room_id, None)
                return None
            except Exception as e:
                logger.warning(f"Redis get_room failed for {room_id}, falling back to memory: {e}")
                return self._rooms.get(room_id)
        return self._rooms.get(room_id)

    def set_room(self, room_id: str, data: dict):
        self._rooms[room_id] = data
        self._room_expiries[room_id] = time.time() + 2.5
        self._all_rooms_expiry = 0
        if self.client:
            try:
                # Convert set to list for JSON serialization
                serialized = data.copy()
                if (
                    "playback" in serialized
                    and serialized["playback"]
                    and "skip_voters" in serialized["playback"]
                ):
                    serialized["playback"] = serialized["playback"].copy()
                    if isinstance(serialized["playback"]["skip_voters"], set):
                        serialized["playback"]["skip_voters"] = list(
                            serialized["playback"]["skip_voters"]
                        )
                self.client.set(f"openjam:room:{room_id}", json.dumps(serialized), ex=86400)
            except Exception as e:
                logger.warning(f"Redis set_room failed for {room_id}: {e}")

    def del_room(self, room_id: str):
        self._rooms.pop(room_id, None)
        self._room_expiries.pop(room_id, None)
        self._all_rooms_expiry = 0
        if self.client:
            try:
                self.client.delete(f"openjam:room:{room_id}")
            except Exception as e:
                logger.warning(f"Redis del_room failed for {room_id}: {e}")

    delete_room = del_room

    def get_sid(self, sid: str) -> dict | None:
        now = time.time()
        if sid in self._sid_map and now < self._sid_expiries.get(sid, 0):
            return self._sid_map[sid]

        if self.client:
            try:
                data = self.client.get(f"openjam:sid:{sid}")
                if data:
                    parsed = json.loads(data)
                    self._sid_map[sid] = parsed
                    self._sid_expiries[sid] = now + 5.0
                    return parsed
                self._sid_map.pop(sid, None)
                self._sid_expiries.pop(sid, None)
                return None
            except Exception as e:
                logger.warning(f"Redis get_sid failed for {sid}: {e}")
                return self._sid_map.get(sid)
        return self._sid_map.get(sid)

    def set_sid(self, sid: str, data: dict):
        self._sid_map[sid] = data
        self._sid_expiries[sid] = time.time() + 5.0
        if self.client:
            try:
                self.client.set(f"openjam:sid:{sid}", json.dumps(data), ex=86400)
            except Exception as e:
                logger.warning(f"Redis set_sid failed for {sid}: {e}")

    def del_sid(self, sid: str):
        self._sid_map.pop(sid, None)
        self._sid_expiries.pop(sid, None)
        if self.client:
            try:
                self.client.delete(f"openjam:sid:{sid}")
            except Exception as e:
                logger.warning(f"Redis del_sid failed for {sid}: {e}")

    def get_recently_left(self) -> dict:
        if self.client:
            try:
                data = self.client.get("openjam:recently_left")
                if data:
                    parsed = json.loads(data)
                    self._recently_left = parsed
                    return parsed
                return self._recently_left
            except Exception as e:
                logger.warning(f"Redis get_recently_left failed: {e}")
                return self._recently_left
        return self._recently_left

    def set_recently_left(self, data: dict):
        self._recently_left = data
        if self.client:
            try:
                self.client.set("openjam:recently_left", json.dumps(data), ex=300)
            except Exception as e:
                logger.warning(f"Redis set_recently_left failed: {e}")

    def is_token_revoked(self, token: str) -> bool:
        if self.client:
            try:
                return bool(self.client.exists(f"openjam:revoked:{token}"))
            except Exception as e:
                logger.warning(f"Redis is_token_revoked failed: {e}")
                return token in settings.REVOKED_TOKENS
        return token in settings.REVOKED_TOKENS

    def revoke_token(self, token: str) -> None:
        settings.REVOKED_TOKENS.add(token)
        if self.client:
            try:
                self.client.set(f"openjam:revoked:{token}", "1", ex=86400 * 30)
            except Exception as e:
                logger.warning(f"Redis revoke_token failed: {e}")

    def get_active_room_ids(self) -> list:
        if self.client:
            try:
                keys = list(self.client.scan_iter("openjam:room:*"))
                return [k.replace("openjam:room:", "", 1) for k in keys]
            except Exception as e:
                logger.warning(f"Redis get_active_room_ids failed: {e}")
                return list(self._rooms.keys())
        return list(self._rooms.keys())

    def get_sid_map_items(self) -> list:
        """Returns list of (sid, info) pairs."""
        if self.client:
            try:
                keys = list(self.client.scan_iter("openjam:sid:*"))
                if not keys:
                    return list(self._sid_map.items())
                # Use MGET to fetch all SID mappings in a single connection round-trip
                values = self.client.mget(keys)
                items = []
                for k, val in zip(keys, values):
                    if val:
                        sid = k.replace("openjam:sid:", "", 1)
                        items.append((sid, json.loads(val)))
                return items
            except Exception as e:
                logger.warning(f"Redis get_sid_map_items failed: {e}")
                return list(self._sid_map.items())
        return list(self._sid_map.items())

    def get_all_rooms(self) -> dict:
        """Retrieve all active rooms. Used for aggregating server metrics."""
        now = time.time()
        if now < self._all_rooms_expiry and self._rooms:
            return self._rooms

        if self.client:
            try:
                keys = list(self.client.scan_iter("openjam:room:*"))
                if not keys:
                    return self._rooms
                # Use MGET to fetch all rooms in a single connection round-trip
                values = self.client.mget(keys)
                rooms = {}
                for k, val in zip(keys, values):
                    if val:
                        room_id = k.replace("openjam:room:", "", 1)
                        room = json.loads(val)
                        if (
                            "playback" in room
                            and room["playback"]
                            and "skip_voters" in room["playback"]
                        ):
                            room["playback"]["skip_voters"] = set(
                                room["playback"]["skip_voters"]
                            )
                        rooms[room_id] = room
                        self._rooms[room_id] = room
                self._all_rooms_expiry = now + 5.0
                return rooms
            except Exception as e:
                logger.warning(f"Redis get_all_rooms failed: {e}")
                return self._rooms
        return self._rooms
