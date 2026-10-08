/**
 * OpenJam Foreground Heartbeat Manager.
 *
 * Keeps the Render free-tier instance warm while the user is actively
 * using the app, mitigating the 15-minute spin-down without violating
 * Android battery rules (strictly active foreground only).
 */
import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { pingBackend } from '../api';

const HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (well before Render's 15m idle shutdown)

let lastPingTimestamp = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export async function sendHeartbeat(force = false): Promise<boolean> {
  const now = Date.now();
  // Don't spam if pinged in the last 60 seconds unless forced
  if (!force && now - lastPingTimestamp < 60_000) {
    return false;
  }
  lastPingTimestamp = now;
  try {
    const res = await pingBackend();
    return !!res && res.status === 'pong';
  } catch {
    return false;
  }
}

export function startHeartbeat(): void {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // Send immediate lightweight ping to warm up or check server
  sendHeartbeat().catch(() => {});
  heartbeatTimer = setInterval(() => {
    if (AppState.currentState === 'active') {
      sendHeartbeat(true).catch(() => {});
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Hook to automatically maintain Render server warm state while active in foreground.
 */
export function useAppHeartbeat(): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    startHeartbeat();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App resumed from background: warm up Render immediately
        sendHeartbeat().catch(() => {});
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopHeartbeat();
    };
  }, []);
}
