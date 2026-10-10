# Implementation Plan: Playlist Track Reliability, Instant 1-Tap Playback, & Performance

## User Feedback Context
1. "Why it shows 0 tracks i added my playlist it has multiple songs":
   - External playlist import occasionally failed or returned 0 tracks because Spotify embed parser didn't fall back to Tier 2 if the status was 200 with an unparsed layout, and slow iTunes enrichment caused timeouts.
   - Creating an offline playlist created an empty shell with no UI path to add songs.
   - Property naming mismatch (`uri`/`name` vs `track_uri`/`track_name`) caused loaded tracks to have undefined names.
2. "also from there I can just click and play music allow that right":
   - In `playlist/[id].tsx`, only the tiny 40x40 thumbnail box was pressable (`<Pressable style={styles.trackThumbWrap}>`). Tapping the song title, artist, or track row did nothing.
   - Users expect to tap anywhere on a song card to immediately start playback, open the player, and set the playlist as queue.
3. "everything is working so slow right now fix that":
   - `calculateStorageUsageKb` was reading all AsyncStorage keys on every profile load and mutation.
   - Remote profile and social API calls were blocking local offline playlist and history rendering.
   - Artwork enrichment in playlist importer made sequential iTunes requests that took 10-15s.

---

## Architectural Changes

### 1. Backend Playlist Importer Speed & Reliability (`backend/services/playlist_importer.py`)
- Change Tier 2 trigger condition from `if not tracks and embed_had_404:` to `if not tracks:`, so Tier 2 anonymous Web API fallback ALWAYS executes if Tier 1 parses 0 tracks.
- Cap `_enrich_missing_artwork` to 1.0s timeout per item with a strict maximum of 5 concurrent items, never blocking the main response.
- Ensure YouTube playlist parser extracts proper `duration_ms` when available, defaulting safely to 210,000ms if absent.

### 2. Client-Side API & Timeout Hardening (`mobile/src/api.ts`)
- Give `importExternalPlaylist` a dedicated 30,000ms abort timeout so large playlists don't trigger premature client network timeouts.
- Ensure all returned tracks have both standard OpenJam properties (`track_uri`, `track_name`) and alias properties (`uri`, `name`).

### 3. Local Storage Playlist Normalization & Bulk Operations (`mobile/src/storage/history.ts`)
- Implement `normalizeTrack(t: any): TrackInfo` ensuring all stored and retrieved tracks have valid `track_uri`, `track_name`, `artist`, `album_art_url`, and `duration_ms`.
- Add `addTracksBulkToOfflinePlaylist(playlistId: string, newTracks: TrackInfo[])` for efficient 1-pass updates.
- Update `getOfflinePlaylists()` to normalize loaded tracks on read.

### 4. Interactive Playlist Detail Screen (`mobile/src/app/playlist/[id].tsx`)
- Make the entire `trackRow` a full `<Pressable>` with instant tap-to-play:
  - Tapping any track immediately starts playing via `player.playTrack(item, tracks, { sourceTitle: title })` and opens `SpotifyPlayerModal`.
  - Active visual styling for currently playing track with amber accent and animated playing indicator.
- Empty State Overhaul:
  - When 0 tracks are present, show two prominent action buttons:
    1. "+ Add Songs" (opens live song search & picker modal)
    2. "Import Playlist" (opens URL import sheet directly into this playlist)
- Add "+ Add Songs" header action button to allow appending songs to existing playlists anytime.
- Add "Add Songs" bottom sheet modal:
  - Search any song/artist with debounced autocomplete.
  - Tab for "Liked Songs" and "Recently Played" with 1-tap "+" to append to playlist.

### 5. Instant Profile & Storage Performance (`ProfileModal.tsx` & `profile/[id].tsx`)
- Decouple local storage loading from network queries: render offline playlists, recent history, and favorite stations instantly without waiting for network responses.
- Move `calculateStorageUsageKb` off the critical mount path (run lazily or only when Settings tab is active).

---

## Validation Plan
1. Unit tests in `mobile/test/playlist_import_and_playback.test.ts`:
   - Normalization of legacy and external track objects.
   - Bulk appending tracks to offline playlists.
   - Tap-to-play queue generation and active track matching.
2. Full test runner: `npm test` (all tests passing).
3. TypeScript compiler: `npx tsc --noEmit` exits with code 0.
4. Git commit & push clean changes to `main`.
