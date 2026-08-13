"""E2E Test Suite for OpenJam SEO Overhaul (Requirements R1, R2, R3).

Covers:
- Tier 1: Search Indexing & Public Room Visibility (Robots indexing meta tags for public vs private rooms)
- Tier 2: Dynamic Sitemap Generation & AI Crawler Accessibility in robots.js
- Tier 3: High-Intent Keyword Metadata, FAQPage & SoftwareApplication JSON-LD Schemas, and Verification Tags
- Tier 4: Open Graph & Twitter Social Card Optimization with Track Cover Art, Host Names, and Listener Counts
"""

import io
import json
import os
import subprocess
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from backend.main import app
from backend.models.room import Room
from backend.services.og_generator import generate_og_image

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def run_node_js(script_code: str, *args: str) -> str:
    """Executes a Node.js snippet using --input-type=module in PROJECT_ROOT."""
    cmd = ["node", "--input-type=module", "-e", script_code] + list(args)
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Node execution failed (code {result.returncode}):\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
        )
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError(f"Node execution produced no output.\nSTDERR:\n{result.stderr}")
    return lines[-1]


# ==============================================================================
# TIER 1: Search Indexing & Public Room Visibility (R1)
# ==============================================================================

class TestTier1SearchIndexing:
    """Tests for Tier 1: Public vs Private Room Robots Indexing Metadata."""

    def test_public_room_robots_indexing_meta(self):
        """Public rooms (is_private=false) MUST have robots: { index: true, follow: true }."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        globalThis.fetch = async (url) => {
          if (url.includes('/rooms/public-room-1')) {
            return {
              ok: true,
              json: async () => ({
                room: {
                  id: 'public-room-1',
                  name: 'Public Jam Room',
                  is_private: false,
                  host_name: 'Alice',
                  listener_count: 5
                }
              })
            };
          }
          return { ok: false, status: 404 };
        };

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('public-room-1');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        assert "robots" in meta, "Public room metadata must specify 'robots' directive"
        robots = meta["robots"]
        assert robots.get("index") is True, (
            f"Public room page must have robots.index = True, but got: {robots}"
        )
        assert robots.get("follow") is True, (
            f"Public room page must have robots.follow = True, but got: {robots}"
        )

    def test_private_room_robots_noindex_meta(self):
        """Password-protected / private rooms (is_private=true) MUST have robots: { index: false, follow: false }."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        globalThis.fetch = async (url) => {
          if (url.includes('/rooms/private-room-1')) {
            return {
              ok: true,
              json: async () => ({
                room: {
                  id: 'private-room-1',
                  name: 'Secret Jam Room',
                  is_private: true,
                  host_name: 'Bob'
                },
                password_required: true
              })
            };
          }
          return { ok: false, status: 404 };
        };

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('private-room-1');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        assert "robots" in meta, "Private room metadata must specify 'robots' directive"
        robots = meta["robots"]
        assert robots.get("index") is False, (
            f"Private room page must have robots.index = False, but got: {robots}"
        )
        assert robots.get("follow") is False, (
            f"Private room page must have robots.follow = False, but got: {robots}"
        )

    def test_loading_room_robots_noindex(self):
        """Static build placeholder id='loading' MUST have noindex, nofollow."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('loading');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        assert meta.get("robots", {}).get("index") is False
        assert meta.get("robots", {}).get("follow") is False

    def test_error_fallback_room_robots_noindex(self):
        """Non-existent rooms (404) or failed fetches MUST fallback to noindex, nofollow."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        globalThis.fetch = async () => ({ ok: false, status: 404 });

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('non-existent-room');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        assert meta.get("robots", {}).get("index") is False
        assert meta.get("robots", {}).get("follow") is False

    def test_backend_get_room_privacy_contract(self, client: TestClient, db_session, test_user):
        """Backend GET /rooms/{id} returns is_private flag required by frontend generateMetadata."""
        public_room = Room(
            name="Public Room Test",
            host_user_id=test_user.id,
            is_private=False,
            is_active=True,
        )
        private_room = Room(
            name="Private Room Test",
            host_user_id=test_user.id,
            is_private=True,
            password_hash="hashed_pw",
            is_active=True,
        )
        db_session.add_all([public_room, private_room])
        db_session.commit()

        # Public room API response
        resp_pub = client.get(f"/rooms/{public_room.id}")
        assert resp_pub.status_code == 200
        data_pub = resp_pub.json()
        assert "room" in data_pub
        assert data_pub["room"]["is_private"] is False

        # Private room API response (unauthenticated guest)
        resp_priv = client.get(f"/rooms/{private_room.id}")
        assert resp_priv.status_code == 200
        data_priv = resp_priv.json()
        assert data_priv.get("password_required") is True
        assert data_priv["room"]["is_private"] is True


