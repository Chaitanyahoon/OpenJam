## 2026-08-13T14:55:00Z

You are Worker 1 for Milestone 1 (M1: Search Indexing & Public Room Visibility).
Working directory: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m1_1
Read ORIGINAL_REQUEST.md at: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/ORIGINAL_REQUEST.md
Read PROJECT.md at: c:/Users/patil/OneDrive/Desktop/open/OpenJam/PROJECT.md
Read Explorer 1 handoff at: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m1_1/handoff.md
Read Explorer 2 handoff at: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m1_2/handoff.md
Read Explorer 3 handoff at: c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_explorer_m1_3/handoff.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your mission:
1. Modify `frontend-next/app/room/[id]/page.js`: Update `generateMetadata` so that when `data && data.room` is returned, `robots` is dynamically set to `{ index: true, follow: true }` when `!data.room.is_private`, and `{ index: false, follow: false }` when `data.room.is_private === true`. Retain `{ index: false, follow: false }` for loading, invalid ID, or error fallbacks.
2. Modify `frontend-next/app/sitemap.js`: Convert `sitemap()` into an `async function sitemap()`. Fetch active public rooms from backend GET `${backendUrl}/rooms?limit=100`, filter `!r.is_private`, and append `/room/${room.id}` entries with `changeFrequency: 'hourly'` and `priority: 0.8`. Use try/catch fallback so `npm run build` never breaks if backend is unreachable.
3. Modify `frontend-next/app/robots.js`: Allow AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) access to `/room/` by removing `/room/` from disallow array and adding it to allow array for AI crawler user agents.
4. Run build verification: execute `npm run build` inside `frontend-next/` and verify it completes with 0 errors.
5. Run backend tests: execute `.venv\Scripts\python.exe -m pytest` and verify all tests pass.

Write your handoff report to `c:/Users/patil/OneDrive/Desktop/open/OpenJam/.agents/teamwork_preview_worker_m1_1/handoff.md` and report back via send_message.
