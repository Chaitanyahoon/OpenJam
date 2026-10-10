import { describe, it } from 'node:test';
import assert from 'node:assert';

/**
 * Resilient track count resolver logic used across ProfileScreen and ProfileModal.
 */
export function resolvePlaylistTrackCount(item: {
  track_count?: number;
  tracks_count?: number;
  tracks?: any[];
}): number {
  return (
    item.track_count ??
    item.tracks_count ??
    (Array.isArray(item.tracks) ? item.tracks.length : 0)
  );
}

/**
 * Format playlist track count subtitle text with pluralization and offline state.
 */
export function formatPlaylistSubtitle(
  item: { track_count?: number; tracks_count?: number; tracks?: any[] },
  isOffline: boolean = false,
): string {
  const count = resolvePlaylistTrackCount(item);
  return `${count} track${count === 1 ? '' : 's'}${isOffline ? ' • Offline' : ''}`;
}

/**
 * Transform playlist tracks into Player-compatible track queue items.
 */
export function preparePlaylistPlayback(playlist: {
  id: string;
  name: string;
  tracks?: Array<{
    track_uri?: string;
    uri?: string;
    track_name?: string;
    name?: string;
    artist?: string;
    album_art_url?: string;
    duration_ms?: number;
  }>;
}) {
  const rawTracks = playlist.tracks || [];
  if (rawTracks.length === 0) {
    return { canPlay: false, tracks: [], initialTrack: null, sourceTitle: playlist.name };
  }

  const mapped = rawTracks.map((t) => ({
    track_uri: t.track_uri || t.uri || '',
    track_name: t.track_name || t.name || 'Unknown Track',
    artist: t.artist || 'Unknown Artist',
    album_art_url: t.album_art_url,
    duration_ms: t.duration_ms || 0,
  }));

  return {
    canPlay: mapped.length > 0 && !!mapped[0].track_uri,
    tracks: mapped,
    initialTrack: mapped[0],
    sourceTitle: playlist.name,
  };
}

describe('Playlist Track Count & Instant Playback Resilience Suite', () => {
  it('correctly resolves track count when backend provides track_count integer', () => {
    const item = { track_count: 14, name: 'these songs>>' };
    assert.strictEqual(resolvePlaylistTrackCount(item), 14);
    assert.strictEqual(formatPlaylistSubtitle(item), '14 tracks');
  });

  it('correctly resolves track count when backend provides tracks_count alias', () => {
    const item = { tracks_count: 5, name: 'Vibes' };
    assert.strictEqual(resolvePlaylistTrackCount(item), 5);
    assert.strictEqual(formatPlaylistSubtitle(item), '5 tracks');
  });

  it('correctly resolves track count from tracks array when track_count is absent', () => {
    const item = {
      name: 'Offline Stash',
      tracks: [
        { track_uri: 'spotify:track:1', track_name: 'Song 1' },
        { track_uri: 'spotify:track:2', track_name: 'Song 2' },
      ],
    };
    assert.strictEqual(resolvePlaylistTrackCount(item), 2);
    assert.strictEqual(formatPlaylistSubtitle(item, true), '2 tracks • Offline');
  });

  it('handles empty or missing tracks array without NaN or crashing', () => {
    const itemWithNull = { name: 'Empty Playlist', tracks: undefined };
    assert.strictEqual(resolvePlaylistTrackCount(itemWithNull), 0);
    assert.strictEqual(formatPlaylistSubtitle(itemWithNull), '0 tracks');

    const itemSingle = { track_count: 1, name: 'Solo Favorite' };
    assert.strictEqual(formatPlaylistSubtitle(itemSingle), '1 track');
  });

  it('correctly prepares non-blocking 1-tap playback payload for audio engine', () => {
    const playlist = {
      id: 'pl-101',
      name: 'Night Drive',
      tracks: [
        { uri: 'spotify:track:alpha', name: 'Midnight City', artist: 'M83', duration_ms: 240000 },
        { uri: 'spotify:track:beta', name: 'Starboy', artist: 'The Weeknd', duration_ms: 230000 },
      ],
    };

    const prepared = preparePlaylistPlayback(playlist);
    assert.strictEqual(prepared.canPlay, true);
    assert.strictEqual(prepared.sourceTitle, 'Night Drive');
    assert.strictEqual(prepared.tracks.length, 2);
    assert.strictEqual(prepared.initialTrack?.track_uri, 'spotify:track:alpha');
    assert.strictEqual(prepared.initialTrack?.track_name, 'Midnight City');
    assert.strictEqual(prepared.initialTrack?.artist, 'M83');
  });

  it('safely rejects empty playlist playback without audio engine exception', () => {
    const emptyPlaylist = { id: 'pl-102', name: 'Empty Queue', tracks: [] };
    const prepared = preparePlaylistPlayback(emptyPlaylist);
    assert.strictEqual(prepared.canPlay, false);
    assert.strictEqual(prepared.tracks.length, 0);
    assert.strictEqual(prepared.initialTrack, null);
  });
});
