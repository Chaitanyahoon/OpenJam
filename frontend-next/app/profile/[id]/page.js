import React, { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageClient />
    </Suspense>
  );
}
