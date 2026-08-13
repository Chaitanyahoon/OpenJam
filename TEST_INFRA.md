# Test Infrastructure — OpenJam SEO Overhaul

## Overview
The OpenJam SEO test infrastructure validates end-to-end SEO functionality across four tiers (Tiers 1–4) covering requirements R1, R2, and R3. It integrates Python `pytest` with Next.js ES module runtime evaluation via Node.js and FastAPI `TestClient` backend testing.

## Test Runner & Environment
- **Test Framework**: `pytest` 7.4.3 (Python 3.14)
- **Node.js Environment**: Node v24.11.1 (`node --input-type=module`)
- **Primary Command**: `.venv\Scripts\python.exe -m pytest tests/test_seo_e2e.py`
- **Full Suite Command**: `.venv\Scripts\python.exe -m pytest tests/`

## Infrastructure Architecture

### 1. Next.js ES Module Evaluation Bridge (`run_node_js`)
Subprocess bridge that executes Next.js page, sitemap, robots, and component modules in Node.js ESM mode:
- Evaluates `app/room/[id]/page.js` `generateMetadata({ params })` with mocked global `fetch`.
- Evaluates `app/sitemap.js` `sitemap()` with dynamic room backend response mocks.
- Evaluates `app/robots.js` `robots()` rule definitions for standard crawlers (`*`) and AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`).
- Parses and evaluates JSON-LD schema graphs from `components/JsonLd.js`.
- Evaluates Next.js layout (`app/layout.js`) and landing page (`app/page.js`) metadata objects.

### 2. Backend API Contract Testing (`TestClient`)
FastAPI `TestClient` using SQLite in-memory test database fixture (`db_session`, `client`):
- `GET /rooms/{id}`: Verifies `is_private` boolean field and `password_required` response structure for public vs private rooms.
- `GET /rooms?limit=100`: Verifies room list pagination and active room attributes required for dynamic sitemap generation.

### 3. Dynamic Open Graph Binary Validation (`Pillow`)
Binary verification of dynamic OG image generation (`backend/services/og_generator.py`):
- Magic bytes check: `b"\x89PNG\r\n\x1a\n"`.
- Pillow `Image.open(io.BytesIO(png_bytes))` verification for image dimensions `(1200, 630)` and format `PNG`.

## Test File Layout
- `tests/test_seo_e2e.py`: Main requirement-driven E2E test suite covering Tiers 1–4.
  - `TestTier1SearchIndexing`: Robots metadata indexing for public vs private/loading/404 rooms.
  - `TestTier2SitemapAndRobotsTxt`: Dynamic sitemap route generation and AI crawler rules in robots.js.
  - `TestTier3KeywordsAndJsonLdSchema`: High-intent search keywords, FAQPage & SoftwareApplication JSON-LD schemas, search engine verification meta tags.
  - `TestTier4SocialShareCards`: Dynamic Open Graph & Twitter social cards, cover art, host names, listener counts, and backend OG image generator.