# ==============================================================================
# TIER 2: Sitemap Dynamic Routes & Robots.js Rules (R1)
# ==============================================================================

class TestTier2SitemapAndRobotsTxt:
    """Tests for Tier 2: Dynamic Sitemap Generation and robots.js rules."""

    def test_sitemap_static_routes(self):
        """sitemap.js MUST include static routes: /, /privacy, /terms."""
        node_script = """
        import sitemap from './frontend-next/app/sitemap.js';
        const res = await sitemap();
        console.log(JSON.stringify(res));
        """
        output_json = run_node_js(node_script)
        entries = json.loads(output_json)

        urls = [item["url"] for item in entries]
        assert "https://www.openjam.fun" in urls or "https://www.openjam.fun/" in urls
        assert "https://www.openjam.fun/privacy" in urls
        assert "https://www.openjam.fun/terms" in urls

    def test_sitemap_dynamic_public_rooms(self):
        """sitemap.js MUST fetch active rooms and dynamically include public room URLs while excluding private rooms."""
        node_script = """
        import fs from 'fs';

        globalThis.fetch = async (url) => {
          if (url.includes('/rooms')) {
            return {
              ok: true,
              json: async () => ({
                rooms: [
                  { id: 'pub-room-1', name: 'Public One', is_private: false },
                  { id: 'pub-room-2', name: 'Public Two', is_private: false },
                  { id: 'priv-room-1', name: 'Private One', is_private: true }
                ]
              })
            };
          }
          return { ok: false };
        };

        import sitemap from './frontend-next/app/sitemap.js';
        const res = await sitemap();
        console.log(JSON.stringify(res));
        """
        output_json = run_node_js(node_script)
        entries = json.loads(output_json)

        urls = [item["url"] for item in entries]
        assert "https://www.openjam.fun/room/pub-room-1" in urls, (
            f"sitemap.js must include active public room '/room/pub-room-1'. Found URLs: {urls}"
        )
        assert "https://www.openjam.fun/room/pub-room-2" in urls, (
            f"sitemap.js must include active public room '/room/pub-room-2'. Found URLs: {urls}"
        )
        assert "https://www.openjam.fun/room/priv-room-1" not in urls, (
            "sitemap.js MUST NOT include private room '/room/priv-room-1' in sitemap!"
        )

    def test_robots_txt_general_crawler_rules(self):
        """robots.js MUST configure rules for userAgent '*' allowing '/' and disallowing sensitive paths."""
        node_script = """
        import robots from './frontend-next/app/robots.js';
        const res = robots();
        console.log(JSON.stringify(res));
        """
        output_json = run_node_js(node_script)
        robots_data = json.loads(output_json)

        rules = robots_data.get("rules", [])
        if isinstance(rules, dict):
            rules = [rules]

        gen_rule = next((r for r in rules if r.get("userAgent") == "*" or "*" in r.get("userAgent", [])), None)
        assert gen_rule is not None, "robots.js must contain a rule for userAgent '*'"
        assert gen_rule.get("allow") == "/" or "/" in gen_rule.get("allow", [])
        disallows = gen_rule.get("disallow", [])
        if isinstance(disallows, str):
            disallows = [disallows]
        assert any("/admin" in d for d in disallows)
        assert any("/offline" in d for d in disallows)

    def test_robots_txt_ai_crawler_rules(self):
        """robots.js MUST include explicit rules for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended)."""
        node_script = """
        import robots from './frontend-next/app/robots.js';
        const res = robots();
        console.log(JSON.stringify(res));
        """
        output_json = run_node_js(node_script)
        robots_data = json.loads(output_json)

        rules = robots_data.get("rules", [])
        if isinstance(rules, dict):
            rules = [rules]

        ai_bots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]
        found_ai_rule = False
        for r in rules:
            ua = r.get("userAgent", [])
            if isinstance(ua, str):
                ua = [ua]
            if any(bot in ua for bot in ai_bots):
                found_ai_rule = True
                break

        assert found_ai_rule, (
            f"robots.js must include rule for AI crawlers ({ai_bots}). Found rules: {rules}"
        )

    def test_robots_txt_sitemap_link(self):
        """robots.js MUST include sitemap URL pointing to https://www.openjam.fun/sitemap.xml."""
        node_script = """
        import robots from './frontend-next/app/robots.js';
        const res = robots();
        console.log(JSON.stringify(res));
        """
        output_json = run_node_js(node_script)
        robots_data = json.loads(output_json)

        sitemap_url = robots_data.get("sitemap")
        assert sitemap_url == "https://www.openjam.fun/sitemap.xml", (
            f"robots.js sitemap field must be 'https://www.openjam.fun/sitemap.xml', got: '{sitemap_url}'"
        )

    def test_backend_rooms_list_endpoint_sitemap_contract(self, client: TestClient, db_session, test_user):
        """Backend GET /rooms endpoint returns list of active rooms for sitemap fetching."""
        room = Room(name="Sitemap Test Room", host_user_id=test_user.id, is_active=True, is_private=False)
        db_session.add(room)
        db_session.commit()

        resp = client.get("/rooms?limit=100")
        assert resp.status_code == 200
        data = resp.json()
        assert "rooms" in data
        assert any(r["id"] == room.id for r in data["rooms"])


