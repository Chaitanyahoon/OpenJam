/**
 * Pure format utilities for time, duration, and relative timestamps across OpenJam mobile.
 */

export function formatDuration(ms?: number, fallback = '0:00'): string {
  if (!ms || ms <= 0 || isNaN(ms)) return fallback;
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  if (!timestamp || isNaN(timestamp)) return '';
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatChatTimestamp(ts: number | string): string {
  if (!ts) return '';
  let d: Date;
  if (typeof ts === 'string') {
    const clean = ts.trim();
    if (!clean.endsWith('Z') && !clean.includes('+') && !clean.slice(10).includes('-')) {
      d = new Date(`${clean}Z`);
    } else {
      d = new Date(clean);
    }
  } else {
    d = new Date(ts);
  }
  if (isNaN(d.getTime())) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const mm = m < 10 ? `0${m}` : m;
  return `${h}:${mm} ${ampm}`;
}
