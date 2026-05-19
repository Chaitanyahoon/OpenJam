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

logger = logging.getLogger(__name__)

# Known Invidious instances (as of 2026). These are public instances
# that are generally reliable and allow API access.
INV_INSTANCES = [
    "https://vid.puffyan.us",
    "https://invidious.fdn.fr",
    "https://invidious.private.coffee",
    "https://inv.tux.pizza",
    "https://invidious.lunar.icu",
    "https://iv.ggtyler.dev",
    "https://inv.nadeko.net",
    "https://invidious.flokinet.to",
    "https://yt.artemislena.eu",
    "https://invidious.privacyredirect.com",
    "https://invidious.lilith.zone",
    "https://inv.bp.projectsegfau.lt",
    "https://invidious.protokolla.fi",
    "https://iv.datura.network",
    "https://yewtu.be",
]

# Instance health tracking
_instance_health: dict[str, dict] = {}
_last_health_check = 0.0
_health_check_lock = asyncio.Lock()  # Guards health check interval
HEALTH_CHECK_INTERVAL = 300  # 5 minutes between health checks


def _get_instance_health(instance: str) -> dict:
    """Get or create health record for an instance."""
    if instance not in _instance_health:
        _instance_health[instance] = {"score": 100, "failures": 0, "last_check": 0}
    return _instance_health[instance]


async def _health_check_instances():
    """Lightweight health check: ping instances and measure response time."""
    global _last_health_check
    async with _health_check_lock:
        now = time.time()
        if now - _last_health_check < HEALTH_CHECK_INTERVAL:
            return
        _last_health_check = now

    logger.info("Running Invidious instance health check...")

    async def check(url: str):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{url}/api/v1/status")
                if r.status_code == 200:
                    data = r.json()
                    # Check if the instance is actually functional
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

    tasks = [check(url) for url in INV_INSTANCES]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    healthy = sum(1 for r in results if r is True)
    logger.info(f"Invidious health check: {healthy}/{len(INV_INSTANCES)} instances healthy")


def _get_sorted_instances() -> list[str]:
    """Return instances sorted by health score (best first), with some randomization."""
    instances = []
    for url in INV_INSTANCES:
        health = _get_instance_health(url)
        # Add small random factor to avoid thundering herd on single instance
        jitter = random.uniform(-5, 5)
        score = health.get("score", 100) + jitter
        instances.append((url, score))

    # Sort by score descending
    instances.sort(key=lambda x: x[1], reverse=True)
    return [url for url, _ in instances]


async def get_stream_url(video_id: str) -> Optional[str]:
    """Get a direct stream URL via Invidious.

    Tries all instances in parallel with short timeouts and returns the first
    successful result. yt-dlp runs in parallel via the caller (_resolve_audio_url).
    """
    await _health_check_instances()

    async def _try_instance(instance: str) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(
                    f"{instance}/api/v1/videos/{video_id}",
                    params={"fields": "formatStreams,adaptiveFormats"},
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
                        health = _get_instance_health(instance)
                        health["score"] = min(100, health.get("score", 100) + 5)
                        return url
                if formats:
                    url = formats[0].get("url")
                    if url:
                        health = _get_instance_health(instance)
                        health["score"] = min(100, health.get("score", 100) + 5)
                        return url
        except Exception:
            health = _get_instance_health(instance)
            health["failures"] += 1
            health["score"] = max(0, health.get("score", 100) - 10)
        return None

    instances = _get_sorted_instances()
    # Run all instances in parallel, return first success
    for coro in asyncio.as_completed([_try_instance(i) for i in instances]):
        result = await coro
        if result:
            return result

    return None


async def get_video_info(video_id: str) -> Optional[dict]:
    """Get video metadata (title, duration, etc.) from Invidious."""
    await _health_check_instances()

    for instance in _get_sorted_instances():
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(f"{instance}/api/v1/videos/{video_id}")
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
