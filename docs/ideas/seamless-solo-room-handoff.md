# Seamless Solo ⇋ Room Audio Handoff

## Problem Statement
How might we turn OpenJam into the world's most fluid listening app, where listening to music alone and jamming in a synchronized room with friends is a single continuous audio stream with zero friction, zero lost state, and zero abrupt silence?

---

## Recommended Direction

OpenJam's greatest superpower compared to traditional music apps (like Spotify or Apple Music) is real-time social listening without mandatory subscription paywalls. However, currently Solo Jam and Collaborative Live Rooms function as isolated silos:
1. When a user enjoys a song or playlist in Solo Jam and wants friends to listen along, they must leave playback, create a blank room, re-search for the song, and rebuild the queue.
2. When a user leaves a live room, playback is abruptly killed and they are deposited on the home screen in complete silence.

We will bridge these two pillars with an **unbroken bi-directional state bridge**:
- **Solo ➔ Room (1-Tap "Start Live Jam")**:
  - In `SpotifyPlayerModal` and `DevicePickerModal`, a prominent `"Start Live Jam with Friends"` action immediately provisions a live collaborative room.
  - The room is seeded with the active solo track, queue, and current playback position.
  - The host is seamlessly routed into `/room/[id]/player`, and the room share link is automatically copied to the clipboard with an instant toast notification.
- **Room ➔ Solo (Unbroken "Keep Listening Solo" Exit)**:
  - In `LeaveModal`, leaving a room offers two distinct choices:
    1. **"Continue Listening Solo"** (Primary): Automatically transfers the room's current track and position into `PlayerContext`, cleanly disconnecting from the socket while keeping local audio playback uninterrupted.
    2. **"Leave & Pause"**: Exits the room and pauses playback.
- **Session Preservation on Room Join**:
  - Joining a live room while listening solo archives the active solo queue to "Recently Played" and cleanly transitions audio to the synchronized room stream.

---

## Key Assumptions to Validate

- [ ] **State Transfer Latency**: Transferring the current playback track from `RoomContext` into `PlayerContext` happens in `< 50ms` so local audio does not buffer or glitch upon socket disconnect.
- [ ] **Queue Seeding**: The host can seed the room queue with their existing solo tracks immediately after socket connection via client-to-server `room:queue:add` events.
- [ ] **Guest Simplicity**: Guest users (without a Discord account) can also trigger "Start Live Jam" with their guest display name and receive an invite link instantly.

---

## MVP Scope

### In Scope
1. **`SpotifyPlayerModal.tsx` & `DevicePickerModal.tsx`**:
   - Selecting "Collaborative Jam Room" or tapping "Start Live Jam" creates a room, seeds the active song, copies the invite URL, and transitions to `/room/[id]/player`.
2. **`LeaveModal.tsx` & `mobile/src/app/room/[id]/_layout.tsx`**:
   - Upgraded modal with a vibrant "Continue Listening Solo" action and "Leave & Pause" option.
   - Smoothly transfers `nowPlaying` track and position into `usePlayer().playTrack(nowPlaying, remainingQueue, { initialPositionMs })`.
3. **Automated Unit Tests**:
   - Test suite covering state transition payloads, position preservation, and queue mapping between solo and room engines.

### Out of Scope (Not Doing Now)
- **Room Merging**: Merging two active live rooms together (unnecessary complexity for MVP).
- **Voice Chat in Rooms**: Audio streaming will remain focused on synchronized music; Discord voice or external calls handle voice chat.
- **Complex Room Permissions Migration**: Solo queues will seed directly into the room's regular queue using standard room permissions.

---

## Open Questions & Considerations
- *Queue Depth*: When converting a solo session into a room, should we seed the first 5 upcoming queue items, or the entire queue? *(Recommendation: Seed up to 10 upcoming tracks so the party doesn't run dry)*.
- *Playback Position on Leave*: Should leaving a room continue at the exact elapsed millisecond? *(Recommendation: Yes, resume at the exact second for seamless continuation)*.
