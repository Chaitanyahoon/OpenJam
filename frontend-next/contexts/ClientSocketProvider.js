'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the SocketProvider with SSR disabled.
// This prevents the SocketProvider from being rendered during
// Next.js static pre-rendering, which was causing "Uncached data
// outside <Suspense>" errors with cacheComponents enabled.
const SocketProviderNoSSR = dynamic(
  () => import('./SocketContext').then((mod) => ({ default: mod.SocketProvider })),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function ClientSocketProvider({ children }) {
  return <SocketProviderNoSSR>{children}</SocketProviderNoSSR>;
}
