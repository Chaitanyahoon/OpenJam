import React, { Suspense } from 'react';
import RoomPageClient from './RoomPageClient';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export function generateMetadata() {
  return {
    title: 'Jam Room — Open Jam',
    description: 'Join this listening room and discover music together in real-time.',
    alternates: { canonical: 'https://www.openjam.fun' },
    openGraph: {
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room. Queue tracks and listen together!',
      type: 'music.playlist',
      images: [
        {
          url: '/static/img/og-image.svg',
          width: 1200,
          height: 630,
          alt: 'Jam Room — Open Jam',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Jam Room — Open Jam',
      description: 'Join a live listening room. Queue tracks and listen together!',
      images: ['/static/img/og-image.svg'],
    },
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