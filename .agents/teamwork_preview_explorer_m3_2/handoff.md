# Handoff Report: Dynamic OG Card Image Generator & CTR Optimization (Milestone 3)

## 1. Observation

### Exact File Locations & Current Code Structures

1. **`backend/services/og_generator.py`** (Lines 1–138):
   - Imports Pillow (`Image`, `ImageDraw`, `ImageFont`), `httpx`, `io`, `os`.
   - `ensure_fonts()` (lines 9–35): Downloads `Roboto-Bold.ttf` and `Roboto-Medium.ttf` into `backend/assets/fonts/` if missing.
   - `fetch_image(url: str)` (lines 37–44): Fetches an external image URL asynchronously via `httpx` with 5.0s timeout and converts to RGBA.
   - `create_circular_mask(size)` (lines 46–50): Creates an L-mode ellipse mask.
   - `generate_og_image(inviter_name: str, room_name: str, avatar_url: str = None) -> bytes` (lines 52–137):
     - Canvas size: `1200 x 630` pixels (standard 1.91:1 Open Graph ratio).
     - Renders dark gradient background (`rgb(15, 23, 42)` to `rgb(25, 38, 62)`).
     - Renders text: `"{inviter_name.upper()},"` (size 80 font), `"invited you to"` (size 40 font), `"{room_name}"` (size 40 font), bottom logo `"OpenJam"` (size 32 font) and `"Join now"`.
     - Renders optional avatar as a 200x200 circular image with a white border at position `(x: 900, y: 120)`.
   - **Deficit / Gap**: Missing support for `track_name`, `artist`, `listener_count`, and `cover_art_url`. Does not render track cover art overlay, track title, artist name, or live listener count badge.

2. **`backend/main.py`** (Lines 336–357):
   - Endpoint: `@app.get("/api/og/room/{room_id}.png")`
     ```python
     @app.get("/api/og/room/{room_id}.png")
     async def get_og_image(room_id: str, inviter: str = "Someone", db: Session = Depends(get_db)):
         from backend.models.room import Room
         room = db.query(Room).filter(Room.id == room_id).first()
         room_name = room.name if room else "OpenJam Room"
         
         avatar_url = None
         if room and room.host and inviter == room.host.display_name:
             avatar_url = room.host.avatar_url
         
         image_bytes = await generate_og_image(
             inviter_name=inviter, 
             room_name=room_name, 
             avatar_url=avatar_url
         )
         return Response(content=image_bytes, media_type="image/png", headers={
             "Cache-Control": "public, max-age=3600"
         })
     ```
   - **Deficit / Gap**: Query parameters `track_name`, `artist`, `listener_count`, `cover_art_url` are not declared in the endpoint signature. The endpoint also does not query `queue_manager.get_now_playing(db, room_id)` or `room_manager.get_listener_count(room_id)` to automatically fetch live room metadata if query parameters are missing.

3. **`backend/routes/rooms.py`** (Lines 157–191):
   - Provides `GET /rooms/{room_id}` endpoint.
   - Uses `queue_manager.get_now_playing(db, room.id)` to get current track metadata (`track_name`, `artist`, `album_art_url`).
   - Uses `room_manager.get_listener_count(room_id)` to get active listener count.
   - Shows how backend services (`queue_manager` and `room_manager`) are imported and queried.

4. **`frontend-next/app/room/[id]/page.js`** (Lines 33–81):
   - `generateMetadata({ params })`:
     - Fetches room data from `${backendUrl}/rooms/${id}`.
     - Line 51 currently:
       `const ogImage = currentTrack?.album_art_url || `${backendUrl}/api/og/room/${id}.png?inviter=${encodeURIComponent(inviter)}`;`
   - **Deficit / Gap**: When `currentTrack` exists, it currently falls back to `currentTrack.album_art_url` directly instead of taking advantage of the dynamic OG card generator with full room context (host name, listener count, room title, and branding).

---

## 2. Logic Chain

1. **Objective**: Maximize social media click-through rates (CTR) on platforms like Discord, Twitter/X, WhatsApp, and Reddit by generating dynamic 1200x630 Open Graph images containing:
   - Track cover art overlay (album artwork)
   - Host name / Inviter badge
   - Live listener count badge (e.g. `🎧 14 listening`)
   - Track title & artist ("Now Playing: Track by Artist")
   - Room title
   - OpenJam branding

