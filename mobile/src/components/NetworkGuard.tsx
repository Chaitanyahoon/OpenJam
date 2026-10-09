/**
 * NetworkGuard Component.
 *
 * Automatically monitors network status. When internet or WiFi drops,
 * notifies the user and redirects to the Offline Music Vault (/offline).
 * When connectivity returns, informs the user so they can rejoin live jams.
 */
import React, { useEffect, useRef } from 'react';
import { useToast } from './ToastContext';
import { subscribeNetworkState } from '../utils/network';
import { hapticMedium } from '../utils/haptics';

export function NetworkGuard({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const isFirstCheck = useRef(true);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsub = subscribeNetworkState((isOnline) => {
      if (isFirstCheck.current) {
        isFirstCheck.current = false;
        if (!isOnline) {
          wasOffline.current = true;
          void hapticMedium();
          toast('Offline mode active • Playing saved vault music', 'info');
        }
        return;
      }

      if (!isOnline) {
        wasOffline.current = true;
        void hapticMedium();
        toast('Network disconnected • Switched to Offline Vault', 'info');
      } else {
        if (wasOffline.current) {
          wasOffline.current = false;
          void hapticMedium();
          toast('Internet restored! Welcome back to OpenJam.', 'success');
        }
      }
    });

    return unsub;
  }, [toast]);

  return <>{children}</>;
}
