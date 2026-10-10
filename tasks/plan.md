# Implementation Plan: Pure Solo Direct Listener Experience

## Overview
Decouple OpenJam Solo Jam from Collaborative Room creation. Strip all forced "Live Jam" / room prompts out of the Solo Player and Device Picker. Turn Solo Listening into a pure, Spotify-grade personal listening experience with smart resume/launch, full queue sovereignty (clear upcoming queue, add songs without stopping playback), dedicated physical device switching (Phone Speaker, Bluetooth Audio, Wired Headphones), and rock-solid background performance.

---

## Architecture Decisions

1. **Smart Resume vs Search on Home Screen (`app/index.tsx`)**:
   - Tapping "Solo Jam" on the Home HeroHeader inspects `player.currentTrack`.
   - If a track is already active or paused, immediately expands `SpotifyPlayerModal`.
   - If the player is empty, opens `SoloSearchModal` to pick a track.
   - Eliminates the frustration of being forced into search when a user simply wants to return to their playing music.

2. **Queue Sovereignty (`PlayerContext.tsx` & `SpotifyPlayerModal.tsx`)**:
   - Add `clearUpcomingQueue(): void` to `PlayerControls`.
   - Safely preserves `currentIndex` and tracks up to `currentIndex`, clearing only `queue.slice(currentIndex + 1)`.
   - Add a 1-tap "Clear Queue" button (`Trash2`) in Up Next header.
   - Add an "Add Songs" button (`Plus`) in Up Next header that opens `SoloSearchModal` in non-disruptive queuing mode (tapping a song or "+" appends to queue without cutting off current playback).
   - Remove `startJamPill` ("Live Jam") from Up Next queue header per user request.

3. **Physical Audio Device Route Focus (`DevicePickerModal.tsx`)**:
   - Strip out `room` ("Collaborative Jam Room") from `DevicePickerModal`.
   - Focus exclusively on hardware targets:
     - Phone Speaker (built-in speaker)
     - Bluetooth Audio (with 1-tap shortcut to Android Bluetooth settings or iOS system settings)
     - Wired Headphones / AUX (3.5mm / USB-C DAC)
   - Update `AudioDeviceRoute` type in `PlayerContext.tsx` to `'speaker' | 'bluetooth' | 'wired'`.

4. **Preserve Collaborative Room Creation Integrity**:
   - Room creation remains fully accessible from the Home screen via "Create Live Room" modal and genre feeds.
   - Room exit via `LeaveModal` maintains the choice to "Keep Listening Solo" or "Leave & Pause".

---

## Task List

### Phase 1: Engine & Audio Foundation
- [ ] **Task 1: Add `clearUpcomingQueue` to `PlayerContext.tsx`**
  - Implement `clearUpcomingQueue()` in `PlayerProvider`.
  - Update `PlayerControls` interface.
  - Add test in `test/solo_listener_sovereignty.test.ts`.

- [ ] **Task 2: Refine Audio Device Routes**
  - Update `AudioDeviceRoute` in `PlayerContext.tsx` to `'speaker' | 'bluetooth' | 'wired'`.
  - Remove `room` option from `DevicePickerModal.tsx`.
  - Ensure persisted route in `@openjam_audio_route` defaults to `'speaker'`.

### Checkpoint: Foundation
- [ ] `npx tsc --noEmit` exits with 0 errors.
- [ ] Tests in `test/` pass without regression.

### Phase 2: UI & Queue Sovereignty
- [ ] **Task 3: Clean Up Up Next Queue Header in `SpotifyPlayerModal.tsx`**
  - Remove `startJamPill` ("Live Jam").
  - Add `Clear Queue` button with confirmation / instant toast.
  - Add `Add Songs` button that opens `SoloSearchModal`.
  - Ensure Up Next count and empty states render cleanly.

- [ ] **Task 4: Implement Smart Solo Jam Entry on Home Screen (`app/index.tsx`)**
  - Update `handleStartSoloJam` to check `currentTrack`.
  - If `currentTrack` exists, expand `SpotifyPlayerModal`.
  - If no track, open `SoloSearchModal`.

- [ ] **Task 5: Non-Disruptive Queuing in `SoloSearchModal.tsx`**
  - When opened from `SpotifyPlayerModal`'s "Add Songs", ensure tapping "+" or tapping a song appends to queue with toast confirmation and keeps the current song playing.

### Checkpoint: Core Experience
- [ ] Solo listening flow tested end-to-end.
- [ ] No room prompts inside Solo Player or Device Picker.
- [ ] All unit test suites pass (100% pass rate).

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Clearing queue causes index out of bounds | High | Explicitly guard `currentIndex` against new queue bounds. `queue.slice(0, currentIndex + 1)` preserves the current track index at `currentIndex`. |
| Legacy test expecting `'room'` audio route fails | Medium | Update any tests in `test/` that tested the legacy `'room'` route string. |
| User closes search modal without picking song | Low | Player continues playing current track uninterrupted. |