# ==============================================================================
# TIER 3: High-Intent Keyword Metadata & Schema.org Rich Snippets (R2)
# ==============================================================================

class TestTier3KeywordsAndJsonLdSchema:
    """Tests for Tier 3: Keyword Metadata, JSON-LD Schemas, and Verification Tags."""

    def test_layout_high_intent_keywords(self):
        """app/layout.js metadata MUST contain primary search keywords and verification tags."""
        node_script = """
        import fs from 'fs';
        const SITE_URL = 'https://www.openjam.fun';
        const code = fs.readFileSync('./frontend-next/app/layout.js', 'utf8');
        const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});\\s*export const viewport/);
        if (!match) throw new Error('metadata not found in layout.js');
        const metadata = eval('(' + match[1] + ')');
        console.log(JSON.stringify(metadata));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        # Check keywords
        keywords = meta.get("keywords", [])
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(",")]

        required_keywords = [
            "openjam",
            "listen to music with friends online",
            "shared music listening room",
            "sync youtube music with friends"
        ]
        lowered_keywords = [k.lower() for k in keywords]
        for req_k in required_keywords:
            assert any(req_k in k for k in lowered_keywords), (
                f"app/layout.js metadata keywords missing '{req_k}'. Found keywords: {keywords}"
            )

    def test_page_long_tail_keywords(self):
        """app/page.js metadata MUST contain long-tail search keywords and canonical URL."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/page.js', 'utf8');
        const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});/);
        if (!match) throw new Error('metadata not found in page.js');
        const metadata = eval('(' + match[1] + ')');
        console.log(JSON.stringify(metadata));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        # Check canonical URL
        alternates = meta.get("alternates", {})
        assert alternates.get("canonical") == "https://www.openjam.fun"

        # Check keywords
        keywords = meta.get("keywords", [])
        if isinstance(keywords, str):
            keywords = [k.strip() for k in keywords.split(",")]

        long_tail_keywords = [
            "listen music with friends online free",
            "virtual music room",
            "synced music playback"
        ]
        lowered_keywords = [k.lower() for k in keywords]
        for req_k in long_tail_keywords:
            assert any(req_k in k for k in lowered_keywords), (
                f"app/page.js metadata keywords missing '{req_k}'. Found keywords: {keywords}"
            )

    def test_jsonld_software_application_schema(self):
        """components/JsonLd.js MUST include SoftwareApplication schema with complete details."""
        node_script = """
        import fs from 'fs';
        const SITE_URL = 'https://www.openjam.fun';
        const code = fs.readFileSync('./frontend-next/components/JsonLd.js', 'utf8');
        const match = code.match(/const jsonLd = (\\{[\\s\\S]*?\\});\\s*return/);
        if (!match) throw new Error('jsonLd object not found');
        const jsonLd = eval('(' + match[1] + ')');
        console.log(JSON.stringify(jsonLd));
        """
        output_json = run_node_js(node_script)
        json_ld = json.loads(output_json)

        graph = json_ld.get("@graph", [])
        app_schema = next((item for item in graph if item.get("@type") == "SoftwareApplication"), None)

        assert app_schema is not None, "JsonLd @graph must include '@type': 'SoftwareApplication'"
        assert app_schema.get("name") == "Open Jam"
        assert app_schema.get("applicationCategory") == "MusicApplication"
        assert "operatingSystem" in app_schema
        assert "offers" in app_schema
        offers = app_schema["offers"]
        assert offers.get("price") == "0" or offers.get("price") == 0

    def test_jsonld_faqpage_schema(self):
        """components/JsonLd.js MUST include FAQPage schema matching FaqSection.js questions."""
        node_script = """
        import fs from 'fs';
        const SITE_URL = 'https://www.openjam.fun';
        const code = fs.readFileSync('./frontend-next/components/JsonLd.js', 'utf8');
        const match = code.match(/const jsonLd = (\\{[\\s\\S]*?\\});\\s*return/);
        if (!match) throw new Error('jsonLd object not found');
        const jsonLd = eval('(' + match[1] + ')');
        console.log(JSON.stringify(jsonLd));
        """
        output_json = run_node_js(node_script)
        json_ld = json.loads(output_json)

        graph = json_ld.get("@graph", [])
        faq_schema = next((item for item in graph if item.get("@type") == "FAQPage"), None)

        assert faq_schema is not None, "components/JsonLd.js @graph MUST include '@type': 'FAQPage' schema!"
        main_entity = faq_schema.get("mainEntity", [])
        assert len(main_entity) > 0, "FAQPage schema mainEntity array must not be empty"

        first_q = main_entity[0]
        assert first_q.get("@type") == "Question"
        assert "name" in first_q
        assert "acceptedAnswer" in first_q
        assert first_q["acceptedAnswer"].get("@type") == "Answer"
        assert "text" in first_q["acceptedAnswer"]

    def test_search_engine_verification_meta_tags(self):
        """app/layout.js metadata MUST support Google Search Console & Bing Webmaster verification options."""
        node_script = """
        import fs from 'fs';
        const SITE_URL = 'https://www.openjam.fun';
        const code = fs.readFileSync('./frontend-next/app/layout.js', 'utf8');
        const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});\\s*export const viewport/);
        if (!match) throw new Error('metadata not found in layout.js');
        const metadata = eval('(' + match[1] + ')');
        console.log(JSON.stringify(metadata));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        verification = meta.get("verification", {})
        assert "google" in verification or "google-site-verification" in meta, (
            f"app/layout.js metadata must specify verification for Google Search Console. Got: {verification}"
        )
        assert any(k in verification for k in ["bing", "yandex", "other", "msvalidate.01"]), (
            f"app/layout.js metadata must specify verification for Bing Webmaster. Got: {verification}"
        )


# ==============================================================================
# TIER 4: Open Graph & Twitter Social Card Optimization (R3)
# ==============================================================================

class TestTier4SocialShareCards:
    """Tests for Tier 4: Open Graph & Twitter Social Card Optimization."""

    @pytest.mark.asyncio
    async def test_backend_og_image_generator_png_binary(self):
        """backend/services/og_generator.py generate_og_image MUST generate valid PNG image binary."""
        png_bytes = await generate_og_image(
            inviter_name="Alice",
            room_name="Synthwave Lounge",
        )
        assert isinstance(png_bytes, bytes)
        assert len(png_bytes) > 0
        assert png_bytes.startswith(b"\x89PNG\r\n\x1a\n"), "Generated image must start with PNG magic bytes"

        # Verify PIL can open the image and dimensions are 1200x630
        img = Image.open(io.BytesIO(png_bytes))
        assert img.size == (1200, 630), f"OG image dimensions must be (1200, 630), got {img.size}"

    @pytest.mark.asyncio
    async def test_backend_og_image_generator_with_avatar(self):
        """generate_og_image handles optional avatar and room details gracefully."""
        png_bytes = await generate_og_image(
            inviter_name="Bob",
            room_name="Lo-Fi Beats Room",
            avatar_url="https://example.com/nonexistent_avatar.png"
        )
        assert isinstance(png_bytes, bytes)
        img = Image.open(io.BytesIO(png_bytes))
        assert img.size == (1200, 630)

    def test_room_page_open_graph_card_now_playing(self):
        """Room page generateMetadata MUST populate OG/Twitter cards with track cover art, host names, and listener counts."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        globalThis.fetch = async (url) => {
          if (url.includes('/rooms/room-np-1')) {
            return {
              ok: true,
              json: async () => ({
                room: {
                  id: 'room-np-1',
                  name: 'Chill Vibes Jam',
                  is_private: false,
                  host_name: 'DJ_Alice',
                  listener_count: 14,
                  current_track: {
                    track_name: 'Resonance',
                    artist: 'HOME',
                    album_art_url: 'https://example.com/resonance.jpg'
                  }
                }
              })
            };
          }
          return { ok: false, status: 404 };
        };

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('room-np-1');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        # Check Open Graph
        og = meta.get("openGraph", {})
        assert "Resonance" in og.get("title", ""), f"OG title must include track name 'Resonance'. Got: {og.get('title')}"
        assert "HOME" in og.get("title", ""), f"OG title must include artist name 'HOME'. Got: {og.get('title')}"
        assert "14" in og.get("description", ""), f"OG description must include listener count '14'. Got: {og.get('description')}"

        images = og.get("images", [])
        assert len(images) > 0, "OG card must specify at least one image"
        og_img_url = images[0].get("url", "")
        assert "resonance.jpg" in og_img_url or "api/og/room" in og_img_url, (
            f"OG image URL must use track album art or dynamic OG endpoint, got: {og_img_url}"
        )

    def test_room_page_twitter_card_format(self):
        """Room page metadata MUST configure Twitter card as 'summary_large_image' with title, description, and images."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/room/[id]/page.js', 'utf8');

        globalThis.fetch = async () => ({
          ok: true,
          json: async () => ({
            room: {
              id: 'room-tw-1',
              name: 'Twitter Card Room',
              is_private: false,
              host_name: 'Charlie',
              listener_count: 3
            }
          })
        });

        const cleanCode = code
          .replace(/import\\s+[\\s\\S]*?from\\s+['"][^'"]+['"];?/g, '')
          .replace(/export\\s+function\\s+generateStaticParams[\\s\\S]*?\\}\\n/g, '')
          .replace(/export\\s+default\\s+function\\s+RoomPage[\\s\\S]*$/g, '')
          .replace(/export\\s+/g, '');

        const evalFunc = new Function('roomId', 'return (async () => {' + cleanCode + '; return await generateMetadata({ params: Promise.resolve({ id: roomId }) });})()');
        const meta = await evalFunc('room-tw-1');
        console.log(JSON.stringify(meta));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        tw = meta.get("twitter", {})
        assert tw.get("card") == "summary_large_image", (
            f"Twitter card type must be 'summary_large_image', got: '{tw.get('card')}'"
        )
        assert "title" in tw
        assert "description" in tw
        assert "images" in tw and len(tw["images"]) > 0

    def test_landing_page_og_and_twitter_cards(self):
        """app/page.js metadata MUST configure explicit openGraph and twitter cards."""
        node_script = """
        import fs from 'fs';
        const code = fs.readFileSync('./frontend-next/app/page.js', 'utf8');
        const match = code.match(/export const metadata = (\\{[\\s\\S]*?\\});/);
        if (!match) throw new Error('metadata not found in page.js');
        const metadata = eval('(' + match[1] + ')');
        console.log(JSON.stringify(metadata));
        """
        output_json = run_node_js(node_script)
        meta = json.loads(output_json)

        og = meta.get("openGraph", {})
        assert "title" in og
        assert "description" in og
        assert og.get("url") == "https://www.openjam.fun"

        tw = meta.get("twitter", {})
        assert tw.get("card") == "summary_large_image", (
            f"Landing page twitter.card must be 'summary_large_image', got: '{tw.get('card')}'"
        )
        assert "title" in tw
        assert "description" in tw
