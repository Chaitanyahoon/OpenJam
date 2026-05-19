# Session Summary

## What was accomplished

### Database & Deployment
- **PostgreSQL migration**: Added `psycopg2-binary`, updated `render.yaml` (removed disk, DATABASE_URL set manually), removed `data/` dir from Dockerfile, documented PostgreSQL URL format in `.env.example`.
- Fixed `psycopg2 not found` on Render by ensuring all commits were properly pushed.
- Commits: `9a10e1f`, `b04987f`, `cebf9b8`, `cd83441`, `911bba4`, `6e8d1f9`, `bf25343`

### Invidious Proxy (Primary Stream Source)
- Created `backend/services/invidious.py` — 15 public instances, health-checked every 5 minutes.
- Updated `backend/routes/queue.py` — `_resolve_audio_url()` tries Invidious first, yt-dlp fallback. Unified caching via shared `_url_cache`.
- Added 10s load timeout and 15s stall/waiting timeout for faster IFrame fallback.
- **Fixed**: Added async lock to prevent concurrent health checks.
- **Fixed**: `stream_audio` now properly closes httpx client on upstream errors, returns 502 instead of proxying non-2xx responses.

### Audio Playback Fixes
- **IFrame fallback infinite loop**: `_loadVideo` now queues `_pendingLoad` when `_useIFrame` is true but `ytPlayer` isn't ready.
- **Host play/pause**: Now checks `yt._useIFrame && yt.ytPlayer.getPlayerState()`.
- **Last-song skip**: Added `yt.stop()` method (pauses IFrame, clears state). Called on `updateNP(null)`.

### P1 — Duplicate Join Messages
- Backend: `room_manager.join_room()` returns `(error, was_new)` tuple.
- Backend: `user_joined` broadcast only when `was_new` is True.
- Frontend: Removed duplicate `connect` handler in `room.html`.
- Frontend: `SocketClient` uses `_hasConnected` flag to auto-join only on reconnect.

### P3 — Loading Overlay
- Animated overlay with pulse spinner + message. Hidden after `loadRoom()` completes.

### P6 — Avatar Removal
- Replaced `getAvatarUrl()` with `avatarHTML(name)` — colored initials derived from name hash.
- Removed avatar picker modal and all avatar rendering in chat/members.
- Added `.av-initials` CSS with distinct sizing for chat messages vs member list.

### P4 — Chat Reliability
- Added `_chatQueue` with retry (2s backoff) via `_processChatQueue()`.
- Added dedup on `addChat` using `msg.id` (or composite key fallback).
- `sendMsg` queues message for sending instead of calling socket directly.
- **Server delivery ACK**: `send_chat` emits `chat_ack` to sender with message ID after DB persist.
- **ACK-based dequeue**: `sendChat()` returns a Promise resolved on ACK; queue only shifts on success.
- **10s timeout**: If no ACK in 10s, message stays in queue for retry.

### P5 — Reactions Rate Limit
- Frontend: `_lastReactionTime` check (400ms throttle), `MAX_VISIBLE_REACTIONS=5` cap, fade-out animation.
- **Server-side**: Per-user 500ms rate limit via `_last_reaction_time` dict.

### P7 — Mobile UI Refinements
- Now Playing tab now slides to show queue panel.
- Proper tab active state management (nowplaying included in deactivation).
- Compact queue items, members list, reactions bar for mobile.
- Volume bar slider bigger touch target (24px height).
- Search results full-width on mobile.

## Files Modified
- `backend/services/room_manager.py` — join_room returns (error, was_new)
- `backend/sockets/connection.py` — broadcast gated by was_new
- `backend/sockets/chat.py` — chat_ack delivery tracking, server-side reaction rate limit
- `backend/services/invidious.py` — health check lock to prevent race
- `backend/routes/queue.py` — stream_audio resource cleanup, 502 on bad upstream
- `frontend/js/socket-client.js` — _hasConnected flag, Promise-based sendChat with ACK
- `frontend/js/youtube-player.js` — stop(), IFrame fix, timeouts
- `frontend/room.html` — loading overlay, avatar initials, chat retry, reactions rate limit, mobile tabs fix, dedup
- `frontend/css/style.css` — loading overlay, avatar initials, P7 mobile refinements
- `frontend/index.html`, `terms.html`, `privacy.html` — CSS cache version bump

## Pending Work
- ~~Chat reliability still needs message persistence tracking (server-side).~~
- ~~Reactions could use server-side rate limiting.~~
- Mobile UI could further improve with swipe gestures between panels.

## Key Decisions
- Invidious proxy over IFrame-first: avoids YouTube ads on cloud IPs while staying free.
- Colored initials over profile images: cleaner aesthetic, no external API dependency.
- Shared `_url_cache` for Invidious + yt-dlp: prevents redundant lookups.
- Chat retry queue instead of optimistic rendering: avoids dedup complexity.

## Commands Reference
- `npm run dev` — start dev server
- `npm run lint` — lint check
- `npm run typecheck` — type check
