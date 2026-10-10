# Todo List: Playlist Track Reliability, Instant 1-Tap Playback, & Performance

- [x] Fix Spotify & YouTube playlist import parsing in `backend/services/playlist_importer.py` (ensure Tier 2 always runs on empty Tier 1, remove blocking iTunes timeouts) <!-- id: 0 -->
- [x] Increase playlist import network timeout in `mobile/src/api.ts` to 30s <!-- id: 1 -->
- [x] Add robust track normalization and bulk add helper in `mobile/src/storage/history.ts` (`addTracksBulkToOfflinePlaylist`, fallback key mapping) <!-- id: 2 -->
- [x] Fix 0-track display & add complete Track Row 1-tap playback in `mobile/src/app/playlist/[id].tsx` <!-- id: 3 -->
- [x] Add "Add Songs" & "Import Tracks" interactive search/picker sheet inside `mobile/src/app/playlist/[id].tsx` <!-- id: 4 -->
- [x] Add "Add to Playlist" modal/action in `mobile/src/components/SpotifyPlayerModal.tsx` and track menus <!-- id: 5 -->
- [x] Eliminate lag and heavy blocking calls in `mobile/src/app/profile/[id].tsx` and `mobile/src/components/ProfileModal.tsx` <!-- id: 6 -->
- [x] Write comprehensive unit tests in `mobile/test/playlist_import_and_playback.test.ts` <!-- id: 7 -->
- [x] Run full test suite and TypeScript validation (`npm test`, `npx tsc --noEmit`) <!-- id: 8 -->
- [x] Commit and push clean changes to git <!-- id: 9 -->
