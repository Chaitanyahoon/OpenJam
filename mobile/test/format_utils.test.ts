import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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

describe('Format Utilities Seam Suite', () => {
  describe('formatDuration', () => {
    it('formats standard minute and second duration', () => {
      assert.equal(formatDuration(215000), '3:35');
    });

    it('pads single digit seconds with leading zero', () => {
      assert.equal(formatDuration(65000), '1:05');
    });

    it('formats hour duration with proper padding', () => {
      assert.equal(formatDuration(3665000), '1:01:05');
    });

    it('returns custom fallback for zero or invalid milliseconds', () => {
      assert.equal(formatDuration(0, ''), '');
      assert.equal(formatDuration(-500, '0:00'), '0:00');
      assert.equal(formatDuration(NaN, '0:00'), '0:00');
      assert.equal(formatDuration(undefined, '0:00'), '0:00');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "Just now" for events under 60 seconds ago', () => {
      const now = 1000000;
      assert.equal(formatRelativeTime(now - 30 * 1000, now), 'Just now');
    });

    it('returns minutes ago for events under an hour ago', () => {
      const now = 1000000;
      assert.equal(formatRelativeTime(now - 15 * 60 * 1000, now), '15m ago');
    });

    it('returns hours ago for events under a day ago', () => {
      const now = 1000000;
      assert.equal(formatRelativeTime(now - 4 * 3600 * 1000, now), '4h ago');
    });

    it('returns days ago for events more than 24 hours ago', () => {
      const now = 1000000;
      assert.equal(formatRelativeTime(now - 3 * 86400 * 1000, now), '3d ago');
    });
  });
});
