# OpenJam: Viral Growth, Cold-Start & Zero-Friction Sync

## Problem Statement

How might we make OpenJam so immediately captivating on cold-start that a pair of friends or a long-distance couple can start listening together in under 5 seconds, and naturally turn their intimate listening session into a viral social hook?

---

## Recommended Direction

We combine **Zero-Cold-Start Community Radio** with **Frictionless Duo Onboarding** and an **Instagram Story Sticker Export Engine**:

1. **The 24/7 Official Chill Lounge (`openjam-lounge`):**
   - OpenJam never shows an empty, abandoned homepage ("No active rooms right now").
   - An official community station (`☕ 24/7 Lofi & Chill Lounge`), hosted by system user `openjam-bot`, is permanently active and pinned at the top of the rooms feed.
   - When the queue runs empty, the backend automatically seeds the next track from curated lofi discovery tracks and maintains the NTP playback sync loop, guaranteeing 24/7 continuous music with zero dead air.
   - Visitors can click **"🎧 Tune In (Live Lounge)"** to immediately experience synchronized playback in <100ms without room creation or signup.

2. **1-Click Duo Jam & Zero-Gated Room Entry:**
   - A single-click hero action **"⚡ Start Duo Jam"** creates a private 2-person room, auto-assigns fun guest monikers (*"CosmicJammer482"*), writes a pre-formatted invite text to clipboard (`🎧 Listen with me in real-time on OpenJam: https://www.openjam.fun/room/xyz`), and routes directly into the room.
   - When the friend/partner opens the link, **no blocking nickname prompt modal appears**. OpenJam auto-joins them as a guest in the background, registers their socket session, and connects immediately.
   - Guests can change their nickname at any time by tapping their moniker in the top navbar, which emits real-time updates to all room peers without breaking playback.

3. **Instagram Story Native Sharing:**
   - In `JamCardModal.js`, 9:16 Instagram Story mode displays a visual DOM overlay: **"🔗 Paste Story Link Sticker Here"** (without rasterizing dashed lines onto the exported card artwork).
   - A 1-tap **"Share to Instagram / Stories"** action uses the Web Share API on mobile with the pristine PNG image blob and automatically copies the room invite link to clipboard, guiding the user to paste it into Instagram's native Link Sticker.

---

## Key Assumptions to Validate

- [ ] **Mobile Browser Autoplay Compliance:** Mobile Safari and Chrome require user activation before starting Web Audio or unmuting iframes. Validate that our single-tap audio unlock triggers cleanly when entering a room.
- [ ] **Viral Tap-Through Conversion:** Validate whether users clicking Instagram Story Link Stickers or WhatsApp invitations convert into active room listeners at a higher rate when the nickname modal gate is removed.
- [ ] **Background Lounge Resource Footprint:** Validate that the persistent `openjam-lounge` playback sync loop maintains minimal CPU/Redis memory usage when idle with 0 listeners.

---

## MVP Scope

### In Scope (Shipped)
- **Backend 24/7 Lounge Architecture:**
  - `backend/constants.py` defining `LOUNGE_ROOM_ID`, `SYSTEM_BOT_USER_ID`, and `LOUNGE_DISCOVERY_TRACKS`.
  - Seeding of `openjam-bot` user and `openjam-lounge` room in database upon application startup.
  - Exemption of `openjam-lounge` from `_room_cleanup_loop()`, `_close_room_after_delay()`, and `list_rooms()` 0-listener pruning.
  - 999 listener capacity exemption for `openjam-lounge`.
  - Auto-replenishment of discovery tracks when queue ends in `_do_advance()`.
  - Host protection preventing `openjam-lounge` ownership reassignment on guest departure.
- **Frontend Cold-Start Experience:**
  - Dynamic 24/7 Lounge & 1-Click Duo Jam card replacing the empty state in `HomeClient.js`.
  - Special `☕ 24/7 Lounge` badge styling in `RoomCard.js`.
  - `handleStartDuoJam()` 1-click room creation with automatic guest auth, clipboard invite formatting, and redirect.
- **Frictionless Join:**
  - Bypassed blocking nickname modal in `RoomClient.js` for new visitors, auto-joining as guest and connecting socket cleanly.
  - Interactive navbar guest profile trigger allowing on-the-fly nickname edits via live socket emission (`set_guest_name`).
- **Viral Sharing Card:**
  - Dynamic `inviteUrl` resolution using `window.location.origin`.
  - Story sticker placement preview guideline in `JamCardModal.js`.
  - Enhanced Web Share API file attachment and automatic invite link clipboard copy.

---

## Not Doing (and Why)

- **Not building a full social network / user feed:** OpenJam is a synchronous listening utility. Building follower feeds, comments, or algorithmic recommendations distracts from the core 0-latency sync superpower.
- **Not forcing account registration for room creation:** Forcing sign-in would destroy the zero-friction advantage over Spotify and Apple Music. Anonymous sessions with Discord optional login is our key growth lever.
- **Not rasterizing sticker guidelines into canvas pixels:** Bakes unsightly dashed boxes into the image when shared on WhatsApp, Discord, or Twitter. Kept strictly as a DOM preview overlay.
- **Not building multi-channel voice chat inside rooms:** Voice chat requires complex WebRTC peer-to-peer or SFU infrastructure and increases mobile battery drain. Users already use Discord or FaceTime alongside OpenJam.

---

## Open Questions

1. **Curated Lounge Playlists:** Should we provide multiple themed 24/7 community lounges (e.g. *Synthwave Nightdrive*, *Lofi Study Beats*, *Indie Coffeehouse*) once daily active users scale past 1,000?
2. **Couples "Touch-to-Glow":** Should we add real-time haptic touch ripples (tapping album art pulses a glowing heart on partner's phone screen) as the next intimacy feature for Duo rooms?
