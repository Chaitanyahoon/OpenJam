import io
import os
import httpx
import logging
from PIL import Image, ImageDraw, ImageFont, ImageFilter

logger = logging.getLogger(__name__)

async def ensure_fonts():
    font_dir = os.path.join("backend", "assets", "fonts")
    os.makedirs(font_dir, exist_ok=True)
    bold_font_path = os.path.join(font_dir, "Roboto-Bold.ttf")
    medium_font_path = os.path.join(font_dir, "Roboto-Medium.ttf")
    regular_font_path = os.path.join(font_dir, "Roboto-Regular.ttf")

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
        await download_file("https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf", bold_font_path)
    if not os.path.exists(medium_font_path):
        await download_file("https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Medium.ttf", medium_font_path)
    if not os.path.exists(regular_font_path):
        await download_file("https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf", regular_font_path)

def create_rounded_mask(size, radius=20):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0) + size, radius=radius, fill=255)
    return mask

def draw_vinyl_record(size=330):
    record = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(record)
    center = (size / 2, size / 2)
    radius = size / 2

    # Outer black vinyl base
    draw.ellipse([0, 0, size, size], fill=(12, 12, 16, 255), outline=(50, 50, 60, 255), width=2)

    # Grooves
    for r in range(48, int(radius - 8), 5):
        alpha = 30 if (r % 15 == 0) else 14
        draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], outline=(255, 255, 255, alpha), width=1)

    # Center label in rich gradient amber
    label_r = 58
    draw.ellipse([center[0] - label_r, center[1] - label_r, center[0] + label_r, center[1] + label_r], fill=(255, 159, 28, 255), outline=(255, 225, 140, 255), width=2)
    
    # Inner ring on label
    draw.ellipse([center[0] - 34, center[1] - 34, center[0] + 34, center[1] + 34], outline=(210, 110, 15, 200), width=1)

    # Center spindle hole
    hole_r = 12
    draw.ellipse([center[0] - hole_r, center[1] - hole_r, center[0] + hole_r, center[1] + hole_r], fill=(10, 10, 14, 255), outline=(70, 70, 80, 255), width=1)
    
    return record

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

    font_dir = os.path.join("backend", "assets", "fonts")
    bold_font_path = os.path.join(font_dir, "Roboto-Bold.ttf")
    medium_font_path = os.path.join(font_dir, "Roboto-Medium.ttf")

    try:
        font_brand = ImageFont.truetype(bold_font_path, 21)
        font_room = ImageFont.truetype(bold_font_path, 34)
        font_track = ImageFont.truetype(bold_font_path, 42)
        font_artist = ImageFont.truetype(medium_font_path, 26)
        font_badge = ImageFont.truetype(bold_font_path, 15)
        font_small = ImageFont.truetype(medium_font_path, 19)
        font_tiny = ImageFont.truetype(bold_font_path, 13)
    except IOError:
        font_brand = font_room = font_track = font_artist = font_badge = font_small = font_tiny = ImageFont.load_default()

    # Try fetching artwork
    artwork_img = None
    if cover_art_url:
        try:
            async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
                resp = await client.get(cover_art_url)
                if resp.status_code == 200:
                    artwork_img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        except Exception:
            pass

    if not artwork_img and avatar_url:
        try:
            async with httpx.AsyncClient(timeout=4.0, headers={"User-Agent": "Mozilla/5.0"}) as client:
                resp = await client.get(avatar_url)
                if resp.status_code == 200:
                    artwork_img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
        except Exception:
            pass

    # 1. Base Ambient Background
    if artwork_img:
        # Blow up artwork and blur heavily for rich ambient background
        bg = artwork_img.resize((width, height), Image.Resampling.BILINEAR)
        bg = bg.filter(ImageFilter.GaussianBlur(radius=40))
        
        # Dark color-grading overlay
        overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw_ov = ImageDraw.Draw(overlay)
        for x in range(width):
            # Darker on left for crystal-clear text readability
            ratio = x / width
            alpha = int(230 - ratio * 70)  # 230 on left to 160 on right
            draw_ov.line([(x, 0), (x, height)], fill=(6, 6, 10, alpha))
            
        base_img = Image.alpha_composite(bg, overlay)
    else:
        # Rich dark gradient
        base_img = Image.new("RGBA", (width, height), (10, 10, 15, 255))
        draw_bg = ImageDraw.Draw(base_img)
        for y in range(height):
            r = int(16 + (y / height) * 14)
            g = int(12 + (y / height) * 8)
            b = int(24 + (y / height) * 16)
            draw_bg.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # 2. Inset Frosted Glass Card
    card_x1, card_y1, card_x2, card_y2 = 45, 35, 1155, 595
    card_w, card_h = card_x2 - card_x1, card_y2 - card_y1
    
    card_surface = Image.new("RGBA", (card_w, card_h), (14, 14, 20, 190))
    card_mask = create_rounded_mask((card_w, card_h), radius=28)
    base_img.paste(card_surface, (card_x1, card_y1), card_mask)

    # Card border with subtle glass glow
    draw = ImageDraw.Draw(base_img)
    draw.rounded_rectangle([card_x1, card_y1, card_x2, card_y2], radius=28, outline=(255, 255, 255, 35), width=1)

    # 3. Top Header Row Inside Card
    top_y = 65
    left_x = 80

    # OPENJAM Brand Pill
    pill_w = 142
    draw.rounded_rectangle([left_x, top_y, left_x + pill_w, top_y + 38], radius=10, fill=(255, 159, 28, 32), outline=(255, 159, 28, 160), width=1)
    # Music note / disc icon
    draw.ellipse([left_x + 14, top_y + 11, left_x + 30, top_y + 27], fill=(255, 159, 28, 255))
    draw.ellipse([left_x + 19, top_y + 16, left_x + 25, top_y + 22], fill=(16, 16, 24, 255))
    draw.text((left_x + 38, top_y + 8), "OPENJAM", font=font_brand, fill=(255, 159, 28, 255))

    # Live Badge
    badge_x = left_x + pill_w + 14
    badge_w = 125
    draw.rounded_rectangle([badge_x, top_y, badge_x + badge_w, top_y + 38], radius=10, fill=(255, 71, 87, 28), outline=(255, 71, 87, 140), width=1)
    draw.ellipse([badge_x + 14, top_y + 14, badge_x + 24, top_y + 24], fill=(255, 71, 87, 255))
    draw.text((badge_x + 32, top_y + 10), "LIVE ROOM", font=font_badge, fill=(255, 255, 255, 255))

    # Listener Count Badge (Top Right)
    if listener_count is not None and listener_count >= 0:
        listen_text = f"{listener_count} LISTENING" if listener_count != 1 else "1 LISTENING"
        listen_w = 150
        listen_x2 = 1115
        listen_x1 = listen_x2 - listen_w
        draw.rounded_rectangle([listen_x1, top_y, listen_x2, top_y + 38], radius=10, fill=(28, 30, 42, 220), outline=(255, 255, 255, 40), width=1)
        # Headphone / User icon dot
        draw.ellipse([listen_x1 + 14, top_y + 13, listen_x1 + 25, top_y + 24], fill=(148, 163, 184, 255))
        draw.text((listen_x1 + 32, top_y + 10), listen_text, font=font_badge, fill=(240, 245, 255, 255))

    # 4. Room Info
    cur_y = 135
    inviter_str = (inviter_name or "Someone").strip()
    draw.text((left_x, cur_y), f"HOSTED BY @{inviter_str.upper()}", font=font_tiny, fill=(148, 163, 184, 255))
    cur_y += 24

    display_room = room_name if len(room_name) <= 26 else room_name[:23] + "..."
    draw.text((left_x, cur_y), display_room, font=font_room, fill=(255, 255, 255, 255))
    cur_y += 48

    # Sleek Divider
    draw.line([(left_x, cur_y), (left_x + 550, cur_y)], fill=(255, 255, 255, 22), width=1)
    cur_y += 24

    # 5. Now Playing Hero Section
    if track_name:
        # NOW PLAYING Badge
        draw.rounded_rectangle([left_x, cur_y, left_x + 116, cur_y + 24], radius=6, fill=(255, 159, 28, 25), outline=(255, 159, 28, 100), width=1)
        draw.text((left_x + 10, cur_y + 4), "NOW PLAYING", font=font_tiny, fill=(255, 159, 28, 255))
        cur_y += 36

        # Track Name (Large with soft drop-shadow)
        display_track = track_name if len(track_name) <= 26 else track_name[:23] + "..."
        # Drop shadow for crisp readability
        draw.text((left_x + 2, cur_y + 2), display_track, font=font_track, fill=(0, 0, 0, 220))
        draw.text((left_x, cur_y), display_track, font=font_track, fill=(255, 255, 255, 255))
        cur_y += 52

        # Artist
        if artist:
            display_artist = f"by {artist}" if len(artist) <= 32 else f"by {artist[:29]}..."
            draw.text((left_x, cur_y), display_artist, font=font_artist, fill=(203, 213, 225, 255))
            cur_y += 44
    else:
        draw.text((left_x, cur_y), "LIVE AUDIO SESSION", font=font_badge, fill=(255, 159, 28, 255))
        cur_y += 34
        draw.text((left_x, cur_y), "Join room & queue music live", font=font_track, fill=(255, 255, 255, 255))
        cur_y += 65

    # Equalizer Waveform Bars (20 stylized vertical frequency bars)
    bar_heights = [12, 22, 34, 18, 28, 38, 24, 14, 30, 36, 20, 16, 32, 28, 18, 35, 22, 14, 26, 16]
    eq_x = left_x
    eq_base_y = 520
    for i, h in enumerate(bar_heights):
        bar_x = eq_x + (i * 12)
        # Gradient from amber (#ff9f1c) to red/pink (#ff4757)
        r = int(255)
        g = int(159 - (i / len(bar_heights)) * 88)
        b = int(28 + (i / len(bar_heights)) * 59)
        draw.rounded_rectangle([bar_x, eq_base_y - h, bar_x + 6, eq_base_y], radius=3, fill=(r, g, b, 230))

    # Bottom link / Call to action (Play triangle + text)
    play_x = left_x + 275
    play_y = eq_base_y - 20
    draw.polygon([(play_x, play_y), (play_x, play_y + 14), (play_x + 12, play_y + 7)], fill=(255, 159, 28, 255))
    draw.text((play_x + 20, play_y - 2), "Listen live at openjam.fun", font=font_small, fill=(203, 213, 225, 255))

    # 6. Right Column: Vinyl Disc + Album Jacket Artwork
    art_size = 330
    art_x = 705
    art_y = 165

    # Draw vinyl peeking out to the right (offset by +110px)
    vinyl = draw_vinyl_record(art_size)
    base_img.paste(vinyl, (art_x + 110, art_y - 5), vinyl)

    # Album Jacket Drop Shadow
    shadow_offset = 12
    shadow_mask = create_rounded_mask((art_size, art_size), radius=22)
    shadow_surf = Image.new("RGBA", (art_size, art_size), (0, 0, 0, 160))
    base_img.paste(shadow_surf, (art_x + shadow_offset, art_y + shadow_offset), shadow_mask)

    # Album Jacket Cover
    if artwork_img:
        resized_art = artwork_img.resize((art_size, art_size), Image.Resampling.LANCZOS)
        art_mask = create_rounded_mask((art_size, art_size), radius=22)
        
        # Outer border
        b_margin = 3
        b_size = (art_size + b_margin * 2, art_size + b_margin * 2)
        b_img = Image.new("RGBA", b_size, (255, 255, 255, 70))
        b_mask = create_rounded_mask(b_size, radius=25)
        
        base_img.paste(b_img, (art_x - b_margin, art_y - b_margin), b_mask)
        base_img.paste(resized_art, (art_x, art_y), art_mask)
    else:
        draw.rounded_rectangle([art_x, art_y, art_x + art_size, art_y + art_size], radius=22, fill=(24, 24, 34, 255), outline=(255, 159, 28, 160), width=2)
        draw.text((art_x + 65, art_y + 145), "OpenJam", font=font_room, fill=(255, 159, 28, 255))

    buf = io.BytesIO()
    base_img.save(buf, format="PNG")
    return buf.getvalue()

