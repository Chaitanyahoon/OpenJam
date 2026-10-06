import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { TrackInfo } from '../src/sync/protocol.ts';

export interface ImportedPlaylistTrack {
  name: string;
  artist: string;
  uri: string;
  album_art_url?: string;
  duration_ms?: number;
}

/** Check if a URL points to an external playlist (Spotify or YouTube/YouTube Music) */
export function isPlaylistUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.includes('spotify.com/playlist/') ||
    clean.includes('music.youtube.com/playlist') ||
    clean.includes('youtube.com/playlist') ||
    ((clean.includes('youtube.com') || clean.includes('youtu.be')) && clean.includes('list='))
  );
}

/**
 * Helper to normalize imported tracks into queue payload format
 */
export function normalizeImportedTracks(
  tracks: ImportedPlaylistTrack[],
): TrackInfo[] {
  return tracks.map((t) => ({
    track_uri: t.uri,
    track_name: t.name,
    artist: t.artist || 'Unknown Artist',
    album_art_url: t.album_art_url,
    duration_ms: t.duration_ms || 0,
  }));
}

/**
 * Helper to prepare socket payload for ADD_MULTIPLE_TO_QUEUE
 */
export function buildAddMultiplePayload(
  roomId: string,
  tracks: TrackInfo[],
) {
  return {
    room_id: roomId,
    tracks: tracks.map((t) => ({
      uri: t.track_uri,
      track_uri: t.track_uri,
      name: t.track_name,
      track_name: t.track_name,
      artist: t.artist,
      album_art_url: t.album_art_url,
      duration_ms: t.duration_ms || 0,
    })),
  };
}

describe('Playlist Import & URL Recognition Engine', () => {
  it('correctly identifies Spotify public playlist URLs', () => {
    assert.strictEqual(
      isPlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'),
      true,
    );
    assert.strictEqual(
      isPlaylistUrl('http://open.spotify.com/playlist/4aawyAB9vmqN3uQFRvBBBv?si=abc123xyz'),
      true,
    );
  });

  it('rejects Spotify single track or album URLs from playlist importer', () => {
    assert.strictEqual(
      isPlaylistUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'),
      false,
    );
    assert.strictEqual(
      isPlaylistUrl('https://open.spotify.com/album/4cOdK2wGLETKBW3PvgPWqT'),
      false,
    );
  });

  it('correctly identifies YouTube and YouTube Music playlist URLs', () => {
    assert.strictEqual(
      isPlaylistUrl('https://www.youtube.com/playlist?list=PLrAl54G7Q8y7441Z2qK1b66kR_sK-R'),
      true,
    );
    assert.strictEqual(
      isPlaylistUrl('https://music.youtube.com/playlist?list=RDCLAK5uy_k1234567890'),
      true,
    );
    assert.strictEqual(
      isPlaylistUrl('https://youtu.be/dQw4w9WgXcQ?list=PLrAl54G7Q8y7441Z2qK1b66kR_sK-R'),
      true,
    );
  });

  it('rejects non-playlist URLs and standard search queries', () => {
    assert.strictEqual(isPlaylistUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), false);
    assert.strictEqual(isPlaylistUrl('The Weeknd Blinding Lights'), false);
    assert.strictEqual(isPlaylistUrl(''), false);
    assert.strictEqual(isPlaylistUrl(null), false);
    assert.strictEqual(isPlaylistUrl(undefined), false);
  });

  it('normalizes imported playlist tracks to unified TrackInfo structure', () => {
    const rawImported: ImportedPlaylistTrack[] = [
      {
        name: 'Save Your Tears',
        artist: 'The Weeknd',
        uri: 'Save Your Tears The Weeknd official audio',
        album_art_url: 'https://img.youtube.com/vi/123/hqdefault.jpg',
        duration_ms: 215000,
      },
      {
        name: 'In Your Eyes',
        artist: '',
        uri: 'yt:in-your-eyes-id',
      },
    ];

    const normalized = normalizeImportedTracks(rawImported);
    assert.strictEqual(normalized.length, 2);
    assert.strictEqual(normalized[0].track_name, 'Save Your Tears');
    assert.strictEqual(normalized[0].artist, 'The Weeknd');
    assert.strictEqual(normalized[0].duration_ms, 215000);

    // Fallback artist check
    assert.strictEqual(normalized[1].artist, 'Unknown Artist');
    assert.strictEqual(normalized[1].duration_ms, 0);
  });

  it('builds valid batch payload for ADD_MULTIPLE_TO_QUEUE socket event', () => {
    const tracks: TrackInfo[] = [
      {
        track_uri: 'yt:11111111111',
        track_name: 'Song A',
        artist: 'Artist A',
        duration_ms: 180000,
      },
      {
        track_uri: 'yt:22222222222',
        track_name: 'Song B',
        artist: 'Artist B',
        album_art_url: 'https://example.com/art.jpg',
        duration_ms: 200000,
      },
    ];

    const payload = buildAddMultiplePayload('room-lounge-42', tracks);
    assert.strictEqual(payload.room_id, 'room-lounge-42');
    assert.strictEqual(payload.tracks.length, 2);
    assert.strictEqual(payload.tracks[0].uri, 'yt:11111111111');
    assert.strictEqual(payload.tracks[0].name, 'Song A');
    assert.strictEqual(payload.tracks[1].album_art_url, 'https://example.com/art.jpg');
  });
});
