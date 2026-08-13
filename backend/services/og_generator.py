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
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception:
        return None

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
    # Dimensions for Open Graph (1200x630)
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
        font_title = ImageFont.truetype(bold_font_path, 44)
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
    draw.rounded_rectangle([70, 45, 220, 85], radius=12, fill=(30, 41, 59, 255), outline=cyan_accent, width=1)
    draw.text((90, 51), "OPENJAM", font=font_brand, fill=cyan_accent)

    # Listener Count Pill
    if listener_count is not None and listener_count >= 0:
        listener_text = f"🎧 {listener_count} listening" if listener_count != 1 else "🎧 1 listening"
        draw.rounded_rectangle([width - 290, 45, width - 70, 85], radius=12, fill=(30, 41, 59, 255), outline=(51, 65, 85, 255), width=1)
        draw.text((width - 270, 52), listener_text, font=font_medium, fill=text_white)

    # 4. Left Content Column
    x_left = 80
    y_pos = 125

    # Host/Inviter Line
    inviter_str = inviter_name or "Someone"
    draw.text((x_left, y_pos), f"HOSTED BY {inviter_str.upper()}", font=font_small, fill=muted_slate)
    y_pos += 35

    # Room Name (Truncate if needed)
    display_room = room_name if len(room_name) <= 24 else room_name[:21] + "..."
    draw.text((x_left, y_pos), display_room, font=font_title, fill=text_white)
    y_pos += 75

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
    art_size = 320
    art_x = width - art_size - 80
    art_y = 125

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
        draw.text((art_x + 80, art_y + 140), "🎵 OpenJam", font=font_medium, fill=cyan_accent)

    # Save to PNG bytes
    byte_io = io.BytesIO()
    img.save(byte_io, format="PNG")
    return byte_io.getvalue()

