'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const PlaylistClientNoSSR = dynamic(() => import('./PlaylistClient'), {
  ssr: false,
  loading: () => (
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
  )
});

export default function PlaylistPageClient() {
  return <PlaylistClientNoSSR />;
}
