import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { TrackSearchResult, RoomSummary } from '../src/api.ts';

/**
 * Pure deduplication and merging function matching searchHybridTracks logic.
 */
export function mergeHybridTracksPure(
  localMatches: TrackSearchResult[],
  remoteMatches: TrackSearchResult[],
): TrackSearchResult[] {
  const merged: TrackSearchResult[] = [...remoteMatches];
  for (const loc of localMatches) {
    if (
      !merged.some(
        (m) =>
          m.uri === loc.uri ||
          (m.name.toLowerCase() === loc.name.toLowerCase() &&
            m.artist.toLowerCase() === loc.artist.toLowerCase()),
      )
    ) {
      merged.push(loc);
    }
  }
  return merged;
}

/**
 * SWR room cache fallback resolver matching getRooms fallback logic.
 */
export function resolveRoomsWithSwrFallbackPure(
  liveRooms: RoomSummary[] | null,
  cachedRooms: RoomSummary[],
): { rooms: RoomSummary[]; fromCache: boolean } {
  if (liveRooms && liveRooms.length > 0) {
    return { rooms: liveRooms, fromCache: false };
  }
  return { rooms: cachedRooms, fromCache: true };
}

/**
 * Pure heartbeat throttle check matching sendHeartbeat timing logic.
 */
export function shouldSendHeartbeatPure(
  lastPingTimestamp: number,
  nowTimestamp: number,
  intervalMs = 600_000,
  minIntervalMs = 60_000,
  force = false,
): boolean {
  if (force) return true;
  const elapsed = nowTimestamp - lastPingTimestamp;
  if (elapsed < minIntervalMs) return false;
  return elapsed >= intervalMs;
}

describe('Render Free-Tier Resilience & SWR Engine', () => {
  it('deduplicates identical track URIs between local vault and cloud results', () => {
    const local: TrackSearchResult[] = [
      { uri: 'yt:abc12345', name: 'Lofi Midnight', artist: 'Chill Beats' },
      { uri: 'yt:local999', name: 'Offline Jam', artist: 'Local Artist' },
    ];
    const remote: TrackSearchResult[] = [
      { uri: 'yt:abc12345', name: 'Lofi Midnight', artist: 'Chill Beats' },
      { uri: 'yt:remote777', name: 'Cloud Synth', artist: 'Cyber DJ' },
    ];

    const merged = mergeHybridTracksPure(local, remote);
    assert.strictEqual(merged.length, 3);
    assert.strictEqual(merged[0].uri, 'yt:abc12345');
    assert.strictEqual(merged[1].uri, 'yt:remote777');
    assert.strictEqual(merged[2].uri, 'yt:local999');
  });

  it('deduplicates case-insensitive track names and artists', () => {
    const local: TrackSearchResult[] = [
      { uri: 'local:1', name: 'SYNTH RUNNER', artist: 'RETROWAVE' },
    ];
    const remote: TrackSearchResult[] = [
      { uri: 'cloud:2', name: 'synth runner', artist: 'retrowave' },
    ];

    const merged = mergeHybridTracksPure(local, remote);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].uri, 'cloud:2');
  });

  it('retains local offline matches when remote cloud search returns empty', () => {
    const local: TrackSearchResult[] = [
      { uri: 'yt:offline1', name: 'Saved Track 1', artist: 'Artist A' },
      { uri: 'yt:offline2', name: 'Saved Track 2', artist: 'Artist B' },
    ];
    const remote: TrackSearchResult[] = [];

    const merged = mergeHybridTracksPure(local, remote);
    assert.strictEqual(merged.length, 2);
    assert.strictEqual(merged[0].name, 'Saved Track 1');
  });

  it('falls back to cached rooms when Render backend is cold or returns null', () => {
    const cached: RoomSummary[] = [
      {
        id: 'room-1',
        name: 'Chill Vibes',
        host_name: 'Host A',
        listener_count: 5,
        is_private: false,
      },
    ];

    const result = resolveRoomsWithSwrFallbackPure(null, cached);
    assert.strictEqual(result.fromCache, true);
    assert.strictEqual(result.rooms.length, 1);
    assert.strictEqual(result.rooms[0].name, 'Chill Vibes');
  });

  it('prefers live rooms when backend succeeds', () => {
    const cached: RoomSummary[] = [
      { id: 'room-old', name: 'Old Room', host_name: 'Host Old', listener_count: 1, is_private: false },
    ];
    const live: RoomSummary[] = [
      { id: 'room-new', name: 'Live Room', host_name: 'Host New', listener_count: 8, is_private: false },
    ];

    const result = resolveRoomsWithSwrFallbackPure(live, cached);
    assert.strictEqual(result.fromCache, false);
    assert.strictEqual(result.rooms.length, 1);
    assert.strictEqual(result.rooms[0].name, 'Live Room');
  });

  it('throttles rapid keepalive pings within 60 seconds to preserve network', () => {
    const now = 1_000_000;
    const lastPing = now - 30_000; // 30s ago
    const shouldPing = shouldSendHeartbeatPure(lastPing, now);
    assert.strictEqual(shouldPing, false);
  });

  it('allows forced heartbeat regardless of elapsed time', () => {
    const now = 1_000_000;
    const lastPing = now - 5_000; // 5s ago
    const shouldPing = shouldSendHeartbeatPure(lastPing, now, 600_000, 60_000, true);
    assert.strictEqual(shouldPing, true);
  });

  it('triggers keepalive when interval is reached (10 min < 15 min Render shutdown)', () => {
    const now = 1_000_000;
    const lastPing = now - 601_000; // 10 min 1 sec ago
    const shouldPing = shouldSendHeartbeatPure(lastPing, now, 600_000);
    assert.strictEqual(shouldPing, true);
  });
});
