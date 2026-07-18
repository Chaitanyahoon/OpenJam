import asyncio
import re
import json
import httpx

async def test_track_scrape():
    track_id = "0VjIjW4Glzwgcq7xb571ui" # Zubaida or another track
    url = f"https://open.spotify.com/embed/track/{track_id}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }
    async with httpx.AsyncClient(follow_redirects=True) as client:
        r = await client.get(url, headers=headers)
        html = r.text
        next_data_match = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html)
        if next_data_match:
            next_data = json.loads(next_data_match.group(1))
            entity = next_data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
            print("Track Entity keys:", list(entity.keys()))
            print("Track Title:", entity.get("title"))
            print("Track Subtitle:", entity.get("subtitle"))
        else:
            print("No __NEXT_DATA__")

if __name__ == "__main__":
    asyncio.run(test_track_scrape())
