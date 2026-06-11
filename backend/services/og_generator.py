import io
import os
import httpx
from PIL import Image, ImageDraw, ImageFont

async def fetch_image(url: str) -> Image.Image:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception:
        return None

def create_circular_mask(size):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0) + size, fill=255)
    return mask

async def generate_og_image(inviter_name: str, room_name: str, avatar_url: str = None) -> bytes:
    # Dimensions for Open Graph (1200x630)
    width, height = 1200, 630
    
    # Create gradient background
    img = Image.new("RGBA", (width, height), color=(15, 23, 42, 255))
    draw = ImageDraw.Draw(img)

    # Simple radial-ish gradient simulation
    for y in range(height):
        r = int(15 + (y / height) * 10)
        g = int(23 + (y / height) * 15)
        b = int(42 + (y / height) * 20)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

    # Add a subtle glow on the left
    for x in range(0, 400):
        alpha = int(25 * (1 - (x / 400)))
        draw.line([(x, 0), (x, height)], fill=(56, 189, 248, alpha))

    # Load fonts
    font_dir = os.path.join("backend", "assets", "fonts")
    bold_font_path = os.path.join(font_dir, "Inter-Bold.ttf")
    medium_font_path = os.path.join(font_dir, "Inter-Medium.ttf")

    try:
        font_large = ImageFont.truetype(bold_font_path, 80)
        font_medium = ImageFont.truetype(medium_font_path, 40)
        font_small = ImageFont.truetype(medium_font_path, 32)
    except IOError:
        # Fallback if fonts missing
        font_large = ImageFont.load_default()
        font_medium = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Draw text
    text_color = (255, 255, 255, 255)
    muted_color = (148, 163, 184, 255)

    name_text = f"{inviter_name.upper()},"
    action_text = "invited you to"
    room_text = room_name

    x_offset = 80
    y_offset = 120

    # Draw Name
    draw.text((x_offset, y_offset), name_text, font=font_large, fill=text_color)
    y_offset += 100

    # Draw action
    draw.text((x_offset, y_offset), action_text, font=font_medium, fill=muted_color)
    y_offset += 60

    # Draw Room Name
    draw.text((x_offset, y_offset), room_text, font=font_medium, fill=text_color)

    # Draw logo/branding at bottom
    draw.text((x_offset, height - 100), "OpenJam", font=font_small, fill=(255, 255, 255, 255))
    draw.text((width - 160, height - 100), "Join now", font=font_small, fill=muted_color)

    # Draw Avatar
    avatar_size = 200
    avatar_x = width - avatar_size - 100
    avatar_y = 120

    if avatar_url:
        avatar_img = await fetch_image(avatar_url)
        if avatar_img:
            avatar_img = avatar_img.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
            mask = create_circular_mask((avatar_size, avatar_size))
            
            # White border
            border_size = avatar_size + 16
            border_img = Image.new("RGBA", (border_size, border_size), (255, 255, 255, 255))
            border_mask = create_circular_mask((border_size, border_size))
            
            # Paste border then avatar
            img.paste(border_img, (avatar_x - 8, avatar_y - 8), border_mask)
            img.paste(avatar_img, (avatar_x, avatar_y), mask)

    # Save to bytes
    byte_io = io.BytesIO()
    img.save(byte_io, format="PNG")
    return byte_io.getvalue()
