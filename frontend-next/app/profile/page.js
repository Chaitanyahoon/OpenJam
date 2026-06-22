import React, { Suspense } from 'react';
import ProfileClient from './ProfileClient';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';

export const metadata = {
  title: 'My Profile — Open Jam',
  description: 'Manage your playlists, view your musical footprint, liked songs, and connect with other listeners on Open Jam.',
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileClient />
    </Suspense>
  );
}
