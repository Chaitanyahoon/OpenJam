/**
 * Single source of truth for backend API & WebSocket URL across the OpenJam web client.
 * Defensively strips trailing slashes and misconfigured /health endpoints.
 */

export function getBackendUrl() {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
    if (isLocal) {
      return `http://${hostname}:8000`;
    }
  }

  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
    const url = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (url && url !== 'undefined' && url !== 'null' && url.trim() !== '') {
      return url.replace(/\/$/, '').replace(/\/health\/?$/, '');
    }
  }

  return 'https://openjam-backend.onrender.com';
}
