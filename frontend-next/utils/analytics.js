/**
 * Lightweight anonymous analytics and event tracker for OpenJam.
 * Zero tracking cookies, zero external trackers, GDPR & privacy-friendly.
 */

import { getBackendUrl } from './config';

const BACKEND_URL = getBackendUrl();

/**
 * Get or create an anonymous session ID that persists only for this browser session.
 */
export function getSessionId() {
  if (typeof window === 'undefined') return 'server_session';
  try {
    let sess = window.sessionStorage.getItem('openjam_sess_id');
    if (!sess) {
      sess = 's_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      window.sessionStorage.setItem('openjam_sess_id', sess);
    }
    return sess;
  } catch (e) {
    return 'fallback_session_' + Date.now().toString(36);
  }
}

/**
 * Track an anonymous product engagement event.
 * Fire-and-forget: uses navigator.sendBeacon or fetch keepalive.
 */
export function trackEvent(event, { room_id = null, ...metadata } = {}) {
  if (typeof window === 'undefined') return;
  try {
    const sessionId = getSessionId();
    let userId = null;
    try {
      userId = window.localStorage.getItem('openjam_user_id') || null;
    } catch (e) {}

    const payload = {
      event: String(event).trim().toLowerCase(),
      session_id: sessionId,
      room_id: room_id || null,
      user_id: userId,
      metadata: Object.keys(metadata).length > 0 ? metadata : null,
    };

    const targetUrl = `${BACKEND_URL}/analytics/event`;
    const jsonStr = JSON.stringify(payload);

    // Prefer sendBeacon for non-blocking reliability on unload/navigation
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const sent = navigator.sendBeacon(targetUrl, blob);
      if (sent) return;
    }

    // Fallback to fetch with keepalive
    fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr,
      keepalive: true,
    }).catch(() => {
      // Intentionally silent
    });
  } catch (err) {
    // Fail-safe: analytics must never break user experience
  }
}

/**
 * Submit user micro-feedback (Rating: "great", "meh", "confusing").
 */
export async function submitFeedback({ rating, comment = null, room_id = null }) {
  try {
    const sessionId = getSessionId();
    let userId = null;
    try {
      userId = window.localStorage.getItem('openjam_user_id') || null;
    } catch (e) {}

    const res = await fetch(`${BACKEND_URL}/analytics/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating,
        comment: comment ? String(comment).slice(0, 1000) : null,
        session_id: sessionId,
        room_id,
        user_id: userId,
      }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
