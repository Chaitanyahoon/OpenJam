import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { PlayedTrack, FavoriteRoom, ListeningStats, AppPreferences } from '../src/storage/history.ts';

export function addPlayedTrack(
  existing: PlayedTrack[],
  newTrack: Omit<PlayedTrack, 'playedAt'>,
  now: number = Date.now(),
): PlayedTrack[] {
  // Check 2-minute duplicate suppression
  const first = existing[0];
  if (first && first.track_uri === newTrack.track_uri && now - first.playedAt < 120_000) {
    return existing;
  }
  const entry: PlayedTrack = { ...newTrack, playedAt: now };
  const filtered = existing.filter((t) => t.track_uri !== newTrack.track_uri);
  return [entry, ...filtered].slice(0, 50);
}

export function updateStats(
  prev: ListeningStats,
  tracksIncrement: number,
  minutesIncrement: number,
  roomId?: string,
): ListeningStats {
  const rooms = new Set(prev.roomsVisited);
  if (roomId) rooms.add(roomId);
  return {
    totalTracksJammed: prev.totalTracksJammed + tracksIncrement,
    totalMinutesJammed: prev.totalMinutesJammed + minutesIncrement,
    roomsVisited: Array.from(rooms),
  };
}

export function toggleFavorite(
  existing: FavoriteRoom[],
  room: { id: string; name: string; hostName?: string },
  now: number = Date.now(),
): { updatedList: FavoriteRoom[]; isFavorited: boolean } {
  const index = existing.findIndex((r) => r.id === room.id);
  if (index >= 0) {
    return {
      updatedList: existing.filter((r) => r.id !== room.id),
      isFavorited: false,
    };
  }
  const newEntry: FavoriteRoom = {
    id: room.id,
    name: room.name,
    hostName: room.hostName,
    savedAt: now,
  };
  return {
    updatedList: [newEntry, ...existing],
    isFavorited: true,
  };
}

export function estimateCacheKb(rawStrings: string[]): number {
  let totalBytes = 0;
  for (const s of rawStrings) {
    totalBytes += Buffer.byteLength(s, 'utf8');
  }
  return Math.max(1, Math.round(totalBytes / 1024));
}

export function toggleFavoriteTrackPure(
  existing: { track_uri: string }[],
  track: { track_uri: string; track_name: string },
): { updatedList: any[]; isFavorited: boolean } {
  const exists = existing.some((t) => t.track_uri === track.track_uri);
  if (exists) {
    return {
      updatedList: existing.filter((t) => t.track_uri !== track.track_uri),
      isFavorited: false,
    };
  }
  return {
    updatedList: [track, ...existing],
    isFavorited: true,
  };
}

export function addTrackToPlaylistPure(
  tracks: { track_uri: string }[],
  newTrack: { track_uri: string; track_name: string },
): { updatedTracks: any[]; added: boolean } {
  const exists = tracks.some((t) => t.track_uri === newTrack.track_uri);
  if (exists) return { updatedTracks: tracks, added: false };
  return { updatedTracks: [...tracks, newTrack], added: true };
}

describe('Local Storage & History Cache Engine', () => {
  it('adds new played track to the top of recently played list', () => {
    const list: PlayedTrack[] = [];
    const updated = addPlayedTrack(list, {
      track_uri: 'yt:song1',
      track_name: 'Midnight Chill',
      artist: 'DJ LoFi',
    }, 1000);

    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].track_name, 'Midnight Chill');
    assert.strictEqual(updated[0].playedAt, 1000);
  });

  it('suppresses duplicate plays within 2 minutes', () => {
    const initial: PlayedTrack[] = [
      {
        track_uri: 'yt:song1',
        track_name: 'Midnight Chill',
        artist: 'DJ LoFi',
        playedAt: 1000,
      },
    ];

    // Attempt re-play 30 seconds later
    const updated = addPlayedTrack(initial, {
      track_uri: 'yt:song1',
      track_name: 'Midnight Chill',
      artist: 'DJ LoFi',
    }, 31000);

    assert.strictEqual(updated.length, 1);
    assert.strictEqual(updated[0].playedAt, 1000); // Kept original timestamp
  });

  it('caps recently played tracks at exactly 50 entries', () => {
    let list: PlayedTrack[] = [];
    for (let i = 0; i < 60; i++) {
      list = addPlayedTrack(list, {
        track_uri: `yt:song_${i}`,
        track_name: `Song ${i}`,
        artist: 'Artist',
      }, i * 200_000);
    }

    assert.strictEqual(list.length, 50);
    assert.strictEqual(list[0].track_name, 'Song 59'); // Most recent at top
  });

  it('correctly toggles favorite room pin and unpin', () => {
    const initial: FavoriteRoom[] = [];
    const pinRes = toggleFavorite(initial, { id: 'room-1', name: 'Lofi Lounge', hostName: 'Alice' });
    assert.strictEqual(pinRes.isFavorited, true);
    assert.strictEqual(pinRes.updatedList.length, 1);

    const unpinRes = toggleFavorite(pinRes.updatedList, { id: 'room-1', name: 'Lofi Lounge' });
    assert.strictEqual(unpinRes.isFavorited, false);
    assert.strictEqual(unpinRes.updatedList.length, 0);
  });

  it('accumulates listening stats and deduplicates unique rooms visited', () => {
    let stats: ListeningStats = {
      totalTracksJammed: 5,
      totalMinutesJammed: 15,
      roomsVisited: ['room-a'],
    };

    stats = updateStats(stats, 1, 3, 'room-a'); // Same room
    assert.strictEqual(stats.totalTracksJammed, 6);
    assert.strictEqual(stats.totalMinutesJammed, 18);
    assert.strictEqual(stats.roomsVisited.length, 1);

    stats = updateStats(stats, 1, 4, 'room-b'); // New room
    assert.strictEqual(stats.totalTracksJammed, 7);
    assert.strictEqual(stats.totalMinutesJammed, 22);
    assert.strictEqual(stats.roomsVisited.length, 2);
  });

  it('calculates cache usage in KB accurately', () => {
    const data = ['a'.repeat(2048), 'b'.repeat(2048)];
    const kb = estimateCacheKb(data);
    assert.strictEqual(kb, 4); // 4096 bytes = 4 KB
  });

  it('correctly toggles favorite track in offline storage', () => {
    const initial: { track_uri: string; track_name: string }[] = [];
    const res1 = toggleFavoriteTrackPure(initial, { track_uri: 'yt:1', track_name: 'Chill Beat' });
    assert.strictEqual(res1.isFavorited, true);
    assert.strictEqual(res1.updatedList.length, 1);

    const res2 = toggleFavoriteTrackPure(res1.updatedList, { track_uri: 'yt:1', track_name: 'Chill Beat' });
    assert.strictEqual(res2.isFavorited, false);
    assert.strictEqual(res2.updatedList.length, 0);
  });

  it('adds tracks to offline playlist and prevents duplicate entries', () => {
    const playlist = [{ track_uri: 'yt:1', track_name: 'Song 1' }];
    const res1 = addTrackToPlaylistPure(playlist, { track_uri: 'yt:2', track_name: 'Song 2' });
    assert.strictEqual(res1.added, true);
    assert.strictEqual(res1.updatedTracks.length, 2);

    const res2 = addTrackToPlaylistPure(res1.updatedTracks, { track_uri: 'yt:1', track_name: 'Song 1' });
    assert.strictEqual(res2.added, false);
    assert.strictEqual(res2.updatedTracks.length, 2);
  });
});
