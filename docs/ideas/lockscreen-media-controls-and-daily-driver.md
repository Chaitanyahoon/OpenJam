# OpenJam Daily Driver: Lock Screen Controls, Sleep Timer & Zero-Gap Buffering

## Problem Statement
How might we transform OpenJam into an uninterrupted daily driver music player for solo listeners so music plays reliably in their pocket with system lock-screen controls, smooth sleep timers, and instant zero-gap transitions between songs?

## Recommended Direction
Focus OpenJam on the everyday solo listener who wants a fast, clean, ad-free alternative to mainstream streaming apps. 

While OpenJam now possesses an in-app Spotify phone player layout, touch queue reordering, and an offline vault, its daily usability is bottlenecked when the user leaves the app: locking the screen hides all transport controls, switching between songs suffers buffering delays over mobile networks, and listening at bedtime requires manual intervention to avoid playing all night.

We will deliver three high-impact daily driver capabilities:
1. **System Notification & Lock Screen Media Controls**: A persistent Android media notification featuring cover artwork, song metadata, and interactive transport buttons (`[⏮ Prev]`, `[▶/⏸ Play/Pause]`, `[⏭ Skip]`) that function even when the device is locked.
2. **Bedtime Sleep Timer**: A dedicated sleep timer accessible directly from the player's bottom utility deck with presets (15m, 30m, 45m, 60m, or "End of Current Song") that gently fades out the volume before halting playback.
3. **Smart Next-Track Pre-buffering**: While playing track $N$, automatically pre-warm and cache track $N+1$ in the background so track transitions are instantaneous and immune to sudden elevator/subway network drops.

## Key Assumptions to Validate
- [ ] **Lock Screen Action Response**: Android notification buttons (`expo-notifications` / action listeners) reliably execute `togglePlay()` and `skipNext()` in `PlayerContext` and `RoomContext` while the app process is backgrounded or screen is locked.
- [ ] **Dual Audio Driver Persistence**: Background audio sessions remain active and are not silently killed by Android OS battery optimization during long listening sessions (both native audio and headless YouTube bridge).
- [ ] **Background Pre-cache Overhead**: Pre-buffering the next queued track in the background does not degrade the active audio playback stream on mobile data.

## MVP Scope
### What's In:
1. **Persistent Media Notification**:
   - System notification with track title, artist, and high-res cover art.
   - Synchronized playback state (displays `Pause` icon when playing, `Play` icon when paused).
   - Actionable buttons: `Previous`, `Play/Pause`, and `Next Track`.
   - Tapping the notification body restores the active player view (`/room/solo` or `/room/[id]`).
2. **Bedtime Sleep Timer**:
   - Integrated into the Spotify bottom utility deck (next to lyrics and audio route pills).
   - Bottom sheet picker with 15m, 30m, 45m, 60m, and "End of track" options.
   - Active countdown badge showing remaining time.
   - 5-second gentle volume ramp-down before stopping playback and releasing audio focus.
3. **Queue Pre-Buffering**:
   - When 70% of the current track has played, initiate stream URL resolution and preliminary audio caching for the next queued track.
   - Ensures instantaneous transition when track finishes.

## Not Doing (and Why)
- **Lock Screen Scrubber Slider**: Native Android seekbars require custom Kotlin `MediaSessionService` native code, which would force ejecting from Expo managed workflow and introduce build fragility.
- **Home Screen Android App Widgets**: Requires writing native Android XML layouts and separate `AppWidgetProvider` architecture; adds high maintenance overhead for marginal gain compared to notification controls.
- **10-Band Graphic Equalizer**: Audio DSP filters on React Native / WebViews cause high CPU drain, battery heat, and stream latency on mobile devices.
- **Complex Social Feeds**: Keeping the app uncluttered and focused purely on zero-friction music playback rather than social bloat.

## Open Questions
- Should the notification dismiss automatically when the user pauses playback, or remain pinned until explicitly swiped away or closed?
- Should the sleep timer have an option to also dim the screen or turn on Do Not Disturb? (Recommendation: Keep strictly scoped to audio playback to avoid requiring elevated Android permissions).
