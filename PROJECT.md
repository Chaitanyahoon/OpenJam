# Project: OpenJam SEO Overhaul

## Architecture
- Framework: Next.js 16 (App Router) in `frontend-next/`, FastAPI backend in `backend/`.
- Entry Points: `frontend-next/app/layout.js`, `frontend-next/app/page.js`, `frontend-next/app/room/[id]/page.js`, `frontend-next/app/robots.js`, `frontend-next/app/sitemap.js`, `frontend-next/components/JsonLd.js`.
- Shared Interfaces / Models: `Room` model in `backend/models/room.py`, GET `/rooms` API endpoint, GET `/rooms/{id}` API endpoint, GET `/api/og/room/{id}.png` dynamic OG image endpoint.

## Feature Inventory
Every feature from the Survey phase is assigned to a milestone below:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Public Room Search Indexing | Set `robots: { index: true, follow: true }` when `is_private: false` in `app/room/[id]/page.js` while keeping private/loading/error rooms `noindex, nofollow` | M1 | R1 |
| 2 | Dynamic Sitemap Generation | Implement dynamic `async function sitemap()` in `app/sitemap.js` fetching active public rooms from backend GET `/rooms` | M1 | R1 |
| 3 | AI Crawler Accessibility in robots.js | Update `app/robots.js` rules so AI crawlers (GPTBot, ClaudeBot, etc.) can access public room pages | M1 | R1 |
| 4 | High-Intent Keyword Metadata | Enrich `app/layout.js` and `app/page.js` with keywords ("openjam", "listen to music with friends online", "shared music listening room", "sync youtube music with friends", etc.) | M2 | R2 |
| 5 | FAQPage & SoftwareApplication Schema | Update `components/JsonLd.js` with `FAQPage` schema matching `FaqSection.js` and enrich `SoftwareApplication` schema | M2 | R2 |
| 6 | Search Console Verification Metadata | Add `verification` options for Google Search Console and Bing Webmaster meta tags in `app/layout.js` & static HTML verification support in `public/` | M2 | R2 |
| 7 | Dynamic OG & Twitter Cards for Rooms | Populate `og:image`, `og:title`, `og:description` with track cover art, host names, live listener counts in `app/room/[id]/page.js` | M3 | R3 |
| 8 | Enhanced Backend OG Card Image Generator | Update `backend/services/og_generator.py` and dynamic OG endpoint to support track cover art, host names, and live listener count overlays | M3 | R3 |
| 9 | Landing Page Social Share Cards | Add explicit `openGraph` and `twitter` card images and metadata to `app/page.js` | M3 | R3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Search Indexing & Public Room Visibility | Fix public room robots meta, AI crawler access in `robots.js`, dynamic room fetching in `sitemap.js` | none | DONE |
| 2 | M2: Keyword Metadata & Schema.org Rich Snippets | Keyword metadata in layout/page, `FAQPage` and `SoftwareApplication` in `JsonLd.js`, Webmaster verification support | M1 | DONE |
| 3 | M3: Open Graph Social Cards & CTR Optimization | Dynamic social cards with track art, host names, listener counts in page metadata and OG image generator | M2 | IN_PROGRESS |
| 4 | M4: E2E Testing Suite & Build Hardening | Requirement-driven test suite (Tiers 1-4), build validation `npm run build` | M1, M2, M3 | IN_PROGRESS |

## Interface Contracts
### Frontend (`frontend-next`) ↔ Backend (`backend`)
- GET `/rooms?limit=100`: Returns array of active rooms `[{ id, name, is_private, listener_count, host_name, ... }]`. `sitemap.js` calls this to filter `!is_private` rooms.
- GET `/rooms/{id}`: Returns `{ room: { id, name, is_private, host_name, listener_count, current_track: { track_name, artist, album_art_url } } }` or `{ is_private: true }`. `generateMetadata` in `room/[id]/page.js` uses this to evaluate `robots` and construct `openGraph` / `twitter` metadata.
- GET `/api/og/room/{id}.png`: Returns PNG image preview. Accepts optional query params (`inviter`, `track_name`, `artist`, `listener_count`).

## Code Layout
- Frontend metadata & routes: `frontend-next/app/`
- Frontend components: `frontend-next/components/`
- Backend endpoints: `backend/routes/`
- Backend services: `backend/services/`