2. **Backend Image Generation Engine (`backend/services/og_generator.py`)**:
   - To render these rich visual elements using PIL/Pillow:
     - Accept optional parameters: `inviter_name`, `room_name`, `avatar_url`, `track_name`, `artist`, `listener_count`, `cover_art_url`.
     - Layout architecture (1200x630 PNG):
       - **Background**: Dark violet/slate radial-simulated gradient `(15, 23, 42)` to `(30, 27, 75)` with subtle glowing accent borders.
       - **Top Bar**:
         - Left: "OPENJAM" brand pill badge with cyan highlight `(56, 189, 248)`.
         - Right: Listener count pill badge: `🎧 {listener_count} listening` with dark slate background and green/cyan live indicator dot.
       - **Main Left Content Column** (`x=80`, `width=650`):
         - Host line: `"HOSTED BY " + inviter_name.upper()` in muted slate `(148, 163, 184)`.
         - Room Name: Large truncated text in bold white `(255, 255, 255)`.
         - Now Playing section (if `track_name` present):
           - Accent label: `"NOW PLAYING"` in cyan `(56, 189, 248)`.
           - Track Title: Bold font, size 36, white `(255, 255, 255)`.
           - Artist Name: Medium font, size 28, slate `(203, 213, 225)`.
       - **Right Cover Art / Avatar Card** (`x=780`, `y=120`, `size=320x320`):
         - Primary: Fetch `cover_art_url` (or fallback `avatar_url`). If available, resize to `320x320` with rounded corners (16px radius mask) and dark border shadow.
         - Secondary fallback: If artwork fails to fetch or is omitted, render circular host avatar or stylized music icon.
       - **Bottom Bar**: `"Join live jam session • openjam.fun"`

3. **Backend API Endpoint (`backend/main.py`)**:
   - Update `GET /api/og/room/{room_id}.png` signature to accept optional query parameters:
     `inviter: Optional[str] = None`, `track_name: Optional[str] = None`, `artist: Optional[str] = None`, `listener_count: Optional[int] = None`, `cover_art_url: Optional[str] = None`.
   - Implement automatic fallback logic inside the route handler:
     - Query DB for room: if found, default `inviter = inviter or room.host.display_name or "Someone"`, `room_name = room.name`.
     - Query `queue_manager.get_now_playing(db, room_id)` if `track_name` is not provided:
       - Default `track_name = now_playing["track_name"]`, `artist = now_playing["artist"]`, `cover_art_url = now_playing.get("album_art_url")`.
     - Query `room_manager.get_listener_count(room_id)` if `listener_count` is not provided.
     - Call `generate_og_image(...)` with all resolved values.

4. **Frontend Metadata Integration (`frontend-next/app/room/[id]/page.js`)**:
   - Update `ogImage` construction to always point to the dynamic PNG endpoint with explicit parameters passed in the query string:
     ```javascript
     const params = new URLSearchParams({
       inviter: inviter,
       ...(currentTrack?.track_name && { track_name: currentTrack.track_name }),
       ...(currentTrack?.artist && { artist: currentTrack.artist }),
       ...(listenerCount > 0 && { listener_count: listenerCount }),
       ...(currentTrack?.album_art_url && { cover_art_url: currentTrack.album_art_url }),
     });
     const ogImage = `${backendUrl}/api/og/room/${id}.png?${params.toString()}`;
     ```

---

## 3. Caveats

1. **External Image Fetch Failures / Timeouts**:
   - Spotify or YouTube album art URLs (`cover_art_url`) or user avatar URLs might occasionally fail to load or timeout. `fetch_image` must catch all network/parsing exceptions gracefully and return `None`, causing PIL rendering to fall back cleanly to default placeholders without throwing a 500 error.
2. **Font Loading & Cross-Platform Support**:
   - `ensure_fonts()` downloads `Roboto-Bold.ttf` and `Roboto-Medium.ttf`. If font download fails or running in offline mode, PIL will fall back to `ImageFont.load_default()`. Default PIL font does not support customizable font sizes, so proper error handling and fallback size calculations must be maintained.
3. **Cache Control Strategy**:
   - Response header is currently `"Cache-Control": "public, max-age=3600"`. Because live listener counts and now-playing tracks change over time, setting a lower max-age or `s-maxage=300, stale-while-revalidate=600` ensures social link previews reflect semi-realtime room state while avoiding server overload.

---

## 4. Conclusion & Proposed Code Modifications

### Target 1: `backend/services/og_generator.py`

