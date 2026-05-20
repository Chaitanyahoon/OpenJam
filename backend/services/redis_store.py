import json
import logging
from backend.config import settings

logger = logging.getLogger(__name__)


class RedisStore:
    """A hybrid state store.
    
    If settings.REDIS_URL is provided, it uses Redis.
    Otherwise, it falls back to in-memory dictionaries.
    """

    def __init__(self):
        self.client = None
        self.redis_url = getattr(settings, "REDIS_URL", None)
        if self.redis_url:
            try:
                import redis
                self.client = redis.Redis.from_url(self.redis_url, decode_responses=True)
                # Ping to check connectivity
                self.client.ping()
                logger.info("Connected to Redis successfully.")
            except Exception as e:
                logger.error(f"Failed to connect to Redis, falling back to in-memory: {e}")
                self.client = None

        if not self.client:
            self._rooms = {}
            self._sid_map = {}
            self._recently_left = {}

    def get_room(self, room_id: str) -> dict | None:
        if self.client:
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
                return room
            return None
        return self._rooms.get(room_id)

    def set_room(self, room_id: str, data: dict):
        if self.client:
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
        else:
            self._rooms[room_id] = data

    def del_room(self, room_id: str):
        if self.client:
            self.client.delete(f"openjam:room:{room_id}")
        else:
            self._rooms.pop(room_id, None)

    def get_sid(self, sid: str) -> dict | None:
        if self.client:
            data = self.client.get(f"openjam:sid:{sid}")
            return json.loads(data) if data else None
        return self._sid_map.get(sid)

    def set_sid(self, sid: str, data: dict):
        if self.client:
            self.client.set(f"openjam:sid:{sid}", json.dumps(data), ex=86400)
        else:
            self._sid_map[sid] = data

    def del_sid(self, sid: str):
        if self.client:
            self.client.delete(f"openjam:sid:{sid}")
        else:
            self._sid_map.pop(sid, None)

    def get_recently_left(self) -> dict:
        if self.client:
            data = self.client.get("openjam:recently_left")
            return json.loads(data) if data else {}
        return self._recently_left

    def set_recently_left(self, data: dict):
        if self.client:
            self.client.set("openjam:recently_left", json.dumps(data), ex=300)
        else:
            self._recently_left = data

    def get_active_room_ids(self) -> list:
        if self.client:
            keys = list(self.client.scan_iter("openjam:room:*"))
            return [k.replace("openjam:room:", "", 1) for k in keys]
        return list(self._rooms.keys())

    def get_sid_map_items(self) -> list:
        """Returns list of (sid, info) pairs."""
        if self.client:
            keys = list(self.client.scan_iter("openjam:sid:*"))
            items = []
            for k in keys:
                val = self.client.get(k)
                if val:
                    sid = k.replace("openjam:sid:", "", 1)
                    items.append((sid, json.loads(val)))
            return items
        return list(self._sid_map.items())

    def get_all_rooms(self) -> dict:
        """Retrieve all active rooms. Used for aggregating server metrics."""
        if self.client:
            keys = list(self.client.scan_iter("openjam:room:*"))
            rooms = {}
            for k in keys:
                val = self.client.get(k)
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
            return rooms
        return self._rooms
