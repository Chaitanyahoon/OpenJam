import React, { Suspense } from 'react';
import ProfilePageClient from './ProfilePageClient';
import { ProfileSkeleton } from '@/components/SkeletonLoaders';

function getBackendUrl() {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '');
    }
  }
  return 'https://api.openjam.fun';
}

export function generateStaticParams() {
  return [{ id: 'loading' }];
}

export async function generateMetadata(props) {
  const params = await props.params;
  const id = params.id;
  
  if (id === 'loading') {
    return {
      title: 'User Profile | OpenJam',
      description: 'Discover their playlists, listening history, and favorite tracks on OpenJam.',
    };
  }
  
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/profile/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error('Failed to fetch profile');
    
    const data = await res.json();
    const user = data.user;
    if (!user) throw new Error('No user data');
    
    const displayName = user.display_name || user.username || 'User';
    const username = user.username || id;
    const bio = user.bio || '';
    
    return {
      title: `@${username} • OpenJam Profile`,
      description: `Check out ${displayName}'s music profile on OpenJam. ${bio || 'Discover their playlists, listening history, and favorite tracks.'}`,
      alternates: {
        canonical: `/profile/${id}`,
      },
      openGraph: {
        title: `@${username} • OpenJam Profile`,
        description: `Check out ${displayName}'s music profile on OpenJam. ${bio || 'Discover their playlists, listening history, and favorite tracks.'}`,
        url: `/profile/${id}`,
        siteName: 'OpenJam',
        images: user.avatar_url ? [{ url: user.avatar_url, width: 800, height: 800, alt: `${displayName}'s Avatar` }] : [],
        type: 'profile',
      },
      twitter: {
        card: 'summary_large_image',
        title: `@${username} • OpenJam Profile`,
        description: `Check out ${displayName}'s music profile on OpenJam. ${bio || 'Discover their playlists, listening history, and favorite tracks.'}`,
        images: user.avatar_url ? [user.avatar_url] : [],
      },
    };
  } catch (error) {
    return {
      title: 'User Profile | OpenJam',
      description: 'Check out this music profile on OpenJam. Discover their playlists, listening history, and favorite tracks.',
      alternates: {
        canonical: `/profile/${id}`,
      },
    };
  }
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfilePageClient />
    </Suspense>
  );
}
