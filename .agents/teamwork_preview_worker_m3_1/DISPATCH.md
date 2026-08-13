## 2026-08-13T15:09:20Z
You are assigned as Worker M3 to implement Milestone 3 (Open Graph Social Cards & CTR Optimization) for OpenJam.

Working Directory: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m3_1

Required Reference Documents:
- ORIGINAL_REQUEST: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/ORIGINAL_REQUEST.md
- PROJECT: c:/Users/patil/OneDrive/Desktop/open/OpenJam/PROJECT.md
- Explorer Handoff 1: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m3_1/handoff.md
- Explorer Handoff 2: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m3_2/handoff.md
- Explorer Handoff 3: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m3_3/handoff.md

Your Tasks:
1. Update `backend/services/og_generator.py`:
   - Enhance `generate_og_image(...)` signature to accept `inviter_name`, `room_name`, `avatar_url`, `track_name`, `artist`, `listener_count`, `cover_art_url`.
   - Render high-impact 1200x630 PNG visual card featuring top OpenJam brand pill, live listener count badge ("🎧 X listening"), host name, room title, now playing track title and artist, rounded cover art overlay card (with fallback to avatar or default icon), and OpenJam footer.
2. Update `backend/main.py`:
   - Expand `@app.get("/api/og/room/{room_id}.png")` endpoint parameters to accept `inviter`, `track_name`, `artist`, `listener_count`, `cover_art_url`.
   - Implement automatic fallback logic querying DB room, `queue_manager.get_now_playing`, and `room_manager.get_listener_count` when query params are omitted.
   - Return PNG response with appropriate `Cache-Control` header.
3. Update `frontend-next/app/page.js`:
   - Complete `openGraph` and `twitter` social share card metadata with explicit `images` array pointing to `https://www.openjam.fun/static/img/hero_visual_showcase.webp`, `siteName: "OpenJam"`, `locale: "en_US"`, `type: "website"`.
4. Update `frontend-next/app/room/[id]/page.js`:
   - Update `generateMetadata` to construct `openGraph` and `twitter` metadata dynamically.
   - Construct `og:image` URL using `URLSearchParams` pointing to `${backendUrl}/api/og/room/${id}.png?...` with `inviter`, `track_name`, `artist`, `listener_count`, and `cover_art_url`.
   - Ensure loading and fallback room pages return valid fallback `openGraph` and `twitter` card objects.
5. Build & Test Verification:
   - Run `npm run build` in `frontend-next/` (exit code 0).
   - Run `python -m pytest tests/test_seo_e2e.py` (21/21 tests pass cleanly).
6. Write handoff report to `c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m3_1/handoff.md`.
