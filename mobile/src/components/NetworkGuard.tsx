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
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsub = subscribeNetworkState((isOnline) => {
      if (isFirstCheck.current) {
        isFirstCheck.current = false;
        if (!isOnline) {
          wasOffline.current = true;
          if (pathname !== '/offline') {
            void hapticMedium();
            toast('Offline mode active — showing saved vault music', 'info');
            router.replace('/offline');
          }
        }
        return;
      }

      if (!isOnline) {
        wasOffline.current = true;
        if (pathname !== '/offline') {
          void hapticMedium();
          toast('Network disconnected — switched to Offline Vault', 'info');
          router.replace('/offline');
        }
      } else {
        if (wasOffline.current) {
          wasOffline.current = false;
          if (pathname === '/offline') {
            void hapticMedium();
            toast('Internet restored! Welcome back to OpenJam.', 'success');
            router.replace('/');
          }
        }
      }
    });

    return unsub;
  }, [pathname, toast]);

  return <>{children}</>;
}
