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
  return <RoomClientNoSSR roomId={params.id} />;
}
