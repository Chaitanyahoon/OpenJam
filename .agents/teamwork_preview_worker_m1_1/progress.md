# Progress Log

Last visited: 2026-08-13T20:26:30Z

- Modified `frontend-next/app/room/[id]/page.js`: dynamic `robots` set based on `!room.is_private`.
- Modified `frontend-next/app/sitemap.js`: converted `sitemap()` to async function, fetching active rooms from backend `/rooms?limit=100`, filtering public rooms, appending `/room/${room.id}` entries with `changeFrequency: 'hourly'` and `priority: 0.8`.
- Modified `frontend-next/app/robots.js`: allowed AI crawlers (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) access to `/room/`.
- Verified `npm run build` in `frontend-next/`: Completed with 0 errors.
- Running backend pytest (`.venv\Scripts\python.exe -m pytest`).