#### Proposed Implementation Code Snippet:
```python
import io
import os
import httpx
import logging
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger(__name__)

async def ensure_fonts():
    font_dir = os.path.join("backend", "assets", "fonts")
    os.makedirs(font_dir, exist_ok=True)
    bold_font_path = os.path.join(font_dir, "Roboto-Bold.ttf")
    medium_font_path = os.path.join(font_dir, "Roboto-Medium.ttf")

    async def download_file(url, path):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                with open(path, "wb") as f:
                    f.write(resp.content)
            logger.info(f"Downloaded font: {path}")
        except Exception as e:
            logger.error(f"Failed to download font from {url}: {e}")

    if not os.path.exists(bold_font_path):
        await download_file(
            "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf",
            bold_font_path
        )
    if not os.path.exists(medium_font_path):
        await download_file(
            "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Medium.ttf",
            medium_font_path
        )

async def fetch_image(url: str) -> Image.Image:
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        logger.warning(f"Could not fetch OG image artwork from {url}: {e}")
        return None

def create_circular_mask(size):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)
    return mask

def create_rounded_rectangle_mask(size, radius=16):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0) + size, radius=radius, fill=255)
    return mask

async def generate_og_image(
    inviter_name: str,
    room_name: str,
    avatar_url: str = None,
    track_name: str = None,
    artist: str = None,
    listener_count: int = None,
    cover_art_url: str = None,
) -> bytes:
    await ensure_fonts()
    width, height = 1200, 630
    
    # 1. Create base background image with dark slate/indigo gradient
    img = Image.new("RGBA", (width, height), color=(15, 23, 42, 255))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        r = int(15 + (y / height) * 15)
        g = int(23 + (y / height) * 12)
        b = int(42 + (y / height) * 35)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Subtle cyan glow effect on left
    for x in range(0, 500):
        alpha = int(30 * (1 - (x / 500)))
        draw.line([(x, 0), (x, height)], fill=(56, 189, 248, alpha))

    # 2. Load Fonts
    font_dir = os.path.join("backend", "assets", "fonts")
    bold_font_path = os.path.join(font_dir, "Roboto-Bold.ttf")
    medium_font_path = os.path.join(font_dir, "Roboto-Medium.ttf")

    try:
        font_brand = ImageFont.truetype(bold_font_path, 28)
        font_title = ImageFont.truetype(bold_font_path, 48)
        font_track = ImageFont.truetype(bold_font_path, 34)
        font_medium = ImageFont.truetype(medium_font_path, 26)
        font_small = ImageFont.truetype(medium_font_path, 22)
    except IOError:
        font_brand = font_title = font_track = font_medium = font_small = ImageFont.load_default()

    # Colors
    text_white = (255, 255, 255, 255)
    muted_slate = (148, 163, 184, 255)
    cyan_accent = (56, 189, 248, 255)

    # 3. Top Bar: OpenJam Branding & Listener Count Badge
    # Brand Pill
    draw.rounded_rectangle([70, 50, 220, 90], radius=12, fill=(30, 41, 59, 255), outline=cyan_accent, width=1)
    draw.text((90, 56), "OPENJAM", font=font_brand, fill=cyan_accent)

    # Listener Count Pill
    if listener_count is not None and listener_count >= 0:
        listener_text = f"🎧 {listener_count} listening" if listener_count != 1 else "🎧 1 listening"
        draw.rounded_rectangle([width - 290, 50, width - 70, 90], radius=12, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=1)
        draw.text((width - 270, 57), listener_text, font=font_medium, fill=text_white)

    # 4. Left Content Column
    x_left = 80
    y_pos = 130

    # Host/Inviter Line
    inviter_str = inviter_name or "Someone"
    draw.text((x_left, y_pos), f"HOSTED BY {inviter_str.upper()}", font=font_small, fill=muted_slate)
    y_pos += 35

    # Room Name (Truncate if needed)
    display_room = room_name if len(room_name) <= 24 else room_name[:21] + "..."
    draw.text((x_left, y_pos), display_room, font=font_title, fill=text_white)
    y_pos += 80

    # Divider line
    draw.line([(x_left, y_pos), (x_left + 550, y_pos)], fill=(51, 65, 85, 255), width=1)
    y_pos += 30

    # Now Playing Track Details
    if track_name:
        draw.text((x_left, y_pos), "NOW PLAYING", font=font_small, fill=cyan_accent)
        y_pos += 35
        
        display_track = track_name if len(track_name) <= 28 else track_name[:25] + "..."
        draw.text((x_left, y_pos), display_track, font=font_track, fill=text_white)
        y_pos += 45

        if artist:
            display_artist = f"by {artist}" if len(artist) <= 32 else f"by {artist[:29]}..."
            draw.text((x_left, y_pos), display_artist, font=font_medium, fill=muted_slate)
    else:
        draw.text((x_left, y_pos), "LIVE MUSIC SESSION", font=font_small, fill=cyan_accent)
        y_pos += 35
        draw.text((x_left, y_pos), "Join & sync playback live", font=font_medium, fill=muted_slate)

    # Footer
    draw.text((x_left, height - 70), "Join room at openjam.fun", font=font_small, fill=muted_slate)

    # 5. Right Column: Cover Art / Avatar Card Overlay
    art_size = 340
    art_x = width - art_size - 80
    art_y = 130

    artwork_img = await fetch_image(cover_art_url) if cover_art_url else None
    if not artwork_img and avatar_url:
        artwork_img = await fetch_image(avatar_url)

    if artwork_img:
        artwork_img = artwork_img.resize((art_size, art_size), Image.Resampling.LANCZOS)
        mask = create_rounded_rectangle_mask((art_size, art_size), radius=20)
        
        # Border
        border_margin = 4
        border_size = (art_size + border_margin * 2, art_size + border_margin * 2)
        border_img = Image.new("RGBA", border_size, (56, 189, 248, 255))
        border_mask = create_rounded_rectangle_mask(border_size, radius=24)
        
        img.paste(border_img, (art_x - border_margin, art_y - border_margin), border_mask)
        img.paste(artwork_img, (art_x, art_y), mask)
    else:
        # Placeholder Card if no image loaded
        draw.rounded_rectangle([art_x, art_y, art_x + art_size, art_y + art_size], radius=20, fill=(30, 41, 59, 255), outline=cyan_accent, width=2)
        draw.text((art_x + 90, art_y + 150), "🎵 OpenJam", font=font_medium, fill=cyan_accent)

    # Save to PNG bytes
    byte_io = io.BytesIO()
    img.save(byte_io, format="PNG")
    return byte_io.getvalue()
```

