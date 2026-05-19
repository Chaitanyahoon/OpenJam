# Open Jam — How It Works

## Architecture

Open Jam is a real-time collaborative music listening app. A Python/FastAPI backend serves the frontend (vanilla HTML/CSS/JS) and manages WebSocket connections via Socket.IO. PostgreSQL on Supabase (free tier) stores rooms, users, queue items, and chat messages, accessed through PgBouncer (port 6543) to stay within the 2-connection free tier limit. The app runs on Render's free tier inside a Docker container behind Cloudflare CDN.

## Page Flow

1. **Homepage** (`/`): Lists all active rooms. "Create Room" opens a modal to set name, tags, queue mode. Socket.IO loads asynchronously (non-blocking CDN script) so the page renders immediately.

2. **Auth**: When creating/joining a room, the server checks `session_token` cookie. If missing, the user is prompted for a display name and gets a guest identity stored in PostgreSQL and a session cookie.

3. **Room Page** (`/room/{id}`): Shows a loading overlay with "Setting up your room…". The overlay always disappears after 3 seconds (guaranteed by a `setTimeout` registered before any async work). Behind it, an animated amber top-loading bar shows until `loadRoom()` fetches room data from the REST API. Meanwhile, Socket.IO connects asynchronously — the room controller polls every 200ms for the `io` global (set when the async CDN script finishes). Once available, `sc.connect()` creates the socket and `sc.joinRoom()` emits `join_room` on the `connect` event. The server responds with chat history, current queue, and playback state.

## Room Layout (4 panels, swipeable on mobile)

- **Now Playing** (left): Album art (with spinning animation), title, artist, progress bar, play/pause, volume slider, lyrics (fetched from lrclib.net). A stream-loading indicator shows while the backend resolves audio URLs.
- **Queue** (bottom): List of upcoming tracks. Users vote on tracks (in open mode) or DJs manage (in curated mode). Skip button triggers a vote.
- **Chat** (center): Real-time chat with ACK-based delivery. Messages are queued client-side and retried every 2s until acknowledged by the server (10s timeout). Typing indicators show when others are typing.
- **Members** (right): List of listeners with colored-initial avatars (generated from name hash, no external API). Live listener count badge.

## Audio Playback

The backend resolves YouTube URLs to direct audio streams using a two-layer strategy:

1. **Invidious proxy** (primary): 15 public instances are health-checked every 5 minutes. All 15 are queried in parallel with 5s timeout — first to respond wins.
2. **yt-dlp fallback**: Runs as a subprocess with `-f bestaudio -g` flag, printing just the stream URL (~1-2s faster than the Python API).

Results are cached in `_url_cache` with a 5-hour TTL and shared between both layers. On the client, the `YouTubePlayer` class uses native HTML5 `<Audio>` for streaming. If the stream fails twice, it falls back to the YouTube IFrame API. The player has 10s load timeout and 15s stall timeout for fast fallback.

## WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_room` | Client→Server | Join a room (sent on every socket connect) |
| `leave_room` | Client→Server | Leave a room |
| `send_chat` | Client→Server | Send a chat message (gets `chat_ack` response) |
| `chat_ack` | Server→Client | Confirms message was persisted |
| `chat_message` | Server→Client | Broadcasts message to all room members |
| `add_to_queue` | Client→Server | Add a track |
| `vote_track` | Client→Server | Vote for a track |
| `next_track` | Client→Server | Host skips to next track |
| `playback_update` | Client→Server | Host syncs playback position |
| `playback_sync` | Server→Client | Syncs all clients to host's position |
| `track_changed` | Server→Client | New track started playing |
| `queue_updated` | Server→Client | Queue changed (add/vote/skip) |
| `user_joined` | Server→Client | Only broadcast when user was_new (deduplicated) |
| `user_left` | Server→Client | User disconnected |
| `listener_count` | Server→Client | Live count + member list |
| `reaction` | Server→Client | Emoji reaction (rate-limited: 400ms client, 500ms server, max 5 visible) |
| `user_typing` | Server→Client | User started typing |
| `user_stop_typing` | Server→Client | User stopped typing |
| `heartbeat` | Client→Server | Keepalive every 25s |
| `heartbeat_ack` | Server→Client | Heartbeat response |
| `room_closed` | Server→Client | Room was closed by host |
| `skip_votes_updated` | Server→Client | Vote progress updated |
| `join_error` | Server→Client | Room is full or join rejected |
| `queue_error` | Server→Client | Action blocked (e.g., queue locked) |

## Rate Limits

- **Server**: 120 requests/minute via slowapi
- **Reactions**: 400ms client-side throttle + 500ms server-side per-user rate limit
- **Chat**: No hard limit, but ACK-based flow naturally paces at network speed
- **Room capacity**: Free users limited to room capacity; premium users skip the check

## Database

- **Supabase PostgreSQL** (free tier, max 2 connections)
- **PgBouncer** on port 6543 for connection pooling (manages many users over 1-2 actual connections)
- Pool config: `pool_size=1, max_overflow=1, pool_pre_ping=True, pool_recycle=120s, connect_timeout=10s`
- Tables: `users`, `rooms`, `queue_items`, `chat_messages`

## Cold Start Mitigation

Render's free tier spins down after 15 minutes of inactivity. A cron job hits `https://openjam.onrender.com/ping` every 5 minutes to keep the app warm. The `/ping` endpoint returns `{uptime_seconds, cold_start}` and does NOT hit the database, so it's always fast. The `/health` endpoint checks the database and prevents room close timers from expiring.

## Key Design Decisions

- **Invidious over IFrame-first**: Avoids YouTube ads on cloud IPs while staying free.
- **Colored initials over profile images**: Cleaner aesthetic, no DiceBear/external API dependency.
- **yt-dlp subprocess with `-g`**: Faster than Python API (returns just the URL, ~1-2s).
- **Shared `_url_cache`** (5h TTL): Prevents redundant lookups across Invidious and yt-dlp.
- **Chat ACK-based delivery**: Retry queue with 2s backoff + 10s timeout, dedup by message ID.
- **Loading overlay hides at 3s**: Users see the page immediately even if data hasn't loaded yet (thin top bar shows progress).
- **Asynchronous CDN scripts**: Socket.IO and GSAP load non-blocking so the overlay's 3s timeout always fires.
