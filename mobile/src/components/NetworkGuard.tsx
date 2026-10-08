/**
 * NetworkGuard Component.
 *
 * Automatically monitors network status. When internet or WiFi drops,
 * notifies the user and redirects to the Offline Music Vault (/offline).
 * When connectivity returns, informs the user so they can rejoin live jams.
 */
import React, { useEffect, useRef } from 'react';
import { router, usePathname } from 'expo-router';
import { useToast } from './ToastContext';
import { subscribeNetworkState } from '../utils/network';
import { hapticMedium } from '../utils/haptics';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const toast = useToast();
  const isFirstCheck = useRef(true);

  useEffect(() => {
    const unsub = subscribeNetworkState((isOnline) => {
      if (isFirstCheck.current) {
        isFirstCheck.current = false;
        if (!isOnline && pathname !== '/offline') {
          void hapticMedium();
          toast('Offline mode active — showing saved vault music', 'info');
          router.replace('/offline');
        }
        return;
      }

      if (!isOnline) {
        if (pathname !== '/offline') {
          void hapticMedium();
          toast('Network disconnected — switched to Offline Vault', 'info');
          router.replace('/offline');
        }
      } else {
        if (pathname === '/offline') {
          toast('Internet restored! Ready to stream live jams.', 'success');
        }
      }
    });

    return unsub;
  }, [pathname, toast]);

  return <>{children}</>;
}
