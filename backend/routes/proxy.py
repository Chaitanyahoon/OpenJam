"""Image and resource proxy router for zero-taint canvas rendering and CORS bypass."""

import logging
from urllib.parse import urlparse
import httpx
from fastapi import APIRouter, Query, Response, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proxy", tags=["proxy"])

# Transparent 1x1 PNG fallback bytes
FALLBACK_1X1_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Max-Age": "86400",
}


@router.options("/image")
async def options_proxy_image():
    """Handle CORS preflight requests for image proxy."""
    return Response(
        status_code=status.HTTP_204_NO_CONTENT,
        headers=CORS_HEADERS,
    )


@router.get("/image")
async def proxy_image(
    url: str = Query(..., description="Target image URL to proxy with permissive CORS headers")
):
    """Proxy external album artwork and images with Access-Control-Allow-Origin: * 
    to enable zero-taint HTML5 Canvas rendering and export.
    """
    if not url or not isinstance(url, str):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Missing or invalid 'url' query parameter."},
            headers=CORS_HEADERS,
        )

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"detail": "Only HTTP and HTTPS URLs are supported."},
            headers=CORS_HEADERS,
        )

    hostname = (parsed.hostname or "").lower()
    # Basic SSRF prevention for localhost/internal loopback
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "intranet"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": "Loopback and internal addresses are forbidden."},
            headers=CORS_HEADERS,
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; OpenJamProxy/1.0; +https://openjam.fun)",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                logger.warning(f"Failed to fetch image from {url}: status {resp.status_code}")
                return Response(
                    content=FALLBACK_1X1_PNG,
                    status_code=status.HTTP_200_OK,
                    media_type="image/png",
                    headers={
                        **CORS_HEADERS,
                        "Cache-Control": "public, max-age=300",
                    },
                )

            content_type = resp.headers.get("content-type") or "image/jpeg"
            return Response(
                content=resp.content,
                status_code=status.HTTP_200_OK,
                media_type=content_type,
                headers={
                    **CORS_HEADERS,
                    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
                },
            )

    except Exception as e:
        logger.error(f"Error proxying image {url}: {e}")
        return Response(
            content=FALLBACK_1X1_PNG,
            status_code=status.HTTP_200_OK,
            media_type="image/png",
            headers={
                **CORS_HEADERS,
                "Cache-Control": "public, max-age=60",
            },
        )
