# Handoff Report: Open Graph Cards & Build/Test Infrastructure Survey

**Agent**: Explorer 3 (Survey: Open Graph Cards & Build/Test Infra)  
**Working Directory**: `c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_survey_3`  
**Date**: 2026-08-13  

---

## 1. Observation

### 1.1 Frontend Open Graph Metadata Architecture & Exact File Locations
- **`frontend-next/app/layout.js` (lines 37-87)**:
  - Sets root `metadataBase`: `new URL("https://www.openjam.fun")`.
  - Defines base `openGraph`:
    - `title`: `"Open Jam — Listen Together in Real-Time"`
    - `description`: `"Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time."`
    - `url`: `"https://www.openjam.fun"`
    - `siteName`: `"Open Jam"`
    - `locale`: `"en_US"`
    - `type`: `"website"`
    - `images`: `[{ url: "/static/img/hero_visual_showcase.webp", width: 1200, height: 630, alt: "Open Jam — Listen Together in Real-Time" }]`
  - Defines base `twitter`:
    - `card`: `"summary_large_image"`
    - `title`: `"Open Jam — Listen Together in Real-Time"`
    - `description`: `"Create and join public listening rooms. Stream music, sync playback with friends, share queues, and discover new songs together in real-time."`
    - `images`: `["/static/img/hero_visual_showcase.webp"]`
- **`frontend-next/app/page.js` (lines 4-13)**:
  - Defines landing page `metadata`:
    - `title`: `"Listen Together in Real-Time | Open Jam"`
    - `description`: `"Join public listening rooms, stream music synchronously with friends, queue up your favorite YouTube videos, and experience real-time collaborative playback. No registration required."`
    - `alternates`: `{ canonical: "https://www.openjam.fun" }`
    - `openGraph`: `{ title, description, url: "https://www.openjam.fun" }`
  - *Observation*: `app/page.js` currently omits explicit `openGraph.images` and `twitter` objects, relying on inheritance from `layout.js`.
- **`frontend-next/app/room/[id]/page.js` (lines 9-97)**:
  - Exports `async function generateMetadata({ params })`:
    - Resolves `id = (await params)?.id`.
    - If `!id || id === 'loading'`: Returns generic title/description with `robots: { index: false, follow: false }`.
    - Fetches backend URL: `${backendUrl}/rooms/${id}` with `{ next: { revalidate: 30 } }`.
    - Extract fields: `room = data.room`, `currentTrack = room.current_track`, `listenerCount = room.listener_count || 0`, `inviter = room.host_name || 'Someone'`.
    - Constructs `ogImage`: `currentTrack?.album_art_url || \`${backendUrl}/api/og/room/${id}.png?inviter=${encodeURIComponent(inviter)}\``.
    - Builds `openGraph`:
      - `title`: `currentTrack ? \`Now Playing: ${currentTrack.track_name} by ${currentTrack.artist} in ${room.name}\` : \`${room.name} — Open Jam\``
      - `description`: `currentTrack ? \`Listening to "${currentTrack.track_name}" by ${currentTrack.artist} in ${room.name} with ${listenerCount} other listener(s). Join Open Jam to listen along!\` : (room.description || \`Join the listening room "${room.name}" on Open Jam to stream music together in real-time.\`)`
      - `type`: `'music.playlist'`
      - `url`: `https://www.openjam.fun/room/${id}`
      - `images`: `[{ url: ogImage, width: 1200, height: 630, alt: title }]`
    - Builds `twitter`:
      - `card`: `'summary_large_image'`
      - `title`, `description`, `images: [ogImage]`
    - *Observation*: Line 56 and Line 89 unconditionally set `robots: { index: false, follow: false }` for ALL rooms. This blocks search engine crawlers from indexing public rooms (conflicting with R1).

### 1.2 Dynamic Social Cards & Image Backend Endpoint
- **`backend/main.py` (lines 336-358)**:
  - Route `@app.get("/api/og/room/{room_id}.png")`:
    - Queries `Room` model by `room_id`.
    - Obtains `host.display_name` and `host.avatar_url`.
    - Calls `generate_og_image(inviter_name=inviter, room_name=room_name, avatar_url=avatar_url)` in `backend/services/og_generator.py`.
    - Returns `Response(content=image_bytes, media_type="image/png")`.
- **`backend/services/og_generator.py` (lines 52-137)**:
  - Uses `PIL` (Pillow) to draw a 1200x630 gradient canvas.
  - Draws `INVITER,`, `invited you to`, `ROOM_NAME`, host avatar, and `OpenJam` logo.
  - *Observation*: The backend image generator does NOT yet display currently playing track name, artist, track cover art, or live listener count on the generated image canvas.

### 1.3 Build & Test Infrastructure Verification
- **Build Command**: `npm run build` inside `c:/Users/patil/OneDrive/Desktop/open/OpenJam/frontend-next`
  - Output: Compiled successfully in 6.3s, Turbopack, TypeScript check passed in 164ms, generated static HTML for 14 routes. Exit code: `0`.
- **Frontend Dependencies (`frontend-next/package.json`)**:
  - Next.js: `16.2.9`
  - React: `19.2.4`
  - Dev dependencies: `next-sitemap` `^4.2.3`, `typescript` `^5.0.0`
