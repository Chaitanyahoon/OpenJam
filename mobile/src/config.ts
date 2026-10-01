/**
 * App configuration — backend URL resolution.
 * Mirrors frontend-next/contexts/SocketContext.js getBackendUrl().
 *
 * Set EXPO_PUBLIC_BACKEND_URL in .env (or EAS build env) to point at your
 * OpenJam server. Falls back to the public Render deployment.
 */
export function getBackendUrl(): string {
  const env = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (env && env.trim() !== '' && env !== 'undefined' && env !== 'null') {
    return env.replace(/\/$/, '');
  }
  return 'https://openjam.onrender.com';
}

/** Deep-link scheme for room invites: openjam://room/<id> */
export const APP_SCHEME = 'openjam';
