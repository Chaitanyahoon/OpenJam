# Spotify-Grade Unified Online/Offline Architecture

## Problem Statement
How might OpenJam deliver a seamless Spotify-grade mobile experience where online and offline modes coexist harmoniously on a single unified canvas without disruptive screen redirection, broken user flow, or fragmented interfaces?

---

## Recommended Direction: The Single-Canvas Model

### 1. Zero Route Redirection
- **Current Issue**: When Wi-Fi disconnects, the app violently performs `router.replace('/offline')`, tearing down the user's view, cancelling what they were reading or queues they were inspecting.
- **The Spotify Way**: The user never leaves their screen. The app remains on Home (`/`), Library, or Player.
- **Floating Network Pill**:
  - When offline: A subtle frosted capsule appears beneath the top header:
    `[ ⚡ Offline Mode • Playing Saved Vault Music ]`
  - When reconnecting: The capsule transitions to emerald green:
    `[ ✓ Back Online • Live Rooms Synced ]` and auto-dismisses after 2.5 seconds.

### 2. Adaptive Home Feed
- **Top Filter Chips**:
  - `All` | `Music` | `Live Rooms` | `Downloaded` (Spotify's exact filter chip).
  - Tapping `Downloaded` instantly filters all shelves to show only 100% offline-ready music.
- **Dynamic Live Feed when Offline**:
  - **Online**: Shows active synchronized Live Rooms with listener counts and DJ badges.
  - **Offline**: Replaces the Live Rooms section with a rich **"Offline Music Vault"** section featuring:
    - Storage usage gauge (e.g. `48.2 MB / 1.0 GB`)
    - Downloaded tracks with 1-tap playback and shuffle
    - Batch "Download Liked Songs" status
  - **Reconnection**: When internet returns, the Live Rooms feed silently re-renders in the background without refreshing or jarring the viewport.

### 3. Persistent 5-Tab Navigation & Floating MiniPlayer
- **Bottom Navigation**: `Home` • `Search` • `Solo Jam` • `Vault` • `Profile`.
- **Floating MiniPlayer**: Docked cleanly 12dp above the bottom navigation bar.
  - 0ms local file playback (`file://` caching in SQLite / FileSystem).
  - Full playback controls, output selector, like toggle, and micro progress bar.

---

## Key Assumptions to Validate
- [ ] Users prefer remaining on Home with an adaptive feed over being forced to a separate `/offline` screen.
- [ ] Local file playback with `expo-audio` remains 100% stable in the background without active network sockets.
- [ ] Swapping Live Rooms for the Offline Vault section while offline provides immediate utility without confusing users.

---

## MVP Scope

### In Scope
1. **NetworkGuard Refactor**: Remove route navigation from `NetworkGuard.tsx`. Emit reactive `isOnline` state to UI components.
2. **Floating Status Banner**: Add non-blocking offline/online badge in `mobile/src/app/index.tsx`.
3. **Adaptive Section Rendering**: In `index.tsx`, when offline, seamlessly render the Offline Vault shelf in place of the Live Rooms feed.
4. **Downloaded Filter Chip**: Add `Downloaded` to the top filter chips row.
5. **Zero-Latency Audio Driver**: Seamless fallback to local `file://` URIs whenever playing offline.

### Out of Scope (Not Doing Now)
- Multi-user peer-to-peer Wi-Fi Direct sync without internet (requires custom mesh protocols; solo offline playback meets 99% of use cases).
- Automatic high-res album art downloading when on cellular data (keep downloads lightweight to save user bandwidth).

---

## Architectural Comparison

| Dimension | Previous Approach | Spotify Unified Model |
| :--- | :--- | :--- |
| **Network Loss** | Hard route redirect to `/offline` | Zero navigation; subtle offline pill displayed |
| **Screen Context** | User loses their place in the app | User keeps exact scroll position and queue |
| **Live Rooms View** | Screen vanishes | Replaced smoothly with Offline Vault shelf |
| **Reconnection** | Hard redirect back to `/` | Pill turns green and disappears; feed syncs silently |
| **Music Library** | Hidden inside separate route | Available on Home via `Downloaded` chip & `Vault` tab |
