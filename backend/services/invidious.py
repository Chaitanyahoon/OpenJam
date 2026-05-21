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

# Known Invidious instances (refreshed 2026). Public instances that
# generally allow API access for stream URL extraction.
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
    "https://invidious.protokolla.fi",
    "https://iv.datura.network",
    "https://yewtu.be",
]

# Piped instances — another YouTube alt-frontend with streaming API
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.r4fo.com",
    "https://pipedapi.leptons.xyz",
    "https://api.piped.projectsegfau.lt",
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


async def _health_check_instances_bg():
    """Lightweight health check: ping instances and measure response time."""
    now = time.time()
    logger.info("Running Invidious instance health check in background...")

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
    logger.info(f"Invidious health check background task complete: {healthy}/{len(INV_INSTANCES)} instances healthy")


def trigger_health_check_if_needed():
    """Trigger the health check in the background if the interval has passed."""
    global _last_health_check
    now = time.time()
    if now - _last_health_check >= HEALTH_CHECK_INTERVAL:
        _last_health_check = now
        asyncio.create_task(_health_check_instances_bg())


def _get_sorted_instances() -> list[str]:
    """Return instances sorted by health score (best first), with some randomization.
    Instances with 10+ consecutive failures are skipped until the next health check."""
    instances = []
    for url in INV_INSTANCES:
        health = _get_instance_health(url)
        # Skip instances that have failed too many times consecutively
        if health.get("failures", 0) >= 10:
            continue
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
    trigger_health_check_if_needed()

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

    async def _try_piped(instance: str) -> Optional[str]:
        """Try to get audio stream URL from a Piped API instance."""
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                r = await client.get(f"{instance}/streams/{video_id}")
                if r.status_code != 200:
                    return None
                data = r.json()
                audio_streams = data.get("audioStreams", [])
                if audio_streams:
                    # Pick highest bitrate audio stream
                    best = max(audio_streams, key=lambda s: s.get("bitrate", 0))
                    url = best.get("url")
                    if url:
                        return url
        except Exception:
            pass
        return None

    instances = _get_sorted_instances()
    # Run Invidious + Piped instances all in parallel, return first success
    all_tasks = [_try_instance(i) for i in instances] + [_try_piped(p) for p in PIPED_INSTANCES]
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
