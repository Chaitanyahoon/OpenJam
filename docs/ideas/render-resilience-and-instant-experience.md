# Render Free-Tier Resilience & Instant Mobile Experience

## Problem Statement
How Might We deliver an instantaneous, 0-latency Spotify-tier mobile listening and discovery experience while running against a free Render cloud backend that spins down after 15 minutes of inactivity and takes 20–40 seconds to cold-boot?

---

## Recommended Direction
We employ a **Zero-Wait Stale-While-Revalidate (SWR) & Hybrid Vault Architecture**:
1. **0ms Initial Paint (Optimistic Cache)**:
   - On launch, the mobile app instantly hydrates the Home feed (`rooms`), user profile (`me`), and favorite rooms from persistent local cache in `<50ms`.
   - The UI paints immediately with zero blocking spinner.
   - If the cloud backend is currently dormant or waking up, a discreet, non-intrusive amber pill ("Syncing with Jam Cloud...") appears at the top rather than freezing the screen.
2. **Network Resilience & AbortController Guard**:
   - Wrap all REST queries in a strict 12-second `AbortController` timeout to prevent dangling connection states on Android mobile sockets.
   - On timeout or 502/503 cold-start errors, smoothly fall back to cached room snapshots rather than wiping the screen into an empty error state.
3. **Hybrid Instant Search Engine**:
   - Searching tracks queries the local sandboxed **Audio Vault** and **Recently Played History** synchronously (0ms), displaying instant downloadable / offline results right away.
   - Concurrently dispatches the remote query to `/search/tracks`. When the cloud responds, it merges and deduplicates results without UI layout jumps.
4. **Smart Foreground Heartbeat**:
   - While the app is actively in the foreground or streaming music in an active room session, a lightweight background pulse hits `/ping` every 10 minutes.
   - When the app is minimized or backgrounded (and not playing), the timer stops to preserve battery and respect Android power management.

---

## Key Assumptions to Validate
- [ ] **Assumption 1**: Rendering cached rooms immediately will not cause stale room join errors if a room was closed while the user was away.
  *Validation*: When joining a room from the cached feed, if the backend returns 404 or socket disconnects with "room not found", display a friendly toast and refresh the room list.
- [ ] **Assumption 2**: A 10-minute foreground keepalive ping is lightweight enough to avoid draining mobile battery.
  *Validation*: Test with Android AppState listener; ensure keepalive only triggers when `AppState.currentState === 'active'`.
- [ ] **Assumption 3**: Fast local vault and history search provides instant gratification before remote YouTube/Invidious results arrive.
  *Validation*: Verify search displays cached results instantly (<10ms) and seamlessly appends cloud results.

---

## MVP Scope
- **In Scope**:
  1. `mobile/src/api.ts`: Add `AbortController` timeout (12s) to `request()`.
  2. `mobile/src/api.ts`: Add `getCachedRooms()` and persist rooms to AsyncStorage on every successful `/rooms` fetch.
  3. `mobile/src/api.ts`: Add `searchHybridTracks(query)` that queries local Vault + Recent history and merges with remote `/search/tracks`.
  4. `mobile/src/app/index.tsx`: Hydrate rooms and user state immediately from local cache so `setReady(true)` executes in 0ms; display subtle "Syncing with cloud..." indicator only during cold wake.
  5. `mobile/src/utils/heartbeat.ts`: Lightweight AppState-aware 10-minute foreground keepalive pinging `/ping`.
  6. Unit tests verifying timeout handling, SWR cache retrieval, and hybrid search deduplication.
- **Out of Scope (Not Doing Now)**:
  - Complex CRDT offline conflict resolution (unnecessary for a room-based streaming app).
  - P2P WebRTC audio relay without server (excessive complexity and battery drain).
  - Paying for dedicated cloud compute before user traction warrants it.

---

## Not Doing (and Why)
- **Full-Screen Blocking Cold-Start Splash**:
  *Why*: Blocking the user with a 30-second progress bar feels broken and amateurish. Showing cached rooms and offline vault tracks immediately lets users browse and listen right away.
- **Aggressive 1-Minute Background Wake-Locks**:
  *Why*: Violates Android background execution policies and drains user battery. Render's 15-minute idle threshold only needs a 10-minute foreground ping.
- **Client-Side YouTube Scraper**:
  *Why*: Keeps API keys and scraping logic off the client device, preserving battery and preventing client binary ban issues.

---

## Open Questions
- None blocking implementation. Everything can be cleanly integrated in the existing mobile architecture.
