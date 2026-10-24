'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RoomSkeleton } from '@/components/SkeletonLoaders';

const RoomClientNoSSR = dynamic(() => import('./RoomClient'), {
  ssr: false,
  loading: () => <RoomSkeleton />
});

export default function RoomPageClient() {
  const params = useParams();
  const rawId = params?.id;
  const roomId = Array.isArray(rawId) ? rawId[0] : (rawId || null);
  if (!roomId) return <RoomSkeleton />;
  return <RoomClientNoSSR roomId={roomId} />;
}
