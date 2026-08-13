# Handoff Report: Explorer 1 (Milestone 3 — Open Graph Social Cards & CTR Optimization)

## 1. Observation

Direct observations from examining the codebase:

### Target Files Examined:
1. `frontend-next/app/page.js` (lines 4–30)
```javascript
export const metadata = {
  title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
  description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
  keywords: [
    "openjam",
    "listen to music with friends online",
    "shared music listening room",
    "sync youtube music with friends",
    "listen music with friends online free",
    "virtual music room",
    "synced music playback",
    "real-time music sync",
    "collaborative music queue",
    "listen together free"
  ],
  alternates: { canonical: "https://www.openjam.fun" },
  openGraph: {
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
    url: "https://www.openjam.fun",
  },
  twitter: {
    card: "summary_large_image",
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
  }
};
```
- **Deficiencies observed**:
  - `openGraph` object lacks `images`, `siteName`, `locale`, and `type`.
  - `twitter` object lacks `images`.

2. `frontend-next/app/room/[id]/page.js` (lines 9–99)
```javascript
        const inviter = room.host_name || 'Someone';
        const ogImage = currentTrack?.album_art_url || `${backendUrl}/api/og/room/${id}.png?inviter=${encodeURIComponent(inviter)}`;
```
- **Deficiencies observed**:
  - `ogImage` defaults to `currentTrack.album_art_url` directly when a track is playing, bypassing the dynamic social card card generator (`/api/og/room/${id}.png`) which formats track title, artist, host name, and live listener count on a 1200x630 branded image.
  - The query parameter string for `/api/og/room/${id}.png` only passes `inviter`, omitting `track_name`, `artist`, `listener_count`, and `album_art_url`.
  - Fallback return block (lines 88–99) and loading guard block (lines 13–19) return `openGraph` without `images` or `twitter` cards.

3. `backend/main.py` (lines 336–357)
```python
@app.get("/api/og/room/{room_id}.png")
async def get_og_image(room_id: str, inviter: str = "Someone", db: Session = Depends(get_db)):
    ...
```
- **Backend contract observed**: Dynamic OG image route exists at `/api/og/room/{room_id}.png` and will accept query parameters (`inviter`, `track_name`, `artist`, `listener_count`, `album_art_url`).

---

## 2. Logic Chain

1. **Social CTR Optimization (R3 Requirement)**:
   - When users share a room link on Discord, Twitter/X, WhatsApp, or Reddit, social media crawlers fetch the `og:image` and `twitter:image` meta tags.
   - Using a raw square album art thumbnail (or no image) results in low social click-through rate.
   - Calling `${backendUrl}/api/og/room/${id}.png` with rich metadata query params allows the backend card renderer to produce a high-impact 1200x630 visual card with album art, room name, host name, current track details, live listener count, and OpenJam branding.

2. **Dynamic Metadata Construction in `room/[id]/page.js`**:
   - `generateMetadata` fetches room data from `GET ${backendUrl}/rooms/${id}`.
   - `data.room` provides: `room.name`, `room.host_name`, `room.listener_count`, `room.current_track.track_name`, `room.current_track.artist`, `room.current_track.album_art_url`.
   - Dynamic `title`:
     - When `current_track` exists: `Now Playing: ${currentTrack.track_name} by ${currentTrack.artist} in ${room.name}`
     - When no track: `${room.name} — Live Music Room on OpenJam`
   - Dynamic `description`:
     - When `current_track` exists: `Listening to "${currentTrack.track_name}" by ${currentTrack.artist} in ${room.name} with ${listenerCount} active listener(s). Sync YouTube music with friends online free on OpenJam!`
     - When no track: `Join ${hostName}'s listening room "${room.name}" on OpenJam to listen to music with friends online free.`
   - Dynamic `og:image` URL:
     - Formatted using `URLSearchParams`: `${backendUrl}/api/og/room/${id}.png?inviter=${encodeURIComponent(hostName)}&listener_count=${listenerCount}&track_name=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artist)}&album_art_url=${encodeURIComponent(albumArtUrl)}`.

