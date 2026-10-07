# Product One-Pager: Offline Audio Downloads & Dual-Mode Playback

> **Status:** Refined via `/idea-refine`  
> **Target:** OpenJam Mobile App (iOS & Android)  
> **Domain:** Native Audio Storage, Offline Playlists & Dual-Mode Social Sync  

---

## 1. Problem Statement

OpenJam is currently a network-bound real-time social listening platform. The moment a user steps onto a subway, boards a flight, enters poor cellular reception, or loses Wi-Fi, the app ceases functioning:
1. Audio cuts out immediately because streams depend on real-time WebSockets and live YouTube IFrame streaming.
2. Saved rooms, favorite tracks, and curated playlists are trapped behind online-only playback drivers.
3. Users love tracks discovered during live room sessions with friends, but have no way to take those discoveries on the go for personal offline listening.

**How Might We:** Transform OpenJam from a network-tethered streaming tool into a resilient, dual-mode audio player—enabling users to download liked tracks, curate offline playlists, and enjoy background-cached music offline, with seamless 1-tap re-broadcasting back to live rooms when they reconnect?

---

## 2. Recommended Direction: The "Dual-Mode Audio Pocket"

A hybrid offline architecture combining **explicit user downloads** (Liked Songs & custom playlists) with **smart background caching** (recent live jam tracks), powered by sandboxed device storage and native `expo-audio` playback.

### Core Pillars

1. **Sandboxed Audio Vault (`expo-file-system`)**
   - Downloaded MP3/M4A streams are saved in the app's sandboxed `documentDirectory/openjam_audio/`.
   - Audio metadata and file index persist in `AsyncStorage` (`openjam_offline_vault_v1`), linking `track_uri` to local `file://` URIs.
   - Storage budgeting: Default 1GB cap with automatic LRU (least-recently-played) eviction for background-cached tracks (explicit downloads are never evicted without user action).

2. **Dual-Mode Audio Driver**
   - **Online Mode:** Live Socket.IO synchronization via dual engine (YouTube IFrame Bridge + Expo Audio stream).
   - **Offline Mode:** Seamless fallback to `expo-audio` native player consuming local file paths.
   - Status bar indicator: Sleek ambient pill: `● Offline Mode • 142 Tracks Ready`.

3. **Bridge from Solo to Social ("Broadcast to Live Room")**
   - When offline, users can curate, reorder, and listen to their downloaded playlists.
   - When network connectivity returns, a prominent 1-tap action: **"Start Room with this Playlist"** spins up a new live room and queues the offline tracklist for friends.

---

## 3. Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Online Discovery
        A["Live Room Stream"] -->|Auto-Cache Last 20 Tracks| B["Background Cache Vault"]
        C["Heart / Liked Tracks"] -->|1-Tap Download| D["Explicit Download Vault"]
        E["Custom Playlist"] -->|Download All Button| D
    end

    subgraph Sandboxed Storage
        B --> F["expo-file-system: /openjam_audio/"]
        D --> F
        F --> G["Vault Registry (AsyncStorage)"]
    end

    subgraph Audio Player Context
        G -->|Network Present| H["Dual-Engine (Live Sync)"]
        G -->|Network Disconnected| I["expo-audio (Local File Player)"]
    end

    subgraph Reconnection Flow
        I -->|Reconnected| J["1-Tap: Broadcast to Live Jam"]
        J --> A
```

---

## 4. Key Assumptions & Stress Testing

| Dimension | Assumption | Risk / Failure Mode | Mitigation |
| :--- | :--- | :--- | :--- |
| **User Value** | Users want to take OpenJam discoveries offline rather than switching to Spotify. | High: If downloading is tedious or audio quality is low, users will just use their primary streaming app. | 1-tap "Download Liked Songs" with batch progress bar; zero-friction auto-caching. |
| **Technical Feasibility** | YouTube streams cannot always be directly saved to local disk on mobile without backend proxying. | High: Direct YouTube streams have expiring signed URLs and bot protections. | Backend provides an authenticated `/api/audio/download?uri=...` endpoint that streams audio directly into `expo-file-system.downloadAsync()`. |
| **Storage & Battery** | Large audio files will consume device storage and drain battery during background downloads. | Medium: Uncapped storage causes Android low-disk warnings. | Storage cap selector (500MB / 1GB / 2GB) with LRU eviction and Wi-Fi-only download toggle. |
| **Differentiation** | What makes this better than standard offline music apps? | Medium: Generic offline players lack social context. | Mixtape provenance: Each track retains the room name, DJ nickname, and timestamp where it was first discovered. |

---

## 5. MVP Scope (Phase 1)

### What We Are Building:
1. **Vault Storage Engine (`mobile/src/storage/vault.ts`):**
   - File download manager utilizing `expo-file-system.downloadAsync`.
   - Track verification (checksum / byte size check).
   - LRU cache pruning logic.
2. **Offline UI & Playlist Screen (`mobile/src/app/offline/index.tsx` or `ProfileModal` tab):**
   - "Downloaded" tab with total tracks, storage footprint (e.g. `248 MB / 1.0 GB`), and storage progress bar.
   - "Download Liked Songs" batch toggle with progress ring.
   - Individual track download status icon (`✓ Downloaded`, `↓ Downloading`, `Cloud`).
3. **Offline Audio Player Mode:**
   - Detect offline network status using `@react-native-community/netinfo` or fetch failure fallback.
   - Route `PlayerContext.loadTrack` directly to local `file://` URI.
   - Full scrubber, playback controls, and lock-screen metadata.
4. **"Broadcast to Room" Action:**
   - Button on offline playlist detail view to create an instant room populated with the downloaded tracks.

---

## 6. What We Are NOT Doing (Explicit Non-Goals)

- ❌ **Exporting raw MP3s to Android/iOS external file managers:** Keeps downloads inside sandboxed storage to respect rights and platform sandboxing.
- ❌ **Local P2P Wi-Fi Direct Mesh Jamming in v1:** Complex mesh networking (multicast DNS / WebRTC without signaling server) is deferred to a future exploration.
- ❌ **Lossless FLAC storage:** Capped at 192kbps / 320kbps MP3/AAC to preserve mobile storage and download speed.
- ❌ **Offline Chat:** Chat remains real-time; offline mode focuses exclusively on audio playback and playlist staging.

---

## 7. Verification & Acceptance Criteria

1. **Storage Verification:** Download 5 tracks -> verify files exist in `FileSystem.documentDirectory + 'openjam_audio/'` with non-zero byte size.
2. **Airplane Mode Test:** Enable Android Airplane mode -> open app -> navigate to Downloaded tab -> hit Play -> audio plays seamlessly through `expo-audio` with lock-screen controls.
3. **Storage Budgeting:** Set 100MB limit -> add 150MB of tracks -> verify LRU cache deletes oldest unpinned tracks until total is ≤ 100MB.
4. **Unit Tests:** Add test suite in `mobile/test/vault_storage.test.ts` covering download status mapping, storage calculation, and eviction logic.
