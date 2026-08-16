import React, { Suspense } from 'react';
import PlaylistPageClient from './PlaylistPageClient';
import { PlaylistSkeleton } from '@/components/SkeletonLoaders';

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
      title: 'Shared Playlist | OpenJam',
      description: 'Listen to a shared playlist on OpenJam and add all tracks directly to your live listening room queue.',
    };
  }
  
  try {
    const backendUrl = getBackendUrl();
    const res = await fetch(`${backendUrl}/playlists/${id}`, { next: { revalidate: 120 } });
    if (!res.ok) throw new Error('Failed to fetch playlist');
    
    const data = await res.json();
    const playlist = data.playlist || data;
    if (!playlist) throw new Error('No playlist data');
    
    const playlistName = playlist.name || 'Shared Playlist';
    const creatorName = playlist.creator_name || playlist.creator?.display_name || playlist.creator?.username || 'OpenJam User';
    const trackCount = playlist.tracks ? playlist.tracks.length : 0;
    
    return {
      title: `${playlistName} • Playlist | OpenJam`,
      description: `${trackCount} tracks by ${creatorName} on OpenJam. Listen and add to your live room queue.`,
      alternates: {
        canonical: `/playlist/${id}`,
      },
      openGraph: {
        title: `${playlistName} • Playlist | OpenJam`,
        description: `${trackCount} tracks by ${creatorName} on OpenJam. Listen and add to your live room queue.`,
        url: `/playlist/${id}`,
        siteName: 'OpenJam',
        images: playlist.cover_url ? [{ url: playlist.cover_url, width: 800, height: 800, alt: `${playlistName} Cover` }] : [],
        type: 'music.playlist',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${playlistName} • Playlist | OpenJam`,
        description: `${trackCount} tracks by ${creatorName} on OpenJam. Listen and add to your live room queue.`,
        images: playlist.cover_url ? [playlist.cover_url] : [],
      },
    };
  } catch (error) {
    return {
      title: 'Shared Playlist | OpenJam',
      description: 'Listen to a shared playlist on OpenJam and add all tracks directly to your live listening room queue.',
      alternates: {
        canonical: `/playlist/${id}`,
      },
    };
  }
}

export default function PlaylistPage() {
  return (
    <Suspense fallback={<PlaylistSkeleton />}>
      <PlaylistPageClient />
    </Suspense>
  );
}
