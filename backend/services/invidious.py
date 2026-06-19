"""Invidious proxy service for YouTube stream URLs.

Invidious is an open-source alternative YouTube frontend that provides
stream URLs without the IP-blocking issues that affect yt-dlp on cloud servers.

This service maintains a list of public Invidious instances and health-checks
them to find the most reliable ones for streaming.
"""

import asyncio
import logging
import random
import time
from typing import Optional

import httpx
from backend.services.redis_store import RedisStore

redis_store = RedisStore()

logger = logging.getLogger(__name__)

# Known Invidious instances (refreshed 2026). Public instances that
# generally allow API access for stream URL extraction.
DEFAULT_INV_INSTANCES = [
    "https://invidious.fdn.fr",
    "https://invidious.private.coffee",
    "https://inv.tux.pizza",
    "https://invidious.lunar.icu",
    "https://iv.ggtyler.dev",
    "https://inv.nadeko.net",
    "https://invidious.protokolla.fi",
    "https://iv.datura.network",
    "https://yewtu.be",
    "https://invidious.nerdvpn.de",
    "https://inv.pistasjis.net",
    "https://invidious.einfachzocken.eu",
]

# Piped instances — another YouTube alt-frontend with streaming API
DEFAULT_PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.r4fo.com",
    "https://pipedapi.leptons.xyz",
    "https://api.piped.projectsegfau.lt",
    "https://pipedapi.in.projectsegfau.lt",
    "https://pipedapi.darkness.services",
]

# Mutable instance lists updated dynamically
INV_INSTANCES = list(DEFAULT_INV_INSTANCES)
PIPED_INSTANCES = list(DEFAULT_PIPED_INSTANCES)

# Instance health tracking
_instance_health: dict[str, dict] = {}
_piped_health: dict[str, dict] = {}
_stream_origin_instances: dict[str, str] = {}

def load_health_from_redis():
    global _instance_health, _piped_health
    if redis_store.client:
        try:
            import json
            inv_data = redis_store.client.get("openjam:invidious:health")
            if inv_data:
                _instance_health.update(json.loads(inv_data))
                logger.info("Loaded Invidious instance health from Redis cache")
            
            piped_data = redis_store.client.get("openjam:piped:health")
            if piped_data:
                _piped_health.update(json.loads(piped_data))
                logger.info("Loaded Piped instance health from Redis cache")
        except Exception as e:
            logger.warning(f"Failed to load instance health from Redis: {e}")

load_health_from_redis()
_last_health_check: float = 0.0
HEALTH_CHECK_INTERVAL: float = 600.0  # 10 minutes (was 30min)

def _get_instance_health(instance: str) -> dict:
    """Get or create health record for an instance."""
    if instance not in _instance_health:
        _instance_health[instance] = {"score": 100, "failures": 0, "last_check": 0}
    return _instance_health[instance]


def _get_piped_health(instance: str) -> dict:
    """Get or create health record for a Piped instance."""
    if instance not in _piped_health:
        _piped_health[instance] = {"score": 100, "failures": 0, "last_check": 0}
    return _piped_health[instance]


