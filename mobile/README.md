# OpenJam Mobile (Android)

Private-build React Native + Expo client for [OpenJam](../README.md) — real-time
synchronized social listening. Same FastAPI + Socket.IO backend as the web app,
no backend changes needed. Built for sideloading: an APK you share directly with
friends, no Play Store.

## Quick start

```bash
cd mobile
cp .env.example .env          # set EXPO_PUBLIC_BACKEND_URL to your server
npm install
npx expo start                # scan the QR with Expo Go (dev only)
```

> Audio background playback needs a **development build**, not Expo Go:
> `npx expo run:android` (needs Android Studio) or an EAS dev build.

## Build a shareable APK (EAS cloud — no Android Studio needed)

One-time setup (needs your Expo account):

```bash
npx eas-cli@latest login
npx eas-cli@latest init       # fills in extra.eas.projectId + updates URL
```

Then:

```bash
npx eas-cli@latest build --platform android --profile preview
# or: npm run build:apk
```

You get a download link for a standalone `.apk`. Send the file to your friends —
they tap it to install (enable "install unknown apps" once). The app then runs
fully standalone.

## Ship fixes without resending the APK (EAS Update)

```bash
npx eas-cli@latest update --channel preview      # JS-only changes
# or: npm run update:preview
```

Installed phones pick the update up on next launch. Native config changes still
need a fresh APK build.

## Project structure

```
mobile/
  src/
    app/                 # expo-router screens
      index.tsx          # landing: hero + live room list
      room/[id]/
        _layout.tsx      # bottom tabs (Playing | Queue | Chat | People) + mini-player
        queue.tsx        # track search, add, upvote
        player.tsx       # artwork card, EQ bars, transport, like/volume/lyrics
        chat.tsx         # presence + chat (unread badge)
        people.tsx       # listener list
    audio/PlayerContext.tsx   # expo-audio driver, background + lock-screen
    state/
      SocketContext.tsx  # socket.io lifecycle (path /socket.io)
      RoomContext.tsx    # room state machine, NTP sync application
    sync/
      protocol.ts        # socket event names + payload types
      engine.ts          # NTP offset math (ported from web RoomClient.js)
    components/          # Vinyl, RoomCard, QueueList, ChatPanel,
                         # FlyingReactions, Modals, ui primitives
    theme.ts / fonts.ts  # "Vinyl & Analog Dark" design tokens
  app.config.ts          # expo-audio background plugin, scheme, updates
  eas.json               # preview/production APK profiles (internal dist)
```

## How sync works on mobile

Identical math to the web client (`sync_ping`/`sync_pong` → offset, median of
8 samples, outlier filter at 1800ms RTT). Differences on mobile:

- The socket **dies when the app backgrounds**. On every reconnect/foreground,
  the offset is re-measured _before_ trusting any play/pause/seek events.
- Position is polled at 150ms and extrapolated with a monotonic clock between
  polls (`pos(t) = lastPos + (t − t_sample)`).
- Stream URLs are signed/expiring — re-request on 403 and swap without
  dropping the foreground audio service.

## Notes / TODOs

- Push: the app registers an Expo push token on launch (`src/notifications.ts`)
  and best-effort POSTs it to `POST /push/token` — the backend doesn't have
  that endpoint yet; add it server-side to enable "room started" notifications.
- Discord OAuth is guest-only for now (web parity deferred).
