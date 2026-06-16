'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const RoomClientNoSSR = dynamic(() => import('./RoomClient'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#08080a',
      color: '#fff',
      fontFamily: 'var(--font-ui), sans-serif'
    }}>
      Loading Jam Room...
    </div>
  )
});

export default function RoomPageClient() {
  const params = useParams();
  return <RoomClientNoSSR roomId={params.id} />;
}
