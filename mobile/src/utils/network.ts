/**
 * Network Connectivity Monitor.
 *
 * Lightweight, zero-native-dependency network monitor for OpenJam.
 * Uses periodic heartbeat and lightweight fetch pings to detect
 * network/WiFi disconnects and notify subscribers.
 */
import { AppState } from 'react-native';
import { getBackendUrl } from '../config';

type NetworkListener = (isOnline: boolean) => void;

let isOnlineState = true;
const listeners = new Set<NetworkListener>();
let monitorInterval: ReturnType<typeof setInterval> | null = null;

function setOnlineState(online: boolean) {
  if (isOnlineState !== online) {
    isOnlineState = online;
    listeners.forEach((listener) => {
      try {
        listener(online);
      } catch (e) {
        console.warn('Network listener error:', e);
      }
    });
  }
}

export function isDeviceOnline(): boolean {
  return isOnlineState;
}

export function notifyNetworkFailure(): void {
  setOnlineState(false);
}

export function notifyNetworkSuccess(): void {
  setOnlineState(true);
}

export async function pingConnection(): Promise<boolean> {
  // 1. Check ultra-fast Google captive portal 204 — universal standard for Android connectivity
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 204 || (res.status >= 200 && res.status < 400)) {
      setOnlineState(true);
      return true;
    }
  } catch {}

  // 2. Secondary fallback: Cloudflare global trace
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://1.1.1.1/cdn-cgi/trace', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status >= 200 && res.status < 400) {
      setOnlineState(true);
      return true;
    }
  } catch {}

  // 3. Tertiary fallback: Backend /health check
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${getBackendUrl()}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const ok = res.status >= 200 && res.status < 500;
    setOnlineState(ok);
    return ok;
  } catch {
    setOnlineState(false);
    return false;
  }
}

export function subscribeNetworkState(listener: NetworkListener): () => void {
  listeners.add(listener);
  listener(isOnlineState);

  if (!monitorInterval) {
    monitorInterval = setInterval(() => {
      void pingConnection();
    }, 12000);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && monitorInterval) {
      clearInterval(monitorInterval);
      monitorInterval = null;
    }
  };
}

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void pingConnection();
  }
});
