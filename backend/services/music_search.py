"""Music search service using iTunes Search API — zero API key required."""

import logging
import re
import urllib.parse
import json
import asyncio
import httpx

logger = logging.getLogger(__name__)

ITUNES_API = "https://itunes.apple.com/search"


class MusicSearchService:
    """Search tracks via the Apple iTunes Search API (completely free, no key needed)."""

    def __init__(self):
        import threading
        self._ytmusic = None  # Lazy singleton
        self._resolve_cache = {}  # In-memory track query resolution cache
        self._search_cache = {}  # In-memory search results cache
        self._ytmusic_lock = threading.Lock()
        threading.Thread(target=self._init_ytmusic_eagerly, daemon=True).start()

    def _init_ytmusic_eagerly(self):
        """Warm up YTMusic in a background thread to prevent first-request lag."""
        try:
            self._get_ytmusic()
        except Exception as e:
            logger.error(f"Eager YTMusic initialization failed: {e}")

    def _get_ytmusic(self):
        """Lazy-init a singleton YTMusic instance (reused across requests)."""
        if self._ytmusic is None:
            with self._ytmusic_lock:
                if self._ytmusic is None:
                    try:
                        from ytmusicapi import YTMusic
                        self._ytmusic = YTMusic()
                        logger.info("YTMusic instance initialized successfully")
                    except Exception as e:
                        logger.error(f"Failed to initialize YTMusic: {e}")
        return self._ytmusic

    async def search_tracks(self, query: str, limit: int = 12) -> list:
        """Search tracks asynchronously using iTunes API, YouTube Music, and YouTube search fallback.
        
        Runs all 3 providers in parallel for instant, comprehensive results.
        """
        if not query or not query.strip():
            return []

        q = query.strip().lower()
        cache_key = f"{q}_{limit}"
        if cache_key in self._search_cache:
            logger.debug(f"Search results for '{query}' retrieved from memory cache")
            return self._search_cache[cache_key]

        # Check Redis cache
        try:
            from backend.services.redis_store import RedisStore
            redis_store = RedisStore()
            if redis_store.client:
                cached_data = redis_store.client.get(f"openjam:search:{cache_key}")
                if cached_data:
                    tracks = json.loads(cached_data)
                    self._search_cache[cache_key] = tracks
                    logger.debug(f"Search results for '{query}' retrieved from Redis cache")
                    return tracks
        except Exception as e:
            logger.warning(f"Failed to check Redis search cache: {e}")

        import html as html_lib

        async def _search_itunes():
            params = urllib.parse.urlencode({
                "term": query.strip(),
                "media": "music",
                "entity": "song",
                "limit": min(limit, 10),
            })
            try:
                url = f"{ITUNES_API}?{params}"
                async with httpx.AsyncClient(timeout=2.5) as client:
                    resp = await client.get(url, headers={"User-Agent": "OpenJam/1.0"})
                    if resp.status_code == 200:
                        data = resp.json()
                        results = data.get("results", [])
                        tracks = []
                        for item in results:
                            if item.get("kind") != "song":
                                continue
                            name = item.get("trackName", "Unknown")
                            artist = item.get("artistName", "Unknown")
                            artwork = (item.get("artworkUrl100") or "").replace("100x100bb", "600x600bb")
                            duration_ms = item.get("trackTimeMillis") or 0
                            youtube_query = f"{name} {artist} official audio"
                            tracks.append({
                                "uri": youtube_query,
                                "name": name,
                                "artist": artist,
                                "album_art_url": artwork or None,
                                "duration_ms": duration_ms,
                            })
                        return tracks
            except Exception as e:
                logger.debug(f"iTunes search failed: {e}")
            return []

        async def _search_youtube_scrape():
            """Fast YouTube HTML search fallback for remixes, OSTs, and non-Western tracks."""
            try:
                encoded = urllib.parse.quote_plus(query.strip())
                url = f"https://www.youtube.com/results?search_query={encoded}"
                async with httpx.AsyncClient(timeout=2.8) as client:
                    resp = await client.get(url, headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept-Language": "en-US,en;q=0.9",
                    })
                    if resp.status_code == 200:
                        resp_html = resp.text
                        tracks = []
                        # Extract videoId, title, and channel
                        video_matches = re.findall(
                            r'\"videoRenderer\":\{\"videoId\":\"([a-zA-Z0-9_-]{11})\".*?\"title\":\{\"runs\":\[\{\"text\":\"(.*?)\"\}\].*?\"ownerText\":\{\"runs\":\[\{\"text\":\"(.*?)\"\}\]',
                            resp_html
                        )
                        for vid, title, channel in video_matches[:limit]:
                            clean_title = html_lib.unescape(title).replace("\\", "")
                            clean_channel = html_lib.unescape(channel).replace("\\", "")
                            tracks.append({
                                "uri": vid,
                                "name": clean_title,
                                "artist": clean_channel,
                                "album_art_url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                                "duration_ms": 210000,
                            })
                        return tracks
            except Exception as e:
                logger.debug(f"YouTube scrape search failed: {e}")
            return []

        # Run YTMusic, YouTube scrape, and iTunes in parallel with tight timeouts
        ytmusic_task = asyncio.to_thread(self._search_via_ytmusic, query, limit)
        yt_scrape_task = _search_youtube_scrape()
        itunes_task = _search_itunes()

        gathered = await asyncio.gather(ytmusic_task, yt_scrape_task, itunes_task, return_exceptions=True)
        ytm_tracks = gathered[0] if isinstance(gathered[0], list) else []
        yt_scrape_tracks = gathered[1] if isinstance(gathered[1], list) else []
        itunes_tracks = gathered[2] if isinstance(gathered[2], list) else []

        # Merge results, prioritizing YouTube Music (official & direct videoId), then YouTube Scrape, then iTunes
        tracks = []
        seen = set()

        for t in ytm_tracks:
            vid = t.get("uri")
            if vid and len(vid) == 11 and vid not in seen:
                tracks.append(t)
                seen.add(vid)

        for t in yt_scrape_tracks:
            vid = t.get("uri")
            if vid and len(vid) == 11 and vid not in seen:
                tracks.append(t)
                seen.add(vid)

        for t in itunes_tracks:
            key = f"{t['name'].lower()}_{t['artist'].lower()}"
            if key not in seen:
                tracks.append(t)
                seen.add(key)

        logger.debug(f"Combined search '{query}' → {len(tracks)} results")

        final_tracks = tracks[:limit]
        if final_tracks:
            self._search_cache[cache_key] = final_tracks
            if len(self._search_cache) > 300:
                first_key = next(iter(self._search_cache))
                self._search_cache.pop(first_key, None)

            try:
                from backend.services.redis_store import RedisStore
                redis_store = RedisStore()
                if redis_store.client:
                    redis_store.client.setex(f"openjam:search:{cache_key}", 86400, json.dumps(final_tracks))
            except Exception as e:
                logger.warning(f"Failed to save search results to Redis: {e}")

        return final_tracks

    def _search_via_ytmusic(self, query: str, limit: int = 10) -> list:
        """Search YouTube Music as a fallback when iTunes returns no results."""
        try:
            ytm = self._get_ytmusic()
            if not ytm:
                return []
            
            # Try searching with filter='songs' first for best results
            results = []
            try:
                results = ytm.search(query, filter="songs", limit=limit)
            except Exception as e:
                logger.debug(f"YTMusic filtered search: {e}")
                
            # If no results, do a general search
            if not results:
                try:
                    results = ytm.search(query, limit=limit)
                except Exception as e:
                    logger.debug(f"YTMusic general search: {e}")
                    return []
                    
            tracks = []
            for r in results[:limit]:
                video_id = r.get("videoId")
                if not video_id:
                    continue
                    
                name = r.get("title", "Unknown Track")
                
                # Artists
                artists_list = r.get("artists", [])
                artist = "Unknown Artist"
                if artists_list:
                    if isinstance(artists_list, list):
                        artist = ", ".join([a.get("name", "") for a in artists_list if a.get("name")])
                    elif isinstance(artists_list, str):
                        artist = artists_list
                        
                # Thumbnails
                thumbnails = r.get("thumbnails", [])
                artwork = None
                if thumbnails:
                    raw_url = thumbnails[-1].get("url", "")
                    if raw_url:
                        artwork = re.sub(r"=w\d+-h\d+", "=w600-h600", raw_url)
                if not artwork and video_id:
                    artwork = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
                    
                # Duration
                duration_seconds = r.get("duration_seconds")
                duration_ms = (duration_seconds * 1000) if duration_seconds else 0
                
                tracks.append({
                    "uri": video_id,
                    "name": name,
                    "artist": artist,
                    "album_art_url": artwork or None,
                    "duration_ms": duration_ms,
                })
                
            return tracks
        except Exception as e:
            logger.error(f"YTMusic search failed for query '{query}': {e}")
            return []

    async def resolve_alternate_video(self, query: str, exclude_id: str = None) -> str | None:
        """Find an alternate working YouTube video ID (audio / lyric / clean upload) for region-restricted tracks."""
        if not query or not query.strip():
            return None
        
        clean_q = f"{query.strip()} audio"
        
        # 1. Try ytmusicapi first
        def _find_ytm():
            try:
                ytm = self._get_ytmusic()
                if ytm:
                    results = ytm.search(clean_q, filter="songs", limit=5) or ytm.search(clean_q, limit=5)
                    if results:
                        for r in results:
                            vid = r.get("videoId")
                            if vid and vid != exclude_id:
                                return vid
            except Exception:
                pass
            return None
        
        alt_id = await asyncio.to_thread(_find_ytm)
        if alt_id:
            return alt_id
            
        # 2. Try YouTube HTML Search
        try:
            encoded = urllib.parse.quote_plus(f"{query.strip()} lyric video")
            url = f"https://www.youtube.com/results?search_query={encoded}"
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                })
                if resp.status_code == 200:
                    matches = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', resp.text)
                    for vid in matches:
                        if vid and vid != exclude_id:
                            return vid
        except Exception as e:
            logger.debug(f"Alternate search scrape failed: {e}")
            
        return None

    async def resolve_youtube(self, query: str) -> str | None:
        """Resolve a YouTube video ID from a search query asynchronously.
        
        Strategy:
        0. Check if query is already a raw video ID or YouTube URL
        1. Check memory cache (fast, 0ms)
        2. If query is a Spotify track link, scrape metadata first
        3. Try ytmusicapi (best quality, music-specific)
        4. Fallback: scrape YouTube search results HTML
        """
        if not query or not query.strip():
            return None

        q = query.strip()

        # 0. Check if query is already a direct 11-character YouTube video ID
        if re.match(r"^[a-zA-Z0-9_-]{11}$", q):
            return q

        # 0b. Check if query is a YouTube link
        if "youtube.com" in q or "youtu.be" in q or "music.youtube" in q:
            video_id_match = re.search(r"(?:v=|\/vi\/|youtu\.be\/|\/embed\/|\/shorts\/|\/watch\?v=|&v=)([a-zA-Z0-9_-]{11})", q)
            if video_id_match:
                return video_id_match.group(1)

        # Check if query is a Spotify track link
        if "spotify.com/track/" in q:
            match = re.search(r"/track/([a-zA-Z0-9]+)", q)
            if match:
                track_id = match.group(1)
                try:
                    embed_url = f"https://open.spotify.com/embed/track/{track_id}"
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        resp = await client.get(embed_url, headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        })
                        resp.raise_for_status()
                        html = resp.text
                    next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
                    if next_data_match:
                        next_data = json.loads(next_data_match.group(1))
                        entity = next_data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
                        if entity:
                            title = entity.get("title")
                            artist = entity.get("subtitle", "Unknown Artist")
                            if title:
                                q = f"{title} {artist} official audio"
                except Exception as e:
                    logger.warning(f"Failed to resolve Spotify track URL metadata: {e}")

        if q in self._resolve_cache:
            logger.debug(f"Resolved query from cache: '{q}' → {self._resolve_cache[q]}")
            return self._resolve_cache[q]

        # Method 1: ytmusicapi (runs in thread pool because it's synchronous)
        video_id = await asyncio.to_thread(self._resolve_via_ytmusic, q)
        if video_id:
            self._resolve_cache[q] = video_id
            if len(self._resolve_cache) > 500:
                first_key = next(iter(self._resolve_cache))
                self._resolve_cache.pop(first_key, None)
            return video_id

        # Method 2: YouTube HTML search fallback
        video_id = await self._resolve_via_youtube_scrape(q)
        if video_id:
            self._resolve_cache[q] = video_id
            if len(self._resolve_cache) > 500:
                first_key = next(iter(self._resolve_cache))
                self._resolve_cache.pop(first_key, None)
            return video_id

        logger.warning(f"All resolve methods failed for query: '{q}'")
        return None

    def _resolve_via_ytmusic(self, query: str) -> str | None:
        """Try resolving via ytmusicapi (synchronous). Called via asyncio.to_thread."""
        try:
            ytm = self._get_ytmusic()
            if not ytm:
                return None

            results = ytm.search(query, limit=3)
            if results:
                for r in results:
                    vid = r.get("videoId")
                    if vid:
                        logger.debug(f"ytmusicapi resolved '{query}' → {vid}")
                        return vid
        except Exception as e:
            logger.warning(f"ytmusicapi resolve failed for '{query}': {e}")
            # Reset the instance so it reinitializes on next call
            self._ytmusic = None
        return None

    async def _resolve_via_youtube_scrape(self, query: str) -> str | None:
        """Fallback: scrape YouTube search results page for a video ID asynchronously."""
        try:
            encoded = urllib.parse.quote_plus(query)
            url = f"https://www.youtube.com/results?search_query={encoded}"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                })
                resp.raise_for_status()
                html = resp.text

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

    async def get_recommendations(self, limit: int = 12) -> list:
        """Return trending tracks from iTunes Top Songs asynchronously, with daily rotation."""
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

        async with httpx.AsyncClient(timeout=6.0) as client:
            for chart_url in charts:
                try:
                    resp = await client.get(chart_url, headers={"User-Agent": "OpenJam/1.0"})
                    resp.raise_for_status()
                    data = resp.json()
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

    async def resolve_youtube_metadata(self, video_id: str) -> dict | None:
        """Fetch video title, author, and thumbnail asynchronously using YouTube's oembed API."""
        if not video_id or len(video_id) != 11:
            return None
        try:
            url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers={"User-Agent": "OpenJam/1.0"})
                resp.raise_for_status()
                data = resp.json()
                
            title = data.get("title") or "YouTube Video"
            author = data.get("author_name") or "YouTube"
            thumbnail = data.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/0.jpg"
            
            clean_author = author.replace(" - Topic", "").strip()
            song_title = title
            artist_name = clean_author
            
            split_char = None
            if " - " in title:
                split_char = " - "
            elif " | " in title:
                split_char = " | "
            elif " – " in title:  # En dash
                split_char = " – "
            
            if split_char:
                parts = title.split(split_char, 1)
                p0 = parts[0].strip()
                p1 = parts[1].strip()
                
                if p1.lower() in clean_author.lower() or clean_author.lower() in p1.lower():
                    song_title = p0
                    artist_name = p1
                else:
                    song_title = p1
                    artist_name = p0
            
            return {
                "title": song_title,
                "author": artist_name,
                "thumbnail": thumbnail
            }
        except Exception as e:
            logger.error(f"Failed to fetch YouTube oembed metadata for {video_id}: {e}")
            return None

    # ════════════════════════════════════════════════════════════
    # Synchronous backward compatibility wrappers
    # ════════════════════════════════════════════════════════════

    def _run_async_in_thread(self, coro):
        """Run async coroutines synchronously from any context.

        When called from asyncio.to_thread (the normal path via advance_queue),
        there is no running event loop, so asyncio.run() is used directly.
        The ThreadPoolExecutor fallback only activates if called from the main
        async thread by mistake, preventing nested event loop errors.
        """
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            # No event loop running in this thread, safe to use asyncio.run
            return asyncio.run(coro)
        else:
            # Running loop exists (e.g. main thread). Execute in a separate thread pool to prevent nesting error
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(lambda: asyncio.run(coro))
                return future.result()

    def search_tracks_sync(self, query: str, limit: int = 10) -> list:
        return self._run_async_in_thread(self.search_tracks(query, limit))

    def resolve_youtube_sync(self, query: str) -> str | None:
        return self._run_async_in_thread(self.resolve_youtube(query))

    def get_recommendations_sync(self, limit: int = 12) -> list:
        return self._run_async_in_thread(self.get_recommendations(limit))

    def resolve_youtube_metadata_sync(self, video_id: str) -> dict | None:
        return self._run_async_in_thread(self.resolve_youtube_metadata(video_id))


music_search_service = MusicSearchService()
lastfm_service = music_search_service  # Keep import alias for backward compatibility