3. **Landing Page Social Card Completion in `app/page.js`**:
   - Explicitly add `openGraph.images` array pointing to `https://www.openjam.fun/static/img/hero_visual_showcase.webp` with `width: 1200`, `height: 630`, `alt`.
   - Explicitly add `twitter.images` array with the same hero visual card.
   - Include `siteName: 'OpenJam'`, `locale: 'en_US'`, `type: 'website'`.

---

## 3. Caveats

- **Assumptions**:
  - `process.env.NEXT_PUBLIC_BACKEND_URL` points to the FastAPI backend API base URL (e.g. `https://api.openjam.fun`).
  - The static hero visual image exists at `/static/img/hero_visual_showcase.webp` (referenced in `layout.js`).
- **Areas not investigated**:
  - Backend Pillow drawing/image generation implementation in `backend/services/og_generator.py` (scoped to Backend Explorer / Implementer).

---

## 4. Conclusion & Proposed Code Implementation

The following target code snippets represent the exact changes required for `frontend-next/app/page.js` and `frontend-next/app/room/[id]/page.js`.

### Target Code Snippet 1: `frontend-next/app/page.js`

```javascript
import React from 'react';
import HomeClient from './HomeClient';

export const metadata = {
  title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
  description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
  keywords: [
    "openjam",
    "listen to music with friends online",
    "shared music listening room",
    "sync youtube music with friends",
    "listen music with friends online free",
    "virtual music room",
    "synced music playback",
    "real-time music sync",
    "collaborative music queue",
    "listen together free"
  ],
  alternates: { canonical: "https://www.openjam.fun" },
  openGraph: {
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
    url: "https://www.openjam.fun",
    siteName: "OpenJam",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "https://www.openjam.fun/static/img/hero_visual_showcase.webp",
        width: 1200,
        height: 630,
        alt: "OpenJam — Listen to Music with Friends Online Free",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Listen to Music with Friends Online Free | Virtual Music Room — OpenJam",
    description: "Join a shared music listening room on OpenJam to sync YouTube music with friends. Experience millisecond-accurate synced music playback and listen to music with friends online free.",
    images: ["https://www.openjam.fun/static/img/hero_visual_showcase.webp"],
  }
};

export default function Page() {
  return <HomeClient />;
}
```

### Target Code Snippet 2: `frontend-next/app/room/[id]/page.js`

