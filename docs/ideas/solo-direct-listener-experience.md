# Solo Direct Listener: Pure, Powerful Personal Music Experience

## Problem Statement
How might we transform OpenJam's Solo Listener into a pure, first-class personal audio experience—free of forced collaborative room distractions—with instant resumption, total queue mastery, and seamless library integration?

---

## Strategic Shift: Pure Solo vs Collaborative Rooms

### What Was Wrong
In previous iterations, we forced room creation into the solo listening player (e.g. "Live Jam" pills in the queue header and room options in the device picker). As the user noted:
> *"no need of connecting it directly right to create a jam the user can go back and create a room right"*

Solo listening and Collaborative Rooms serve two distinct mental states:
- **Solo Mode**: Deep personal focus, private study, gym, chill sessions, offline vault listening. The user wants fast playback, queue control, lyrics, and pure audio device routing without being nudged into creating rooms.
- **Collaborative Rooms**: Social party, DJing with friends, group listening. This belongs on the Home screen via "Create Live Room" and "Live Rooms Feed".

### The Core Pillars of Solo Direct Listening

1. **Instant Resumption & Smart Entry (`app/index.tsx`)**:
   - When the user taps "Solo Jam" on the Home screen:
     - If a song is already loaded/paused in the player, **instantly open the player modal** (`SpotifyPlayerModal`) without forcing search.
     - If no song is loaded, open the fast Solo Discovery modal (`SoloSearchModal`).
   - The Unified MiniPlayer at the bottom provides persistent 1-tap expansion.

2. **Total Queue Sovereignty (`SpotifyPlayerModal.tsx`)**:
   - Remove "Live Jam" pills and room creation prompts from the Solo player.
   - Add **"Clear Queue"** button so users can wipe upcoming tracks with 1 tap.
   - Add **"Add Songs"** button inside the Up Next panel that seamlessly opens the search/picker modal to queue more songs without stopping current playback.
   - Preserve **Auto-Play Radio Toggle**: When ON, plays a single curated track when queue ends; when OFF, stops cleanly.
   - Keep **"Recommended for You"** section with explicit `+` buttons (never auto-injected).

3. **Pure Physical Device Routing (`DevicePickerModal.tsx`)**:
   - Remove "Collaborative Jam Room" from the Solo device picker.
   - Focus 100% on physical audio targets:
     - **Phone Speaker** (Internal speaker)
     - **Bluetooth Audio** (Wireless headphones, car audio, earbuds with direct shortcut to system settings)
     - **Wired Headphones / AUX** (3.5mm jack / USB-C DAC)

4. **In-Player Library & Playlist Action**:
   - Allow saving the currently playing track to custom playlists directly from the player modal with a single tap.

5. **Rock-Solid Lockscreen & Background Performance**:
   - Background audio streaming with seamless lockscreen notifications, media session controls, and zero battery drain or interval churn.

---

## Key Assumptions to Validate

- [ ] **Smart Solo Jam Entry**: Detecting whether `player.currentTrack` exists correctly toggles between opening `SpotifyPlayerModal` vs `SoloSearchModal`.
- [ ] **Queue Sovereignty**: Clearing the queue only removes upcoming tracks (`queue.slice(currentIndex + 1)`), preserving the currently playing track and past history.
- [ ] **Device Route Focus**: Removing the room entry from `DevicePickerModal` simplifies the modal and eliminates user confusion.

---

## MVP Scope

### In Scope
1. **Clean up `SpotifyPlayerModal.tsx`**:
   - Remove `startJamPill` ("Live Jam") from Up Next queue header.
   - Add "Clear Queue" and "Add Songs" buttons in the queue header.
   - Ensure Shuffle and Repeat (Off / All / One) toggle correctly with visual cues.
2. **Clean up `DevicePickerModal.tsx`**:
   - Remove `room` device option in solo mode, keeping exclusively Phone Speaker, Bluetooth Audio, and Wired Headphones.
3. **Smart Solo Jam Button in `app/index.tsx`**:
   - Check `currentTrack`: if present, expand player modal; otherwise open search.
4. **Queue Control Methods in `PlayerContext.tsx`**:
   - Add `clearUpcomingQueue()` method to `PlayerControls`.
5. **Automated Unit Tests**:
   - Unit tests verifying smart solo launcher, queue clearing, queue additions, and device route filtering.

### Not Doing (and Why)
- **Room creation inside solo player**: Explicitly removed per user direction. Users who want to start a room can go to Home and tap "Create Live Room".
- **Social feed in solo mode**: Kept separate in Profile and Home screen.

---

## Open Questions & Considerations
- *Queue persistence*: Should the solo queue persist across app restarts? *(Recommendation: Persist current track and remaining queue in AsyncStorage so users can resume listening after closing the app)*.
