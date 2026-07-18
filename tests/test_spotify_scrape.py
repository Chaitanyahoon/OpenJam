import asyncio
import re
import json
import logging
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_spotify")

async def test_scrape():
    playlist_id = "37i9dQZF1DX4sWSpwq3LiO" # Spotify Pop Rising or another playlist
    # Let's try the user's playlist or a popular one
    url = f"https://open.spotify.com/embed/playlist/{playlist_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://open.spotify.com/",
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        print("Status code:", r.status_code)
        html = r.text
        next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
        if next_data_match:
            next_data = json.loads(next_data_match.group(1))
            page_props = next_data.get("props", {}).get("pageProps", {})
            state = page_props.get("state", {})
            if "data" in state and "entity" in state["data"]:
                entity = state["data"]["entity"]
                track_list = entity.get("trackList", [])
                print(f"Found {len(track_list)} tracks in embed")
                for i, track in enumerate(track_list[:5]):
                    print(f"Track {i+1}:")
                    print("  keys:", list(track.keys()))
                    print("  title:", track.get("title"))
                    print("  subtitle:", track.get("subtitle"))
            else:
                print("No entity data in state")
        else:
            print("No __NEXT_DATA__ found")

if __name__ == "__main__":
    asyncio.run(test_scrape())
