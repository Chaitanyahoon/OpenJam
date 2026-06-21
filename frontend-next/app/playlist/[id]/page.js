import React, { Suspense } from 'react';
import PlaylistPageClient from './PlaylistPageClient';

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
    <Suspense fallback={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#08080a',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        Loading Playlist...
      </div>
    }>
      <PlaylistPageClient />
    </Suspense>
  );
}
