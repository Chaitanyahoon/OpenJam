'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RoomSkeleton } from '@/components/SkeletonLoaders';

const RoomClientNoSSR = dynamic(() => import('./RoomClient'), {
  ssr: false,
  loading: () => <RoomSkeleton />
});

export default function RoomPageClient({ initialRoomId = null }) {
  const params = useParams();
  const rawId = params?.id || initialRoomId;
  const roomId = Array.isArray(rawId) ? rawId[0] : (rawId || null);
  if (!roomId || roomId === 'loading') return <RoomSkeleton />;
  return <RoomClientNoSSR roomId={roomId} />;
}
