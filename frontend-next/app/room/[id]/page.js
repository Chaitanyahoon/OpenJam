import React, { Suspense } from 'react';
import RoomPageClient from './RoomPageClient';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const id = resolvedParams?.id;

  if (!id || id === 'loading') {
    return {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room, queue tracks, and stream music with friends.',
      robots: { index: false, follow: false },
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

        let title = `${room.name} — Open Jam`;
        let description = room.description || `Join the listening room "${room.name}" on Open Jam to stream music together in real-time.`;
        
        if (currentTrack) {
          title = `Now Playing: ${currentTrack.track_name} by ${currentTrack.artist} in ${room.name}`;
          description = `Listening to "${currentTrack.track_name}" by ${currentTrack.artist} in ${room.name} with ${listenerCount} other listener(s). Join Open Jam to listen along!`;
        }

        const ogImage = currentTrack?.album_art_url || 'https://www.openjam.fun/static/img/og-image.svg';

        return {
          title,
          description,
          robots: { index: false, follow: false },
          alternates: { canonical: 'https://www.openjam.fun' },
          openGraph: {
            title,
            description,
            type: 'music.playlist',
            url: `https://www.openjam.fun/room/${id}`,
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
    robots: { index: false, follow: false },
    alternates: { canonical: 'https://www.openjam.fun' },
    openGraph: {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room and discover music together in real-time.',
      url: 'https://www.openjam.fun',
    }
  };
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#08080a',
        color: '#fff',
        fontFamily: 'var(--font-ui), sans-serif'
      }}>
        Loading Jam Room...
      </div>
    }>
      <RoomPageClient />
    </Suspense>
  );
}