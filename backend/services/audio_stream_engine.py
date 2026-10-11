"""Audio stream extraction, caching, racing, and chunk proxying engine."""

import asyncio
import logging
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable

import httpx
from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

from backend.services.invidious import report_stream_failure
from backend.services.redis_store import RedisStore

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

_URL_CACHE_TTL = 5 * 3600
_URL_CACHE_MAX = 500
_VIDEO_ID_RE = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def is_valid_video_id(video_id: str) -> bool:
    if not video_id or not isinstance(video_id, str):
        return False
    return bool(_VIDEO_ID_RE.match(video_id))


class AudioStreamEngine:
    """Cohesive audio streaming service encapsulating stream racing, local/redis caching, and proxying."""

    def __init__(self, cache_dir: Path | None = None, redis_store: RedisStore | None = None):
        self.cache_dir = cache_dir or CACHE_DIR
        os.makedirs(self.cache_dir, exist_ok=True)
        self.redis_store = redis_store or RedisStore()

        self._url_cache: dict[str, tuple[str, float]] = {}
        self._resolving: set[str] = set()
        self._stream_client: httpx.AsyncClient | None = None

        self._downloading_locks: dict[str, asyncio.Lock] = {}
        self._downloading_locks_lock = asyncio.Lock()

        self._resolving_locks: dict[str, asyncio.Lock] = {}
        self._resolving_locks_lock = asyncio.Lock()

    def get_stream_client(self) -> httpx.AsyncClient:
        """Reusable httpx client for stream proxying (connection pooling)."""
        if self._stream_client is None or self._stream_client.is_closed:
            self._stream_client = httpx.AsyncClient(follow_redirects=True, timeout=60.0)
        return self._stream_client

    async def get_download_lock(self, video_id: str) -> asyncio.Lock:
        """Lock map to serialize duplicate background downloads of the same video ID."""
        async with self._downloading_locks_lock:
            if len(self._downloading_locks) > 200:
                to_remove = [k for k, l in self._downloading_locks.items() if not l.locked()]
                for k in to_remove:
                    del self._downloading_locks[k]
            if video_id not in self._downloading_locks:
                self._downloading_locks[video_id] = asyncio.Lock()
            return self._downloading_locks[video_id]

    async def get_resolve_lock(self, video_id: str) -> asyncio.Lock:
        """Lock map to serialize duplicate concurrent resolutions of the same video ID."""
        async with self._resolving_locks_lock:
            if len(self._resolving_locks) > 200:
                to_remove = [k for k, l in self._resolving_locks.items() if not l.locked()]
                for k in to_remove:
                    del self._resolving_locks[k]
            if video_id not in self._resolving_locks:
                self._resolving_locks[video_id] = asyncio.Lock()
            return self._resolving_locks[video_id]

    def prune_url_cache(self):
        """Remove expired entries and cap cache size."""
        now = time.time()
        expired = [k for k, (_, exp) in self._url_cache.items() if now >= exp]
        for k in expired:
            del self._url_cache[k]
        if len(self._url_cache) > _URL_CACHE_MAX:
            by_expiry = sorted(self._url_cache.items(), key=lambda x: x[1][1])
            for k, _ in by_expiry[: len(self._url_cache) - _URL_CACHE_MAX]:
                del self._url_cache[k]

    async def cleanup_old_cache(self, max_cache_size_mb: int = 100):
        """Cleanup oldest cache files if total cache size exceeds max_cache_size_mb."""
        try:
            files = []
            for file in self.cache_dir.glob("*"):
                if file.is_file() and not file.name.endswith(".tmp"):
                    try:
                        st = file.stat()
                        files.append((file, st.st_mtime, st.st_size))
                    except (FileNotFoundError, OSError):
                        pass

            total_size = sum(f[2] for f in files)
            max_bytes = max_cache_size_mb * 1024 * 1024

            if total_size > max_bytes:
                files.sort(key=lambda x: x[1])
                bytes_to_delete = total_size - max_bytes
                deleted_bytes = 0

                for file, _, size in files:
                    if deleted_bytes >= bytes_to_delete:
                        break
                    try:
                        os.remove(file)
                        deleted_bytes += size
                        logger.info(f"Deleted old cache file {file.name} to free disk space")
                    except Exception as e:
                        logger.warning(f"Failed to delete cache file {file.name}: {e}")
        except Exception as e:
            logger.warning(f"Error cleaning up cache: {e}")

    async def download_and_cache_track(self, video_id: str) -> str | None:
        """Download track audio stream in background and cache it locally."""
        if not is_valid_video_id(video_id):
            return None
        for ext in ["webm", "m4a", "cache"]:
            file_path = self.cache_dir / f"{video_id}.{ext}"
            if file_path.exists() and file_path.stat().st_size > 500000:
                return str(file_path)

        lock = await self.get_download_lock(video_id)
        async with lock:
            for ext in ["webm", "m4a", "cache"]:
                file_path = self.cache_dir / f"{video_id}.{ext}"
                if file_path.exists() and file_path.stat().st_size > 500000:
                    return str(file_path)

            url = await self.resolve_stream_url(video_id)
            if not url:
                logger.warning(f"Could not resolve stream URL to cache video {video_id}")
                return None

            ext = "webm"
            if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
                ext = "m4a"
            elif "mime=audio/webm" in url or "ext=webm" in url or ".webm" in url:
                ext = "webm"

            temp_path = self.cache_dir / f"{video_id}.{ext}.tmp"
            final_path = self.cache_dir / f"{video_id}.{ext}"

            logger.info(f"Downloading track {video_id} to cache: {final_path}")
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }

            try:
                client = self.get_stream_client()
                req = client.build_request("GET", url, headers=headers)
                r = await client.send(req, stream=True)
                try:
                    if r.status_code not in (200, 206):
                        logger.warning(f"Failed to download from YouTube for caching: {r.status_code}")
                        return None

                    with open(temp_path, "wb") as f:
                        async for chunk in r.aiter_bytes(chunk_size=65536):
                            f.write(chunk)
                            await asyncio.sleep(0)
                finally:
                    await r.aclose()

                if temp_path.exists() and temp_path.stat().st_size > 100000:
                    shutil.move(temp_path, final_path)
                    logger.info(f"Successfully cached track {video_id} to {final_path} (size: {final_path.stat().st_size} bytes)")
                    asyncio.create_task(self.cleanup_old_cache())
                    return str(final_path)
                else:
                    logger.warning(f"Downloaded cache file for {video_id} was too small or empty")
                    if temp_path.exists():
                        os.remove(temp_path)
            except Exception as e:
                logger.warning(f"Error downloading {video_id} to cache: {e}")
                if temp_path.exists():
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
            return None

    async def resolve_stream_url(self, video_id: str, low: bool = False) -> str | None:
        """Race all extraction methods — Invidious, Piped, yt-dlp, Cobalt."""
        if not is_valid_video_id(video_id):
            logger.warning(f"Invalid video_id rejected: {video_id!r}")
            return None

        cache_key = f"{video_id}_low" if low else video_id

        # Fast path check outside lock
        if cache_key in self._url_cache:
            url, expiry = self._url_cache[cache_key]
            if time.time() < expiry:
                return url
            del self._url_cache[cache_key]

        if self.redis_store.client:
            try:
                cached_url = self.redis_store.client.get(f"openjam:url:{cache_key}")
                if cached_url:
                    self._url_cache[cache_key] = (cached_url, time.time() + _URL_CACHE_TTL)
                    logger.info(f"Resolved stream URL for {cache_key} from Redis cache")
                    return cached_url
            except Exception as e:
                logger.warning(f"Failed to retrieve stream URL from Redis for {cache_key}: {e}")

        # Acquire resolve lock for this video ID to serialize concurrent requests
        resolve_lock = await self.get_resolve_lock(video_id)
        async with resolve_lock:
            if cache_key in self._url_cache:
                url, expiry = self._url_cache[cache_key]
                if time.time() < expiry:
                    return url
                del self._url_cache[cache_key]

            if self.redis_store.client:
                try:
                    cached_url = self.redis_store.client.get(f"openjam:url:{cache_key}")
                    if cached_url:
                        self._url_cache[cache_key] = (cached_url, time.time() + _URL_CACHE_TTL)
                        logger.info(f"Resolved stream URL for {cache_key} from Redis cache (inside lock)")
                        return cached_url
                except Exception:
                    pass

            logger.info(f"Racing Cobalt, Invidious, and yt-dlp stream resolvers in parallel for {video_id}")

            async def _try_cobalt():
                try:
                    from backend.services.cobalt import get_cobalt_stream_url
                    res = await asyncio.wait_for(get_cobalt_stream_url(video_id), timeout=4.5)
                    if res and (res.startswith("http://") or res.startswith("https://")):
                        logger.info(f"[Resolver Race] Cobalt won for {video_id}")
                        return res
                except Exception as e:
                    logger.debug(f"Cobalt parallel resolver failed for {video_id}: {e}")
                return None

            async def _try_invidious():
                try:
                    from backend.services.invidious import get_stream_url as get_invidious_stream_url
                    res = await asyncio.wait_for(get_invidious_stream_url(video_id), timeout=5.0)
                    if res and (res.startswith("http://") or res.startswith("https://")):
                        logger.info(f"[Resolver Race] Invidious won for {video_id}")
                        return res
                except Exception as e:
                    logger.debug(f"Invidious parallel resolver failed for {video_id}: {e}")
                return None

            async def _try_ytdlp():
                try:
                    import yt_dlp
                    loop = asyncio.get_running_loop()

                    def extract():
                        ydl_opts = {
                            "format": "ba[abr<=128]/ba/b[height<=480]" if low else "bestaudio/best",
                            "quiet": True,
                            "no_warnings": True,
                            "nocheckcertificate": True,
                            "ignoreerrors": True,
                            "skip_download": True,
                            "socket_timeout": 5.0,
                        }
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            return ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

                    info = await asyncio.wait_for(loop.run_in_executor(None, extract), timeout=5.5)
                    if info:
                        res = info.get("url")
                        if not res and "formats" in info:
                            audio_formats = [f for f in info["formats"] if f.get("acodec") != "none" and f.get("vcodec") == "none"]
                            if audio_formats:
                                res = audio_formats[-1].get("url")
                        if res and (res.startswith("http://") or res.startswith("https://")):
                            logger.info(f"[Resolver Race] yt-dlp won for {video_id}")
                            return res
                except Exception as e:
                    logger.debug(f"yt-dlp parallel resolver failed for {video_id}: {e}")
                return None

            tasks = [
                asyncio.create_task(_try_cobalt()),
                asyncio.create_task(_try_invidious()),
                asyncio.create_task(_try_ytdlp()),
            ]

            url = None
            try:
                async def _race():
                    nonlocal url
                    for coro in asyncio.as_completed(tasks):
                        try:
                            res = await coro
                            if res:
                                url = res
                                break
                        except Exception:
                            pass

                await asyncio.wait_for(_race(), timeout=6.5)
            except Exception:
                pass
            finally:
                for t in tasks:
                    if not t.done():
                        t.cancel()
                if tasks:
                    try:
                        await asyncio.gather(*tasks, return_exceptions=True)
                    except Exception:
                        pass

            if url:
                self.prune_url_cache()
                self._url_cache[cache_key] = (url, time.time() + _URL_CACHE_TTL)
                if self.redis_store.client:
                    try:
                        self.redis_store.client.set(f"openjam:url:{cache_key}", url, ex=_URL_CACHE_TTL)
                        logger.info(f"Successfully cached stream URL for {cache_key} in Redis")
                    except Exception as e:
                        logger.warning(f"Failed to cache stream URL in Redis for {cache_key}: {e}")
            return url

    async def pre_resolve_url(self, video_id: str):
        """Resolve a stream URL and pre-download the file to the local cache."""
        if not is_valid_video_id(video_id):
            return

        is_resolved = False
        if video_id in self._url_cache:
            is_resolved = True
        elif self.redis_store.client:
            try:
                if self.redis_store.client.exists(f"openjam:url:{video_id}"):
                    is_resolved = True
            except Exception:
                pass

        if not is_resolved:
            if video_id in self._resolving:
                return
            self._resolving.add(video_id)
            try:
                await self.resolve_stream_url(video_id)
            except Exception as e:
                logger.warning(f"Pre-resolve URL failed for {video_id}: {e}")
            finally:
                self._resolving.discard(video_id)

        try:
            asyncio.create_task(self.download_and_cache_track(video_id))
        except Exception as e:
            logger.warning(f"Failed to trigger background pre-download for {video_id}: {e}")

    async def get_stream_response(
        self,
        video_id: str,
        request: Request,
        low: bool = False,
        nocache: bool = False,
        resolve_fn: Any = None,
        client_getter: Any = None,
        failure_reporter: Any = None,
    ):
        """Serve audio stream from local cache or stream proxy from upstream with automatic failover."""
        if not is_valid_video_id(video_id):
            raise HTTPException(status_code=400, detail="Invalid video ID")

        # Check if high-quality or low-quality is already cached locally (bypassed if nocache=True)
        if not nocache:
            candidates = [f"{video_id}_low", video_id] if low else [video_id, f"{video_id}_low"]
            for vid_id in candidates:
                for ext in ["webm", "m4a", "cache"]:
                    file_path = self.cache_dir / f"{vid_id}.{ext}"
                    if file_path.exists() and file_path.stat().st_size > 500000:
                        logger.info(f"Serving cached file for track {video_id}: {file_path}")
                        media_type = "audio/webm" if ext == "webm" else ("audio/mp4" if ext == "m4a" else "application/octet-stream")
                        return FileResponse(
                            str(file_path),
                            media_type=media_type,
                            headers={"Accept-Ranges": "bytes"},
                        )

        # Fallback: Live streaming from YouTube
        cache_key = f"{video_id}_low" if low else video_id
        if nocache:
            if cache_key in self._url_cache:
                try:
                    del self._url_cache[cache_key]
                    logger.info(f"Invalidated stream local cache for {cache_key} due to nocache=true")
                except KeyError:
                    pass
            if self.redis_store.client:
                try:
                    self.redis_store.client.delete(f"openjam:url:{cache_key}")
                    logger.info(f"Invalidated stream Redis cache for {cache_key} due to nocache=true")
                except Exception as e:
                    logger.warning(f"Failed to delete stream URL from Redis for {cache_key}: {e}")

        resolve_fn = resolve_fn or self.resolve_stream_url
        client_getter = client_getter or self.get_stream_client
        failure_reporter = failure_reporter or report_stream_failure

        max_attempts = 2
        last_error_detail = "Could not extract stream"

        for attempt in range(1, max_attempts + 1):
            url = None
            try:
                url = await resolve_fn(video_id, low=low)
            except TypeError:
                try:
                    url = await resolve_fn(video_id)
                except Exception as e:
                    logger.warning(f"Stream resolution error for {video_id} on attempt {attempt}: {e}")
            except Exception as e:
                logger.warning(f"Stream resolution error for {video_id} on attempt {attempt}: {e}")

            if not url:
                if attempt < max_attempts:
                    logger.warning(f"Stream resolution returned None for {video_id} on attempt {attempt}, retrying...")
                    continue
                raise HTTPException(status_code=404, detail="Could not extract stream")

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            range_header = request.headers.get("Range")
            if range_header:
                headers["Range"] = range_header

            client = client_getter() if callable(client_getter) else client_getter
            try:
                logger.info(f"Streaming live from url: {url} (attempt {attempt}/{max_attempts})")
                req = client.build_request("GET", url, headers=headers)
                r = await client.send(req, stream=True)

                if r.status_code not in (200, 206):
                    await r.aclose()
                    logger.warning(f"Upstream returned status {r.status_code} for {video_id} on attempt {attempt}")
                    if url:
                        failure_reporter(url)
                    if cache_key in self._url_cache:
                        del self._url_cache[cache_key]
                    if self.redis_store.client:
                        try:
                            self.redis_store.client.delete(f"openjam:url:{cache_key}")
                            logger.info(f"Evicted invalid stream URL for {cache_key} from Redis")
                        except Exception:
                            pass
                    last_error_detail = f"Upstream returned status {r.status_code}"
                    continue

                resp_headers = {
                    "Accept-Ranges": "bytes",
                    "Content-Type": r.headers.get("Content-Type", "audio/webm"),
                }
                if "Content-Range" in r.headers:
                    resp_headers["Content-Range"] = r.headers["Content-Range"]
                if "Content-Length" in r.headers:
                    resp_headers["Content-Length"] = r.headers["Content-Length"]

                content_range = r.headers.get("Content-Range", "")
                starts_at_zero = (r.status_code == 200) or (r.status_code == 206 and content_range.strip().startswith("bytes 0-"))

                temp_path = None
                f_cache = None

                if starts_at_zero:
                    ext = "webm"
                    if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
                        ext = "m4a"
                    elif "mime=audio/webm" in url or "ext=webm" in url or ".webm" in url:
                        ext = "webm"

                    final_path = self.cache_dir / f"{cache_key}.{ext}"
                    if not final_path.exists():
                        temp_path = self.cache_dir / f"{cache_key}.{ext}.{uuid.uuid4().hex}.tmp"
                        try:
                            f_cache = open(temp_path, "wb")
                            logger.info(f"Started on-the-fly streaming cache for {video_id} to {temp_path}")
                        except Exception as e:
                            logger.warning(f"Could not open temp file for streaming cache: {e}")
                            f_cache = None
                            temp_path = None

                completed = False

                async def generate():
                    nonlocal completed, f_cache, temp_path
                    bytes_written = 0
                    try:
                        async for chunk in r.aiter_bytes(chunk_size=32768):
                            yield chunk
                            if f_cache:
                                try:
                                    f_cache.write(chunk)
                                    bytes_written += len(chunk)
                                except Exception as e:
                                    logger.warning(f"Error writing chunk to on-the-fly cache: {e}")
                                    try:
                                        f_cache.close()
                                    except Exception:
                                        pass
                                    f_cache = None
                                    if temp_path and temp_path.exists():
                                        try:
                                            os.remove(temp_path)
                                        except Exception:
                                            pass
                        completed = True
                    finally:
                        await r.aclose()
                        if f_cache:
                            try:
                                f_cache.close()
                                if completed and temp_path and temp_path.exists() and bytes_written > 500000:
                                    ext = "webm"
                                    if "mime=audio/mp4" in url or "ext=m4a" in url or ".m4a" in url:
                                        ext = "m4a"
                                    final_path = self.cache_dir / f"{cache_key}.{ext}"
                                    if final_path.exists():
                                        try:
                                            os.remove(temp_path)
                                        except Exception:
                                            pass
                                        logger.info(f"Track {video_id} was already cached by another request, discarded temp file.")
                                    else:
                                        shutil.move(temp_path, final_path)
                                        logger.info(f"Successfully finalized on-the-fly cache for {video_id}: {final_path} (size: {bytes_written} bytes)")
                                        asyncio.create_task(self.cleanup_old_cache())
                                else:
                                    if temp_path and temp_path.exists():
                                        os.remove(temp_path)
                            except Exception as e:
                                logger.warning(f"Failed to finalize on-the-fly cache: {e}")
                                if temp_path and temp_path.exists():
                                    try:
                                        os.remove(temp_path)
                                    except Exception:
                                        pass

                return StreamingResponse(
                    generate(),
                    status_code=206 if r.status_code == 206 else 200,
                    headers=resp_headers,
                )
            except Exception as e:
                logger.warning(f"Connection or stream failure for {video_id} on attempt {attempt}: {e}")
                if url:
                    failure_reporter(url)
                if cache_key in self._url_cache:
                    del self._url_cache[cache_key]
                if self.redis_store.client:
                    try:
                        self.redis_store.client.delete(f"openjam:url:{cache_key}")
                    except Exception:
                        pass
                last_error_detail = f"Upstream connection failed: {e}"
                continue

        raise HTTPException(status_code=502, detail=last_error_detail)


audio_stream_engine = AudioStreamEngine()


async def resolve_stream_url(video_id: str, low: bool = False) -> str | None:
    return await audio_stream_engine.resolve_stream_url(video_id, low=low)


async def get_stream_response(
    video_id: str,
    request: Request,
    low: bool = False,
    nocache: bool = False,
    resolve_fn: Any = None,
    client_getter: Any = None,
    failure_reporter: Any = None,
):
    return await audio_stream_engine.get_stream_response(
        video_id,
        request,
        low=low,
        nocache=nocache,
        resolve_fn=resolve_fn,
        client_getter=client_getter,
        failure_reporter=failure_reporter,
    )


async def pre_resolve_url(video_id: str):
    return await audio_stream_engine.pre_resolve_url(video_id)


async def download_and_cache_track(video_id: str) -> str | None:
    return await audio_stream_engine.download_and_cache_track(video_id)


def get_stream_client() -> httpx.AsyncClient:
    return audio_stream_engine.get_stream_client()
