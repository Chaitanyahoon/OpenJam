"""Service to import playlists from external sources like Spotify or YouTube."""

import re
import json
import logging
import asyncio
import httpx
import yt_dlp
from fastapi import HTTPException

logger = logging.getLogger(__name__)

_stream_client = None

def _get_stream_client() -> httpx.AsyncClient:
    global _stream_client
    if _stream_client is None or _stream_client.is_closed:
        _stream_client = httpx.AsyncClient(follow_redirects=True, timeout=60.0)
    return _stream_client


async def import_playlist(url: str):
    """Import tracks from a Spotify or YouTube/YouTube Music playlist."""
    if not url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    url_clean = url.strip()

    # 1. Spotify Playlist
    if "spotify.com" in url_clean:
        try:
            match = re.search(r"/playlist/([a-zA-Z0-9]+)", url_clean)
            if not match:
                raise HTTPException(status_code=400, detail="Invalid Spotify playlist URL")
            playlist_id = match.group(1)

            sp_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://open.spotify.com/",
            }
            client = _get_stream_client()

            # ── Tier 1: Parse embed page __NEXT_DATA__ ──
            embed_url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
            r = await client.get(embed_url, headers=sp_headers, follow_redirects=True)
            if r.status_code != 200:
                raise HTTPException(status_code=r.status_code, detail="Spotify playlist not found or inaccessible")

            html = r.text
            tracks = []
            embed_had_404 = False
            anon_token = None

            next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
            if next_data_match:
                try:
                    next_data = json.loads(next_data_match.group(1))
                    page_props = next_data.get("props", {}).get("pageProps", {})

                    if page_props.get("status") == 404:
                        embed_had_404 = True
                    else:
                        state = page_props.get("state", {})
                        if "data" in state and "entity" in state["data"]:
                            entity = state["data"]["entity"]
                            track_list = entity.get("trackList", [])
                            for track in track_list:
                                title = track.get("title")
                                artist = track.get("subtitle", "Unknown Artist")
                                if title:
                                    artist = artist.replace("\xa0", " ").strip()
                                    title = title.strip()
                                    tracks.append({
                                        "name": title,
                                        "artist": artist,
                                        "uri": f"{title} {artist} official audio",
                                        "duration_ms": track.get("duration", 0)
                                    })
                except Exception as parse_err:
                    logger.error(f"Error parsing Spotify embed __NEXT_DATA__: {parse_err}")

            # ── Tier 2: Anonymous token + Web API fallback ──
            if not tracks and embed_had_404:
                logger.info(f"Spotify embed returned 404 for {playlist_id}, trying anonymous API fallback")
                try:
                    # Fetch a known-working embed to extract an anonymous access token
                    seed_url = "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO"
                    seed_r = await client.get(seed_url, headers=sp_headers, follow_redirects=True)
                    token_match = re.search(r'"accessToken"\s*:\s*"([^"]+)"', seed_r.text)
                    if token_match:
                        anon_token = token_match.group(1)
                        api_url = f"https://api.spotify.com/v1/playlists/{playlist_id}/tracks"
                        api_params = {
                            "limit": 100,
                            "fields": "items(track(name,artists(name),duration_ms)),total,next"
                        }
                        api_r = await client.get(
                            api_url,
                            headers={"Authorization": f"Bearer {anon_token}"},
                            params=api_params
                        )
                        if api_r.status_code == 200:
                            api_data = api_r.json()
                            for item in api_data.get("items", []):
                                t = item.get("track")
                                if t and t.get("name"):
                                    artists = ", ".join(a["name"] for a in t.get("artists", []))
                                    tracks.append({
                                        "name": t["name"],
                                        "artist": artists,
                                        "uri": f"{t['name']} {artists} official audio",
                                        "duration_ms": t.get("duration_ms", 0)
                                    })
                        else:
                            logger.warning(f"Spotify API fallback returned {api_r.status_code} for {playlist_id}")
                except Exception as api_err:
                    logger.error(f"Spotify API fallback error: {api_err}")

            # ── Tier 3: Regex fallback on raw HTML ──
            if not tracks:
                matches = re.findall(r'"name"\s*:\s*"([^"]+)"\s*,\s*"artists"\s*:\s*\[\s*\{\s*"name"\s*:\s*"([^"]+)"', html)
                if matches:
                    for name, artist in matches:
                        try:
                            name = name.encode().decode('unicode_escape', errors='ignore')
                            artist = artist.encode().decode('unicode_escape', errors='ignore')
                        except Exception:
                            pass
                        tracks.append({"name": name, "artist": artist, "uri": f"{name} {artist} official audio"})
                
                if not tracks:
                    matches = re.findall(r'"title"\s*:\s*"([^"]+)"\s*,\s*"subtitle"\s*:\s*"([^"]+)"', html)
                    for title, subtitle in matches:
                        if title and subtitle and subtitle != "Playlist":
                            tracks.append({"name": title, "artist": subtitle, "uri": f"{title} {subtitle} official audio"})

            # Deduplicate
            seen = set()
            deduped = []
            for t in tracks:
                key = (t["name"].lower(), t["artist"].lower())
                if key not in seen:
                    seen.add(key)
                    deduped.append(t)

            if not deduped:
                raise HTTPException(
                    status_code=404,
                    detail="Could not extract tracks from this playlist. Make sure the playlist is set to Public on Spotify and try again."
                )

            return {"tracks": deduped[:100]}

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Spotify playlist import error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    # 2. YouTube/YouTube Music Playlist
    elif "youtube.com" in url_clean or "youtu.be" in url_clean:
        def _extract_yt_playlist(url_to_parse):
            ydl_opts = {
                "extract_flat": True,
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url_to_parse, download=False)
                if not info:
                    return []
                entries = info.get("entries", [])
                extracted = []
                for entry in entries:
                    if not entry:
                        continue
                    title = entry.get("title", "")
                    uploader = entry.get("uploader") or "Unknown"
                    clean_uploader = uploader.replace(" - Topic", "").strip()
                    
                    artist = clean_uploader
                    name = title
                    
                    split_char = None
                    if " - " in title:
                        split_char = " - "
                    elif " | " in title:
                        split_char = " | "
                    elif " – " in title:
                        split_char = " – "
                    
                    if split_char:
                        parts = title.split(split_char, 1)
                        p0 = parts[0].strip()
                        p1 = parts[1].strip()
                        
                        if p1.lower() in clean_uploader.lower() or clean_uploader.lower() in p1.lower():
                            name = p0
                            artist = p1
                        else:
                            name = p1
                            artist = p0
                    
                    video_id = entry.get("id")
                    uri = video_id if (video_id and len(video_id) == 11) else title
                    extracted.append({
                        "name": name,
                        "artist": artist,
                        "uri": uri,
                    })
                return extracted

        try:
            tracks = await asyncio.to_thread(_extract_yt_playlist, url_clean)
            return {"tracks": tracks[:100]}
        except Exception as e:
            logger.error(f"YouTube playlist import error: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    else:
        raise HTTPException(status_code=400, detail="Unsupported playlist URL format (must be Spotify or YouTube)")
