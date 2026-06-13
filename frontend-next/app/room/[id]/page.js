import React, { Suspense } from 'react';
import RoomPageClient from './RoomPageClient';

export function generateMetadata() {
  return {
    title: 'Jam Room — Open Jam',
    description: 'Join this listening room and discover music together in real-time.',
    openGraph: {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room. Queue tracks and listen together!',
      type: 'music.playlist',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room. Queue tracks and listen together!',
    },
  };
}

export default async function RoomPage({ params }) {
  const { id } = await params;
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
      <RoomPageClient roomId={id} />
    </Suspense>
  );
}