async def update_instances_dynamically():
    """Fetch fresh instances lists from public Invidious and Piped APIs."""
    global INV_INSTANCES, PIPED_INSTANCES
    logger.info("Fetching dynamic lists of Invidious and Piped instances...")
    
    # 1. Invidious Instances
    try:
        url = "https://api.invidious.io/instances.json"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                new_inv = []
                for domain, info in data:
                    if not info:
                        continue
                    uri = info.get("uri")
                    if not uri:
                        continue
                    if not uri.startswith("https://"):
                        continue
                    if any(x in uri for x in [".onion", ".i2p", ".ygg", "localhost"]):
                        continue
                    
                    monitor = info.get("monitor") or {}
                    if monitor.get("down", False):
                        continue
                    
                    stats = info.get("stats") or {}
                    playback = stats.get("playback") or {}
                    ratio = playback.get("ratio", 0.0)
                    
                    new_inv.append((uri, ratio))
                
                new_inv.sort(key=lambda x: x[1], reverse=True)
                filtered_uris = [x[0] for x in new_inv]
                if filtered_uris:
                    merged = list(filtered_uris)
                    for x in DEFAULT_INV_INSTANCES:
                        if x not in merged:
                            merged.append(x)
                    INV_INSTANCES = merged
                    logger.info(f"Dynamically updated Invidious instances. Active count: {len(INV_INSTANCES)}")
    except Exception as e:
        logger.warning(f"Failed to dynamically fetch Invidious instances: {e}")

    # 2. Piped Instances
    try:
        url = "https://piped-instances.kavin.rocks"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            r = await client.get(url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                new_piped = []
                for item in data:
                    api_url = item.get("api_url")
                    if not api_url:
                        continue
                    if not api_url.startswith("https://"):
                        continue
                    if any(x in api_url for x in [".onion", ".i2p", ".ygg", "localhost"]):
                        continue
                    
                    uptime = item.get("uptime_24h", 0.0)
                    new_piped.append((api_url, uptime))
                
                new_piped.sort(key=lambda x: x[1], reverse=True)
                filtered_apis = [x[0] for x in new_piped]
                if filtered_apis:
                    merged = list(filtered_apis)
                    for x in DEFAULT_PIPED_INSTANCES:
                        if x not in merged:
                            merged.append(x)
                    PIPED_INSTANCES = merged
                    logger.info(f"Dynamically updated Piped instances. Active count: {len(PIPED_INSTANCES)}")
    except Exception as e:
        logger.warning(f"Failed to dynamically fetch Piped instances: {e}")


async def _health_check_instances_bg():
    """Lightweight health check: ping instances and measure response time."""
    now = time.time()
    logger.info("Running Invidious & Piped instance health check in background...")
    
    # Prune origin instances mapping cache
    if len(_stream_origin_instances) > 500:
        _stream_origin_instances.clear()

    # Dynamically update the pools first
    await update_instances_dynamically()

    async def check(url: str):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                r = await client.get(f"{url}/api/v1/status", headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    if data.get("version"):
                        _instance_health[url] = {
                            "score": 100,
                            "failures": 0,
                            "last_check": now,
                            "latency_ms": r.elapsed.total_seconds() * 1000,
                        }
                        return True
        except Exception:
            pass
        health = _get_instance_health(url)
        health["failures"] += 1
        health["score"] = max(0, health["score"] - 20)
        health["last_check"] = now
        return False

    async def check_piped(url: str):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                r = await client.get(url, headers=headers)
                if r.status_code in (200, 404):
                    _piped_health[url] = {
                        "score": 100,
                        "failures": 0,
                        "last_check": now,
                        "latency_ms": r.elapsed.total_seconds() * 1000,
                    }
                    return True
        except Exception:
            pass
        health = _get_piped_health(url)
        health["failures"] += 1
        health["score"] = max(0, health["score"] - 20)
        health["last_check"] = now
        return False

    # Check all Invidious and Piped instances in parallel
    tasks = [check(url) for url in INV_INSTANCES] + [check_piped(url) for url in PIPED_INSTANCES]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    healthy = sum(1 for r in results if r is True)
    logger.info(f"Health check background task complete: {healthy}/{len(INV_INSTANCES) + len(PIPED_INSTANCES)} instances healthy")

    if redis_store.client:
        try:
            import json
            redis_store.client.set("openjam:invidious:health", json.dumps(_instance_health), ex=86400)
            redis_store.client.set("openjam:piped:health", json.dumps(_piped_health), ex=86400)
            logger.info("Saved instance health to Redis cache")
        except Exception as e:
            logger.warning(f"Failed to save instance health to Redis: {e}")


def trigger_health_check_if_needed():
    """Trigger the health check in the background if the interval has passed."""
    global _last_health_check
    now = time.time()
    if now - _last_health_check >= HEALTH_CHECK_INTERVAL:
        _last_health_check = now
        asyncio.create_task(_health_check_instances_bg())


def _get_sorted_instances() -> list[str]:
    """Return Invidious instances sorted by health score (best first), with some randomization."""
    instances = []
    for url in INV_INSTANCES:
        health = _get_instance_health(url)
        if health.get("failures", 0) >= 5:
            continue
        jitter = random.uniform(-5, 5)
        score = health.get("score", 100) + jitter
        instances.append((url, score))
    instances.sort(key=lambda x: x[1], reverse=True)
    return [url for url, _ in instances]


def _get_sorted_piped_instances() -> list[str]:
    """Return Piped instances sorted by health score (best first), with some randomization."""
    instances = []
    for url in PIPED_INSTANCES:
        health = _get_piped_health(url)
        if health.get("failures", 0) >= 5:
            continue
        jitter = random.uniform(-5, 5)
        score = health.get("score", 100) + jitter
        instances.append((url, score))
    instances.sort(key=lambda x: x[1], reverse=True)
    return [url for url, _ in instances]


def report_stream_failure(stream_url: str):
    """Called when proxying a stream URL fails. Penalizes the instance's health score."""
    try:
        origin = _stream_origin_instances.get(stream_url)
        if not origin:
            from urllib.parse import urlparse
            parsed = urlparse(stream_url)
            if parsed.scheme and parsed.netloc:
                host = f"{parsed.scheme}://{parsed.netloc}"
                if host in _instance_health:
                    origin = host
                elif host in _piped_health:
                    origin = host
        
        if origin:
            if origin in _instance_health:
                health = _get_instance_health(origin)
                health["failures"] += 1
                health["score"] = max(0, health["score"] - 30)
                logger.info(f"Penalized Invidious instance {origin} (score={health['score']}) due to stream proxy failure")
            elif origin in _piped_health:
                health = _get_piped_health(origin)
                health["failures"] += 1
                health["score"] = max(0, health["score"] - 30)
                logger.info(f"Penalized Piped instance {origin} (score={health['score']}) due to stream proxy failure")

            if redis_store.client:
                try:
                    import json
                    redis_store.client.set("openjam:invidious:health", json.dumps(_instance_health), ex=86400)
                    redis_store.client.set("openjam:piped:health", json.dumps(_piped_health), ex=86400)
                except Exception:
                    pass
    except Exception as e:
        logger.warning(f"Error reporting stream failure for {stream_url}: {e}")


def _rewrite_googlevideo_url(url: str, instance: str) -> str:
    # Rewrite googlevideo URL to proxy through Invidious instance itself
    if "googlevideo.com" in url:
        from urllib.parse import urlparse, urlunparse
        parsed_url = urlparse(url)
        parsed_instance = urlparse(instance)
        new_url = parsed_url._replace(
            scheme=parsed_instance.scheme,
            netloc=parsed_instance.netloc
        )
        return urlunparse(new_url)
    return url


async def get_stream_url(video_id: str) -> Optional[str]:
    """Get a direct stream URL via Invidious or Piped."""
    trigger_health_check_if_needed()

    async def _try_instance(instance: str) -> Optional[str]:
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                r = await client.get(
                    f"{instance}/api/v1/videos/{video_id}",
                    params={"fields": "formatStreams,adaptiveFormats"},
                    headers=headers,
                )
                if r.status_code != 200:
                    return None

                data = r.json()
                formats = data.get("adaptiveFormats", []) or data.get("formatStreams", []) or []
                audio_formats = [f for f in formats if f.get("type", "").startswith("audio")]
                if audio_formats:
                    best = max(audio_formats, key=lambda f: f.get("bitrate", 0))
                    url = best.get("url")
                    if url:
                        url = _rewrite_googlevideo_url(url, instance)
                        health = _get_instance_health(instance)
                        health["score"] = min(100, health.get("score", 100) + 5)
                        _stream_origin_instances[url] = instance
                        return url
                if formats:
                    url = formats[0].get("url")
                    if url:
                        url = _rewrite_googlevideo_url(url, instance)
                        health = _get_instance_health(instance)
                        health["score"] = min(100, health.get("score", 100) + 5)
                        _stream_origin_instances[url] = instance
                        return url
        except Exception:
            health = _get_instance_health(instance)
            health["failures"] += 1
            health["score"] = max(0, health.get("score", 100) - 10)
        return None

    async def _try_piped(instance: str) -> Optional[str]:
        """Try to get audio stream URL from a Piped API instance."""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
                r = await client.get(f"{instance}/streams/{video_id}", headers=headers)
                if r.status_code != 200:
                    return None
                data = r.json()
                audio_streams = data.get("audioStreams", [])
                if audio_streams:
                    best = max(audio_streams, key=lambda s: s.get("bitrate", 0))
                    url = best.get("url")
                    if url:
                        health = _get_piped_health(instance)
                        health["score"] = min(100, health.get("score", 100) + 5)
                        _stream_origin_instances[url] = instance
                        return url
        except Exception:
            health = _get_piped_health(instance)
            health["failures"] += 1
            health["score"] = max(0, health.get("score", 100) - 10)
        return None

    # Limit the race to the top 3 healthiest Invidious and top 3 healthiest Piped instances
    # to avoid creating excessive concurrent connections and slamming external APIs.
    instances = _get_sorted_instances()[:3]
    piped_instances = _get_sorted_piped_instances()[:3]
    all_tasks = [_try_instance(i) for i in instances] + [_try_piped(p) for p in piped_instances]
    for coro in asyncio.as_completed(all_tasks):
        result = await coro
        if result:
            return result

    return None


async def get_video_info(video_id: str) -> Optional[dict]:
    """Get video metadata (title, duration, etc.) from Invidious."""
    trigger_health_check_if_needed()

    for instance in _get_sorted_instances():
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                r = await client.get(f"{instance}/api/v1/videos/{video_id}", headers=headers)
                if r.status_code == 200:
                    data = r.json()
                    return {
                        "title": data.get("title", ""),
                        "author": data.get("author", ""),
                        "lengthSeconds": data.get("lengthSeconds", 0),
                        "videoThumbnails": data.get("videoThumbnails", []),
                    }
        except Exception:
            continue
    return None
