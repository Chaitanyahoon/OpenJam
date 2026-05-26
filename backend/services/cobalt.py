"""Cobalt API service for YouTube audio stream extraction.

Cobalt is an open-source media downloader that can extract audio streams
from YouTube. This service calls a Cobalt API instance (self-hosted or public)
as one of our stream extraction methods.

Self-host guide: https://github.com/imputnet/cobalt
"""

import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_COBALT_URL: str | None = os.getenv("COBALT_API_URL")


async def get_cobalt_stream_url(video_id: str) -> Optional[str]:
    """Extract audio stream URL via Cobalt API.
    
    Returns a direct download/stream URL, or None if unavailable.
    """
    cobalt_url = _COBALT_URL or os.getenv("COBALT_API_URL")
    if not cobalt_url:
        return None

    payload = {
        "url": f"https://www.youtube.com/watch?v={video_id}",
        "isAudioOnly": True,
        "audioFormat": "opus",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            r = await client.post(
                cobalt_url.rstrip("/") + "/",
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code == 200:
                data = r.json()
                url = data.get("url")
                if url:
                    logger.info(f"Cobalt resolved stream URL for {video_id}")
                    return url
                # Some Cobalt versions return a tunnel/redirect URL
                if data.get("status") == "tunnel" or data.get("status") == "redirect":
                    tunnel_url = data.get("url") or data.get("tunnel")
                    if tunnel_url:
                        logger.info(f"Cobalt tunnel/redirect for {video_id}")
                        return tunnel_url
            else:
                logger.warning(f"Cobalt API returned {r.status_code} for {video_id}: {r.text[:200]}")
    except Exception as e:
        logger.warning(f"Cobalt API failed for {video_id}: {e}")

    return None
