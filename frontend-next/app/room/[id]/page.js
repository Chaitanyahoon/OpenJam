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
        const inviter = room.host_name || 'Someone';

        let title = `${room.name} • OpenJam Live Room`;
        let description = room.description || `🎧 Live music room hosted by ${inviter}. Stream music together in real-time sync with friends.`;
        
        if (currentTrack) {
          const trackTitle = currentTrack.track_name || 'Music';
          const artistName = currentTrack.artist || 'Artist';
          const count = listenerCount > 0 ? listenerCount : 1;
          title = `${trackTitle} • ${artistName} | OpenJam`;
          description = `🎧 Live in "${room.name}" (${count} listening) — Tap to tune in and sync music together in real time!`;
        }

        const ogParams = new URLSearchParams();
        if (inviter) ogParams.set('inviter', inviter);
        if (listenerCount > 0) ogParams.set('listener_count', listenerCount.toString());
        if (currentTrack) {
          if (currentTrack.track_name) ogParams.set('track_name', currentTrack.track_name);
          if (currentTrack.artist) ogParams.set('artist', currentTrack.artist);
          if (currentTrack.album_art_url) ogParams.set('cover_art_url', currentTrack.album_art_url);
        }

        const ogImage = `${backendUrl}/api/og/room/${id}.png?${ogParams.toString()}`;

        return {
          title,
          description,
          themeColor: '#ff9f1c',
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
                url: ogImage,
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
            images: [ogImage],
          },
        };
      }
    }
  } catch (error) {
    console.warn('Could not fetch room metadata for id:', id, error.message || error);
  }

  // Fallback metadata if fetch fails or room not found
  return {
    title: 'Jam Room — Open Jam',
    description: 'Join a live listening room and discover music together in real-time on Open Jam.',
    robots: { index: true, follow: true },
    alternates: { canonical: 'https://www.openjam.fun' },
    openGraph: {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room and discover music together in real-time on Open Jam.',
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
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room and discover music together in real-time on Open Jam.',
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