```javascript
import React, { Suspense } from 'react';
import RoomPageClient from './RoomPageClient';
import { RoomSkeleton } from '@/components/SkeletonLoaders';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  const staticFallbackImage = 'https://www.openjam.fun/static/img/hero_visual_showcase.webp';

  if (!id || id === 'loading') {
    return {
      title: 'Jam Room — OpenJam',
      description: 'Join a live listening room, queue tracks, and stream music with friends.',
      robots: { index: false, follow: false },
      alternates: { canonical: 'https://www.openjam.fun' },
      openGraph: {
        title: 'Jam Room — OpenJam',
        description: 'Join a live listening room, queue tracks, and stream music with friends.',
        url: 'https://www.openjam.fun',
        siteName: 'OpenJam',
        locale: 'en_US',
        type: 'website',
        images: [
          {
            url: staticFallbackImage,
            width: 1200,
            height: 630,
            alt: 'OpenJam — Virtual Music Room',
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Jam Room — OpenJam',
        description: 'Join a live listening room, queue tracks, and stream music with friends.',
        images: [staticFallbackImage],
      },
    };
  }

  try {
    const getBackendUrl = () => {
      if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
        const url = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
          return url.replace(/\/$/, '');
        }
      }
      return 'https://api.openjam.fun';
    };

    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/rooms/${id}`, { next: { revalidate: 30 } });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.room) {
        const room = data.room;
        const currentTrack = room.current_track;
        const listenerCount = room.listener_count || 0;
        const hostName = room.host_name || 'Someone';

        let title = `${room.name} — Live Music Room on OpenJam`;
        let description = room.description || `Join ${hostName}'s listening room "${room.name}" on OpenJam to listen to music with friends online free.`;
        
        if (currentTrack && currentTrack.track_name) {
          const trackTitle = currentTrack.artist ? `"${currentTrack.track_name}" by ${currentTrack.artist}` : `"${currentTrack.track_name}"`;
          title = `Now Playing: ${currentTrack.track_name}${currentTrack.artist ? ` by ${currentTrack.artist}` : ''} in ${room.name}`;
          description = `Listening to ${trackTitle} in ${room.name} with ${listenerCount} active listener(s). Sync YouTube music with friends online free on OpenJam!`;
        }

        // Construct dynamic backend social card image URL with full metadata query params
        const ogParams = new URLSearchParams();
        ogParams.set('inviter', hostName);
        if (listenerCount > 0) {
          ogParams.set('listener_count', listenerCount.toString());
        }
        if (currentTrack) {
          if (currentTrack.track_name) ogParams.set('track_name', currentTrack.track_name);
          if (currentTrack.artist) ogParams.set('artist', currentTrack.artist);
          if (currentTrack.album_art_url) ogParams.set('album_art_url', currentTrack.album_art_url);
        }

        const ogImageUrl = `${backendUrl}/api/og/room/${id}.png?${ogParams.toString()}`;

        return {
          title,
          description,
          robots: !room.is_private
            ? { index: true, follow: true }
            : { index: false, follow: false },
          alternates: { canonical: `https://www.openjam.fun/room/${id}` },
          openGraph: {
            title,
            description,
            type: 'music.playlist',
            url: `https://www.openjam.fun/room/${id}`,
            siteName: 'OpenJam',
            locale: 'en_US',
            images: [
              {
                url: ogImageUrl,
                width: 1200,
                height: 630,
                alt: title,
              },
            ],
          },
          twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
          },
        };
      }
    }
  } catch (error) {
    console.warn('Could not fetch room metadata for id:', id, error.message || error);
  }

  // Fallback metadata if fetch fails or room not found
  return {
    title: 'Jam Room — OpenJam',
    description: 'Join a live listening room and discover music together in real-time on OpenJam.',
    robots: { index: false, follow: false },
    alternates: { canonical: 'https://www.openjam.fun' },
    openGraph: {
      title: 'Jam Room — OpenJam',
      description: 'Join a live listening room and discover music together in real-time on OpenJam.',
      url: 'https://www.openjam.fun',
      siteName: 'OpenJam',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: staticFallbackImage,
          width: 1200,
          height: 630,
          alt: 'OpenJam — Virtual Music Room',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Jam Room — OpenJam',
      description: 'Join a live listening room and discover music together in real-time on OpenJam.',
      images: [staticFallbackImage],
    },
  };
}

export default function RoomPage() {
  return (
    <Suspense fallback={<RoomSkeleton />}>
      <RoomPageClient />
    </Suspense>
  );
}
```

---

## 5. Verification Method

To verify these changes after implementation:

1. **Build Verification**:
   - Run `npm run build` in `frontend-next` to confirm zero Next.js compilation errors.
2. **Metadata Inspection**:
   - Inspect output HTML meta tags for `/` and `/room/[id]`:
     - Verify `<meta property="og:image" content="..." />` and `<meta name="twitter:image" content="..." />` exist and contain correct absolute URLs.
     - Verify query parameters in `/api/og/room/[id].png?...` match `inviter`, `track_name`, `artist`, `listener_count`, and `album_art_url`.
3. **Invalidation Conditions**:
   - If `npm run build` throws syntax or type errors in `generateMetadata`.
   - If `og:image` URL is relative instead of absolute.