---

### Target 2: `backend/main.py`

#### Proposed Endpoint Replacement Snippet:
```python
from typing import Optional
from backend.services.og_generator import generate_og_image
from backend.services.queue_manager import queue_manager
from backend.services.room_manager import room_manager

@app.get("/api/og/room/{room_id}.png")
async def get_og_image(
    room_id: str,
    inviter: Optional[str] = None,
    track_name: Optional[str] = None,
    artist: Optional[str] = None,
    listener_count: Optional[int] = None,
    cover_art_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from backend.models.room import Room
    room = db.query(Room).filter(Room.id == room_id).first()
    room_name = room.name if room else "OpenJam Room"
    
    # 1. Resolve host / inviter name
    host_name = room.host.display_name if (room and room.host) else "Someone"
    effective_inviter = inviter or host_name
    avatar_url = room.host.avatar_url if (room and room.host) else None

    # 2. Resolve now playing track if not explicitly passed
    effective_track = track_name
    effective_artist = artist
    effective_cover_art = cover_art_url

    if not effective_track and room:
        now_playing = queue_manager.get_now_playing(db, room_id)
        if now_playing:
            effective_track = now_playing.get("track_name")
            effective_artist = now_playing.get("artist")
            if not effective_cover_art:
                effective_cover_art = now_playing.get("album_art_url")

    # 3. Resolve listener count if not explicitly passed
    effective_listeners = listener_count
    if effective_listeners is None and room:
        effective_listeners = room_manager.get_listener_count(room_id)

    # 4. Generate OG image PNG
    image_bytes = await generate_og_image(
        inviter_name=effective_inviter,
        room_name=room_name,
        avatar_url=avatar_url,
        track_name=effective_track,
        artist=effective_artist,
        listener_count=effective_listeners,
        cover_art_url=effective_cover_art,
    )
    
    return Response(content=image_bytes, media_type="image/png", headers={
        "Cache-Control": "public, max-age=300, s-maxage=600"
    })
```

---

## 5. Verification Method

1. **Endpoint Direct Verification**:
   - Start backend (`uvicorn backend.main:socket_app --port 8000`).
   - Query dynamic OG endpoint with parameters in browser or curl:
     `GET http://localhost:8000/api/og/room/{room_id}.png?inviter=Alex&track_name=Blinding%20Lights&artist=The%20Weeknd&listener_count=12`
   - Inspect response `Content-Type` is `image/png` and status is `200 OK`.

2. **PIL Rendering Inspection**:
   - Verify generated image dimensions are exactly `1200x630`.
   - Verify layout contains top branding ("OPENJAM"), listener count pill ("🎧 12 listening"), track title, artist name, and rounded cover art overlay.

3. **Frontend Metadata Verification**:
   - Check `frontend-next/app/room/[id]/page.js` `generateMetadata()` returns openGraph and twitter image tags pointing to `/api/og/room/[id].png?...`.
