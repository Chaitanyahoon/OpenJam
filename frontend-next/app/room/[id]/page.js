import React from 'react';
import RoomPageClient from '@/components/RoomPageClient';

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
  return <RoomPageClient roomId={id} />;
}