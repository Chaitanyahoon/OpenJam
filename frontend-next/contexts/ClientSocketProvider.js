'use client';

import React, { useState, useEffect } from 'react';

export default function ClientSocketProvider({ children }) {
  const [Provider, setProvider] = useState(null);

  useEffect(() => {
    import('./SocketContext').then(mod => {
      setProvider(() => mod.SocketProvider);
    });
  }, []);

  if (!Provider) {
    // Render children without socket context during initial load
    // This prevents a flash of null/empty content
    return <>{children}</>;
  }

  return <Provider>{children}</Provider>;
}