- **Backend Test Environment**:
  - Python: `3.14.3` in `.venv`
  - Test command: `.venv\\Scripts\\python.exe -m pytest`
  - Output: 70 passed out of 70 test items in 43.00s. Exit code: `0`.
  - Test config: `pytest.ini` (`asyncio_mode = auto`, `python_files = test_*.py`).

---

## 2. Logic Chain

1. **R3 Requirements vs Existing Codebase**:
   - R3 requires dynamic social share previews (Discord, Twitter/X, WhatsApp, Reddit) optimized with **track cover art**, **host names**, and **live listener counts**.
   - Currently, `app/room/[id]/page.js` fetches `currentTrack`, `host_name`, and `listener_count` in `generateMetadata`.
   - When `currentTrack` exists, `ogImage` uses `currentTrack.album_art_url` directly. However:
     - Direct album art lacks room branding, host name, and listener count overlay.
     - When `currentTrack` is missing, `ogImage` falls back to `${backendUrl}/api/og/room/${id}.png?inviter=${inviter}`, but the backend image generator only renders inviter name and room name (missing live listener counts and track info).
2. **Dynamic Social Card Enhancement Options**:
   - *Option A (Next.js Dynamic OG Route)*: Add Next.js 16 `ImageResponse` (from `next/og`) at `app/room/[id]/opengraph-image.js` or `app/api/og/room/[id]/route.js`. This allows Next.js to render JSX into SVG/PNG natively, displaying track artwork, room title, host name, and live listener badge directly within Next.js.
   - *Option B (Backend Pillow OG Generator)*: Update `backend/services/og_generator.py` and route `/api/og/room/{room_id}.png` to accept `track_name`, `artist`, `cover_art`, and `listener_count` parameters and render them onto the PIL image canvas.
   - *Option C (Hybrid/Optimized)*: Pass enriched room metadata (track name, artist, cover art URL, listener count, host name) in `generateMetadata`'s `og:title`, `og:description`, `openGraph.images`, and `twitter.images` fields, while ensuring dynamic OG endpoints support track cover art + listener count overlays.
3. **SEO Indexing & Metadata Integrity**:
   - `app/room/[id]/page.js` `generateMetadata` must dynamically set `robots`:
     - If `room.is_private` is `true`: `{ index: false, follow: false }`
     - If `room.is_private` is `false`: `{ index: true, follow: true }`
   - `app/page.js` metadata should explicitly include `openGraph.images`, `twitter: { card: 'summary_large_image' }`, and high-intent keywords ("listen music with friends online free", "synced music playback").

---

## 3. Caveats

1. **Backend Service Dependency**: `app/room/[id]/page.js` `generateMetadata` relies on fetching `${backendUrl}/rooms/${id}` during server-side render or revalidation (revalidate: 30s). If the backend is unreachable during build or request time, it falls back to default generic metadata.
2. **Third-Party Image Hotlinking**: Track album art URLs from external sources (YouTube, Spotify, etc.) may have CORS or anti-hotlinking headers when fetched by social media crawlers. Using a composite dynamic OG card wrapper ensures a self-hosted preview image.
3. **No Direct Code Modifications Performed**: As Explorer 3 operating under read-only survey guidelines, no source code in `frontend-next/` or `backend/` was altered.

---

## 4. Conclusion

- **Existing Structure**: The Open Graph card metadata framework is mostly in place in `app/room/[id]/page.js` and `app/layout.js`, backed by `backend/services/og_generator.py`.
- **Missing Pieces for R3 & Acceptance Criteria**:
  1. `app/room/[id]/page.js` hardcodes `robots: { index: false, follow: false }` for all rooms. It must conditionally evaluate `room.is_private` so public rooms output `robots: { index: true, follow: true }`.
  2. `app/room/[id]/page.js` metadata `description` should explicitly feature the `host_name` alongside `listenerCount` and `currentTrack`.
  3. Dynamic OG card image generator (`backend/services/og_generator.py` or Next.js `next/og` route) lacks visual rendering of live listener counts and current track cover art overlays.
  4. Landing page metadata (`app/page.js`) should be updated with target high-intent keywords and explicit Open Graph image properties.
- **Build & Test Infrastructure Status**:
  - `npm run build` in `frontend-next/` executes with 0 errors and generates static pages cleanly.
  - `.venv\Scripts\python.exe -m pytest` executes all 70 test items with 100% pass rate (70/70 passed).

---

## 5. Verification Method

To independently verify the build environment and Open Graph metadata setup:

1. **Frontend Build Verification**:
   ```bash
   cd c:/Users/patil/OneDrive/Desktop/open/OpenJam/frontend-next
   npm run build
   ```
   *Expected Result*: Process finishes with exit code `0`, reporting 14 compiled routes.

2. **Backend Pytest Verification**:
   ```bash
   cd c:/Users/patil/OneDrive/Desktop/open/OpenJam
   .venv\Scripts\python.exe -m pytest
   ```
   *Expected Result*: Pytest suite executes 70 tests (100% passing).

3. **Metadata Inspection Files**:
   - Inspect `frontend-next/app/room/[id]/page.js` lines 53-78 for `openGraph` and `twitter` object structures.
   - Inspect `backend/services/og_generator.py` lines 52-137 for Pillow image synthesis implementation.
