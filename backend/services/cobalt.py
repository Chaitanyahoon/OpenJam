"""Cobalt API service for YouTube audio stream extraction.

Cobalt is an open-source media downloader that can extract audio streams
from YouTube. This service calls a Cobalt API instance (self-hosted or public)
as one of our stream extraction methods.

Self-host guide: https://github.com/imputnet/cobalt
"""

import asyncio
import logging
import os
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

DEFAULT_COBALT_INSTANCES = [
    "https://api.cobalt.blackcat.sweeux.org",
]


async def get_cobalt_stream_url(video_id: str) -> Optional[str]:
    """Extract audio stream URL via Cobalt API.
    
    Races Cobalt instances in parallel for fast and reliable extraction.
    """
    instances = []
    
    # Prioritize user environment override if present
    env_url = os.getenv("COBALT_API_URL")
    if env_url:
        instances.append(env_url.rstrip("/"))
        
    # Add default instances
    for inst in DEFAULT_COBALT_INSTANCES:
        inst_clean = inst.rstrip("/")
        if inst_clean and inst_clean not in instances:
            instances.append(inst_clean)
            
    if not instances:
        return None

    # Prepare authorization header if configured in environment
    api_headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    api_key = os.getenv("COBALT_API_KEY") or os.getenv("COBALT_API_TOKEN") or os.getenv("COBALT_JWT")
    if api_key:
        api_headers["Authorization"] = f"Bearer {api_key}"

    async def _try_instance(cobalt_url: str) -> Optional[str]:
        # Try Cobalt v10 first
        payload = {
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "downloadMode": "audio",
            "audioFormat": "opus",
        }
        try:
            # Keep individual timeouts short so the race completes fast
            async with httpx.AsyncClient(timeout=2.5, follow_redirects=True) as client:
                r = await client.post(
                    cobalt_url + "/",
                    json=payload,
                    headers=api_headers,
                )
                
                if r.status_code == 200:
                    try:
                        data = r.json()
                        url = data.get("url")
                        if url:
                            logger.info(f"Cobalt instance {cobalt_url} resolved stream URL for {video_id}")
                            return url
                        if data.get("status") in ("tunnel", "redirect", "picker"):
                            tunnel_url = data.get("url") or data.get("tunnel")
                            if tunnel_url:
                                logger.info(f"Cobalt instance {cobalt_url} tunnel/redirect resolved for {video_id}")
                                return tunnel_url
                    except Exception:
                        pass
                elif r.status_code == 400:
                    try:
                        err_code = r.json().get("error", {}).get("code", "")
                    except Exception:
                        err_code = ""
                        
                    # Only retry legacy payload if error is specifically invalid body
                    if "invalid_body" in err_code:
                        logger.debug(f"Cobalt v10 payload rejected by {cobalt_url}, trying legacy payload...")
                        legacy_payload = {
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "isAudioOnly": True,
                            "audioFormat": "opus",
                        }
                        r_leg = await client.post(
                            cobalt_url + "/",
                            json=legacy_payload,
                            headers=api_headers,
                        )
                        if r_leg.status_code == 200:
                            data_leg = r_leg.json()
                            url_leg = data_leg.get("url") or data_leg.get("tunnel")
                            if url_leg:
                                return url_leg
                    else:
                        logger.debug(f"Cobalt instance {cobalt_url} rejected request: {err_code or r.status_code}")
                else:
                    logger.debug(f"Cobalt instance {cobalt_url} returned status {r.status_code}")
        except Exception as e:
            logger.debug(f"Cobalt instance {cobalt_url} failed: {e}")
        return None

    # Race configured Cobalt instances in parallel
    target_instances = instances[:4]
    tasks = [asyncio.create_task(_try_instance(url)) for url in target_instances]
    
    url = None
    try:
        async def _race():
            nonlocal url
            for future in asyncio.as_completed(tasks):
                try:
                    res = await future
                    if res:
                        url = res
                        break
                except Exception:
                    pass
        await asyncio.wait_for(_race(), timeout=3.0)
    except Exception as e:
        logger.debug(f"Cobalt parallel race ended: {e}")
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        if tasks:
            try:
                await asyncio.gather(*tasks, return_exceptions=True)
            except Exception:
                pass
                
    return url

