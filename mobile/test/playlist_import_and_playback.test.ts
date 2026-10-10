import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeTrack } from '../src/storage/history.ts';
import type { TrackInfo } from '../src/sync/protocol.ts';

function bulkAddTracksPure(
  existingTracks: TrackInfo[],
  incomingTracks: any[],
): { updatedTracks: TrackInfo[]; addedCount: number } {
  let addedCount = 0;
  const existingUris = new Set(existingTracks.map((t) => t.track_uri));
  const result = [...existingTracks];

  for (const raw of incomingTracks) {
    const norm = normalizeTrack(raw);
    if (norm.track_uri && !existingUris.has(norm.track_uri)) {
      result.push(norm);
      existingUris.add(norm.track_uri);
      addedCount++;
    }
  }

  return { updatedTracks: result, addedCount };
}

function resolvePlaylistTapToPlay(
  selectedTrack: TrackInfo,
  allTracks: TrackInfo[],
  sourceTitle: string,
): { activeTrack: TrackInfo; queue: TrackInfo[]; startIndex: number; source: string } {
  const index = allTracks.findIndex((t) => t.track_uri === selectedTrack.track_uri);
  return {
    activeTrack: selectedTrack,
    queue: allTracks,
    startIndex: index >= 0 ? index : 0,
    source: sourceTitle,
  };
}

describe('Playlist Normalization, Bulk Append & 1-Tap Playback Suite', () => {
  it('correctly normalizes standard OpenJam TrackInfo format', () => {
    const raw = {
      track_uri: 'yt:abc12345678',
      track_name: 'Solar Drift',
      artist: 'Aura',
      album_art_url: 'https://cdn.openjam.fun/art/1.jpg',
      duration_ms: 240000,
    };
    const norm = normalizeTrack(raw);
    assert.strictEqual(norm.track_uri, 'yt:abc12345678');
    assert.strictEqual(norm.track_name, 'Solar Drift');
    assert.strictEqual(norm.artist, 'Aura');
    assert.strictEqual(norm.album_art_url, 'https://cdn.openjam.fun/art/1.jpg');
    assert.strictEqual(norm.duration_ms, 240000);
  });

  it('correctly maps external Spotify & YouTube importer properties (uri, name, thumbnail)', () => {
    const ytRaw = {
      uri: 'dQw4w9WgXcQ',
      name: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg',
    };
    const norm = normalizeTrack(ytRaw);
    assert.strictEqual(norm.track_uri, 'dQw4w9WgXcQ');
    assert.strictEqual(norm.track_name, 'Never Gonna Give You Up');
    assert.strictEqual(norm.artist, 'Rick Astley');
    assert.strictEqual(norm.album_art_url, 'https://img.youtube.com/vi/dQw4w9WgXcQ/0.jpg');
    assert.strictEqual(norm.duration_ms, 0);
  });

  it('provides safe fallbacks for missing name and artist', () => {
    const sparse = { uri: 'yt:unknown123' };
    const norm = normalizeTrack(sparse);
    assert.strictEqual(norm.track_uri, 'yt:unknown123');
    assert.strictEqual(norm.track_name, 'Unknown Track');
    assert.strictEqual(norm.artist, 'Unknown Artist');
    assert.strictEqual(norm.album_art_url, undefined);
  });

  it('bulk appends new tracks to playlist while filtering duplicates', () => {
    const existing: TrackInfo[] = [
      {
        track_uri: 'yt:song1',
        track_name: 'Existing Song 1',
        artist: 'Artist 1',
      },
    ];

    const incoming = [
      { uri: 'yt:song1', name: 'Existing Song 1', artist: 'Artist 1' }, // Duplicate
      { uri: 'yt:song2', name: 'New Song 2', artist: 'Artist 2' },      // Fresh
      { track_uri: 'yt:song3', track_name: 'New Song 3', artist: 'Artist 3' }, // Fresh
    ];

    const { updatedTracks, addedCount } = bulkAddTracksPure(existing, incoming);
    assert.strictEqual(addedCount, 2);
    assert.strictEqual(updatedTracks.length, 3);
    assert.strictEqual(updatedTracks[1].track_name, 'New Song 2');
    assert.strictEqual(updatedTracks[2].track_name, 'New Song 3');
  });

  it('resolves 1-tap track playback cleanly with complete playlist queue', () => {
    const playlist: TrackInfo[] = [
      { track_uri: 'yt:a', track_name: 'Song A', artist: 'Art A' },
      { track_uri: 'yt:b', track_name: 'Song B', artist: 'Art B' },
      { track_uri: 'yt:c', track_name: 'Song C', artist: 'Art C' },
    ];

    const tapped = playlist[1]; // Tapping 'Song B'
    const playState = resolvePlaylistTapToPlay(tapped, playlist, 'Summer Vibes');

    assert.strictEqual(playState.activeTrack.track_uri, 'yt:b');
    assert.strictEqual(playState.startIndex, 1);
    assert.strictEqual(playState.queue.length, 3);
    assert.strictEqual(playState.source, 'Summer Vibes');
  });

  it('never loses upcoming songs when playing from the middle of an imported playlist', () => {
    const playlist: TrackInfo[] = Array.from({ length: 25 }, (_, i) => ({
      track_uri: `yt:track_${i}`,
      track_name: `Track ${i}`,
      artist: `Artist ${i}`,
    }));

    const tapped = playlist[10];
    const playState = resolvePlaylistTapToPlay(tapped, playlist, 'Mega Mix');

    assert.strictEqual(playState.startIndex, 10);
    assert.strictEqual(playState.queue[11].track_name, 'Track 11');
    assert.strictEqual(playState.queue[24].track_name, 'Track 24');
  });
});
