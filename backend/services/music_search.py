"""Music search service using iTunes Search API — zero API key required."""

import logging
import re
import urllib.parse
import urllib.request
import json

logger = logging.getLogger(__name__)

ITUNES_API = "https://itunes.apple.com/search"


class MusicSearchService:
    """Search tracks via the Apple iTunes Search API (completely free, no key needed)."""

    def __init__(self):
        self._ytmusic = None  # Lazy singleton
        self._resolve_cache = {}  # In-memory track query resolution cache

    def _get_ytmusic(self):
        """Lazy-init a singleton YTMusic instance (reused across requests)."""
        if self._ytmusic is None:
            try:
                from ytmusicapi import YTMusic
                self._ytmusic = YTMusic()
                logger.info("YTMusic instance initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize YTMusic: {e}")
        return self._ytmusic

    def search_tracks(self, query: str, limit: int = 10) -> list:
        """Search iTunes for tracks. Returns list compatible with existing data shape."""
        if not query or not query.strip():
            return []

        params = urllib.parse.urlencode({
            "term": query.strip(),
            "media": "music",
            "entity": "song",
            "limit": min(limit, 25),
        })

        try:
            url = f"{ITUNES_API}?{params}"
            req = urllib.request.Request(url, headers={"User-Agent": "OpenJam/1.0"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception as e:
            logger.error(f"iTunes API error for query '{query}': {e}")
            return []

        results = data.get("results", [])
        tracks = []
        for item in results[:limit]:
            if item.get("kind") != "song":
                continue

            name = item.get("trackName", "Unknown")
            artist = item.get("artistName", "Unknown")

            # iTunes gives 100x100 artwork — bump to 600x600 for quality
            artwork = (item.get("artworkUrl100") or "").replace("100x100bb", "600x600bb")

            duration_ms = item.get("trackTimeMillis") or 0

            # uri = YouTube search query string — resolved server-side to video ID
            youtube_query = f"{name} {artist} official audio"

            tracks.append({
                "uri": youtube_query,
                "name": name,
                "artist": artist,
                "album_art_url": artwork or None,
                "duration_ms": duration_ms,
            })

        logger.debug(f"iTunes search '{query}' → {len(tracks)} results")
        return tracks

    def resolve_youtube(self, query: str) -> str | None:
        """Resolve a YouTube video ID from a search query.
        
        Strategy:
        1. Check memory cache (fast, 0ms)
        2. Try ytmusicapi (best quality, music-specific)
        3. Fallback: scrape YouTube search results HTML
        """
        if not query or not query.strip():
            return None

        q = query.strip()

        if q in self._resolve_cache:
            logger.debug(f"Resolved query from cache: '{q}' → {self._resolve_cache[q]}")
            return self._resolve_cache[q]

        # Method 1: ytmusicapi
        video_id = self._resolve_via_ytmusic(q)
        if video_id:
            self._resolve_cache[q] = video_id
            return video_id

        # Method 2: YouTube HTML search fallback
        video_id = self._resolve_via_youtube_scrape(q)
        if video_id:
            self._resolve_cache[q] = video_id
            return video_id

        logger.warning(f"All resolve methods failed for query: '{q}'")
        return None

    def _resolve_via_ytmusic(self, query: str) -> str | None:
        """Try resolving via ytmusicapi."""
        try:
            ytm = self._get_ytmusic()
            if not ytm:
                return None

            results = ytm.search(query, filter="songs", limit=1)
            if not results:
                results = ytm.search(query, limit=1)
            if results:
                vid = results[0].get("videoId")
                if vid:
                    logger.debug(f"ytmusicapi resolved '{query}' → {vid}")
                    return vid
        except Exception as e:
            logger.warning(f"ytmusicapi resolve failed for '{query}': {e}")
            # Reset the instance so it reinitializes on next call
            self._ytmusic = None
        return None

    def _resolve_via_youtube_scrape(self, query: str) -> str | None:
        """Fallback: scrape YouTube search results page for a video ID."""
        try:
            encoded = urllib.parse.quote_plus(query)
            url = f"https://www.youtube.com/results?search_query={encoded}"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            })
            with urllib.request.urlopen(req, timeout=8) as resp:
                html = resp.read().decode("utf-8", errors="ignore")

            # Extract video IDs from the page — they appear in "videoId":"XXXXXXXXXXX" patterns
            matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if matches:
                vid = matches[0]
                logger.debug(f"YouTube scrape resolved '{query}' → {vid}")
                return vid
        except Exception as e:
            logger.warning(f"YouTube scrape fallback failed for '{query}': {e}")
        return None

    _reco_cache: list = []
    _reco_cache_date: str = ""

    def get_recommendations(self, limit: int = 12) -> list:
        """Return trending tracks from iTunes Top Songs, with daily rotation.
        
        Caches results per calendar day so they feel fresh each day.
        Shuffles deterministically using the date as seed for variety.
        """
        import random
        from datetime import date

        today = date.today().isoformat()
        if self._reco_cache and self._reco_cache_date == today:
            return self._reco_cache[:limit]

        # Fetch from multiple iTunes genre charts for variety
        charts = [
            "https://itunes.apple.com/us/rss/topsongs/limit=25/json",                   # Overall
            "https://itunes.apple.com/us/rss/topsongs/limit=15/genre=14/json",           # Pop
            "https://itunes.apple.com/us/rss/topsongs/limit=15/genre=18/json",           # Hip-Hop
            "https://itunes.apple.com/us/rss/topsongs/limit=10/genre=21/json",           # Rock
        ]

        all_tracks = []
        seen_names = set()

        for chart_url in charts:
            try:
                req = urllib.request.Request(chart_url, headers={"User-Agent": "OpenJam/1.0"})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    data = json.loads(resp.read().decode())
                entries = data.get("feed", {}).get("entry", [])
                for entry in entries:
                    name = entry.get("im:name", {}).get("label", "")
                    artist = entry.get("im:artist", {}).get("label", "")
                    dedup_key = f"{name.lower()}_{artist.lower()}"
                    if dedup_key in seen_names:
                        continue
                    seen_names.add(dedup_key)
                    art100 = entry.get("im:image", [{}])[-1].get("label", "")
                    art = art100.replace("55x55bb", "600x600bb").replace("170x170bb", "600x600bb")
                    all_tracks.append({
                        "name": name,
                        "artist": artist,
                        "album_art_url": art,
                        "uri": f"{name} {artist} official audio",
                        "duration_ms": 0,
                    })
            except Exception as e:
                logger.warning(f"Chart fetch failed for {chart_url}: {e}")
                continue

        if not all_tracks:
            return []

        # Deterministic daily shuffle — same order for everyone today, different tomorrow
        rng = random.Random(today)
        rng.shuffle(all_tracks)

        self._reco_cache = all_tracks
        self._reco_cache_date = today
        return all_tracks[:limit]

    def resolve_youtube_metadata(self, video_id: str) -> dict | None:
        """Fetch video title, author, and thumbnail using YouTube's oembed API."""
        if not video_id or len(video_id) != 11:
            return None
        try:
            import urllib.request
            import json
            url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            req = urllib.request.Request(url, headers={"User-Agent": "OpenJam/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                return {
                    "title": data.get("title", "YouTube Video"),
                    "author": data.get("author_name", "YouTube"),
                    "thumbnail": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/0.jpg")
                }
        except Exception as e:
            logger.error(f"Failed to fetch YouTube oembed metadata for {video_id}: {e}")
            return None


music_search_service = MusicSearchService()
lastfm_service = music_search_service  # Keep import alias for backward compatibility

