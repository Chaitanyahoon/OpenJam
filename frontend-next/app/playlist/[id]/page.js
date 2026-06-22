import React, { Suspense } from 'react';
import PlaylistPageClient from './PlaylistPageClient';
import { PlaylistSkeleton } from '@/components/SkeletonLoaders';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export const metadata = {
  title: "Shared Playlist — Open Jam",
  description: "Listen to a shared playlist on Open Jam and add all tracks directly to your live listening room queue.",
  robots: { index: false, follow: false },
};

export default function PlaylistPage() {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistPageClient />
    </Suspense>
  );
}
