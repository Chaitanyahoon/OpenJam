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
        1. Try ytmusicapi (best quality, music-specific)
        2. Fallback: scrape YouTube search results HTML
        """
        if not query or not query.strip():
            return None

        q = query.strip()

        # Method 1: ytmusicapi
        video_id = self._resolve_via_ytmusic(q)
        if video_id:
            return video_id

        # Method 2: YouTube HTML search fallback
        video_id = self._resolve_via_youtube_scrape(q)
        if video_id:
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

    def get_recommendations(self, limit: int = 12) -> list:
        """Return popular tracks from the iTunes top songs chart."""
        try:
            req = urllib.request.Request(
                "https://itunes.apple.com/us/rss/topsongs/limit=20/json",
                headers={"User-Agent": "OpenJam/1.0"},
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except Exception as e:
            logger.error(f"Recommendations error: {e}")
            return []

        entries = data.get("feed", {}).get("entry", [])
        tracks = []
        for entry in entries[:limit]:
            name = entry.get("im:name", {}).get("label", "")
            artist = entry.get("im:artist", {}).get("label", "")
            art100 = entry.get("im:image", [{}])[-1].get("label", "")
            art = art100.replace("55x55bb", "600x600bb").replace("170x170bb", "600x600bb")
            tracks.append({
                "name": name,
                "artist": artist,
                "album_art_url": art,
                "uri": f"{name} {artist} official audio",
                "duration_ms": 0,
            })
        return tracks


music_search_service = MusicSearchService()
lastfm_service = music_search_service  # Keep import alias for backward compatibility
