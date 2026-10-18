import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { VaultTrack, VaultStats } from '../src/storage/vault.ts';

export function formatBytesPure(bytes: number): string {
  if (!bytes || bytes <= 0 || !isFinite(bytes)) return '0.0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1000) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function calculateVaultStatsPure(
  tracks: VaultTrack[],
  budgetBytes = 1024 * 1024 * 1024,
): VaultStats {
  const totalTracks = tracks.length;
  const totalBytes = tracks.reduce((sum, t) => sum + (t.file_size_bytes || 0), 0);
  const percentUsed = Math.min(100, Math.round((totalBytes / budgetBytes) * 100));

  return {
    totalTracks,
    totalBytes,
    formattedSize: formatBytesPure(totalBytes),
    storageBudgetBytes: budgetBytes,
    percentUsed,
  };
}

export function pruneLruVaultPure(
  tracks: VaultTrack[],
  maxBytes: number,
): { kept: VaultTrack[]; evicted: VaultTrack[] } {
  let currentBytes = tracks.reduce((s, t) => s + (t.file_size_bytes || 0), 0);
  if (currentBytes <= maxBytes) {
    return { kept: [...tracks], evicted: [] };
  }

  const liked = tracks.filter((t) => t.is_liked);
  const unliked = tracks.filter((t) => !t.is_liked).sort((a, b) => a.last_played_at - b.last_played_at);

  const keptUnliked: VaultTrack[] = [];
  const evicted: VaultTrack[] = [];

  for (const track of unliked) {
    if (currentBytes > maxBytes) {
      currentBytes -= track.file_size_bytes || 0;
      evicted.push(track);
    } else {
      keptUnliked.push(track);
    }
  }

  return {
    kept: [...liked, ...keptUnliked],
    evicted,
  };
}

export function filterSessionTracksToDownloadPure(
  nowPlaying: { track_uri?: string; track_name?: string; artist?: string; album_art_url?: string; duration_ms?: number } | null,
  queue: Array<{ track_uri?: string; track_name?: string; artist?: string; album_art_url?: string; duration_ms?: number }>,
  existingVaultUris: Set<string>,
) {
  const result: any[] = [];
  const seenUris = new Set<string>();

  if (nowPlaying?.track_uri) {
    seenUris.add(nowPlaying.track_uri);
    if (!existingVaultUris.has(nowPlaying.track_uri)) {
      result.push(nowPlaying);
    }
  }

  for (const item of queue) {
    if (!item?.track_uri) continue;
    if (seenUris.has(item.track_uri)) continue;
    seenUris.add(item.track_uri);

    if (!existingVaultUris.has(item.track_uri)) {
      result.push({
        track_uri: item.track_uri,
        track_name: item.track_name || 'Queued Track',
        artist: item.artist || 'Unknown Artist',
        album_art_url: item.album_art_url,
        duration_ms: item.duration_ms,
      });
    }
  }

  return result;
}

describe('OpenJam Offline Audio Vault & Storage Engine', () => {
  it('formats byte sizes cleanly for UI gauges', () => {
    assert.strictEqual(formatBytesPure(0), '0.0 MB');
    assert.strictEqual(formatBytesPure(-500), '0.0 MB');
    assert.strictEqual(formatBytesPure(NaN), '0.0 MB');
    assert.strictEqual(formatBytesPure(1024 * 1024 * 4.5), '4.5 MB');
    assert.strictEqual(formatBytesPure(1024 * 1024 * 1024 * 1.25), '1.25 GB');
  });

  it('calculates aggregate vault statistics and budget percentages', () => {
    const mockTracks: VaultTrack[] = [
      {
        track_uri: 'yt:11111111111',
        track_name: 'Sunset Lofi',
        artist: 'Chillhop',
        duration_ms: 180000,
        local_file_uri: 'file:///data/user/0/fun.openjam.app/files/openjam_audio/1.m4a',
        file_size_bytes: 1024 * 1024 * 200, // 200 MB
        downloaded_at: 1000,
        is_liked: true,
        last_played_at: 2000,
        play_count: 5,
      },
      {
        track_uri: 'yt:22222222222',
        track_name: 'Midnight Synth',
        artist: 'RetroWave',
        duration_ms: 210000,
        local_file_uri: 'file:///data/user/0/fun.openjam.app/files/openjam_audio/2.m4a',
        file_size_bytes: 1024 * 1024 * 300, // 300 MB
        downloaded_at: 1200,
        is_liked: false,
        last_played_at: 1500,
        play_count: 2,
      },
    ];

    const stats = calculateVaultStatsPure(mockTracks, 1024 * 1024 * 1000); // 1000 MB limit
    assert.strictEqual(stats.totalTracks, 2);
    assert.strictEqual(stats.totalBytes, 1024 * 1024 * 500); // 500 MB
    assert.strictEqual(stats.percentUsed, 50); // 500 / 1000 = 50%
    assert.strictEqual(stats.formattedSize, '500.0 MB');
  });

  it('prunes unliked tracks when storage budget is exceeded without evicting liked songs', () => {
    const likedTrack: VaultTrack = {
      track_uri: 'yt:liked_1',
      track_name: 'Favorite Anthem',
      artist: 'Star Artist',
      duration_ms: 200000,
      local_file_uri: 'file:///data/user/0/fun.openjam.app/files/openjam_audio/liked_1.m4a',
      file_size_bytes: 1000,
      downloaded_at: 1000,
      is_liked: true, // LIKED
      last_played_at: 1000, // Oldest play time, but MUST BE PRESERVED
      play_count: 10,
    };

    const oldUnlikedTrack: VaultTrack = {
      track_uri: 'yt:unliked_old',
      track_name: 'Random Track 1',
      artist: 'DJ A',
      duration_ms: 180000,
      local_file_uri: 'file:///data/user/0/fun.openjam.app/files/openjam_audio/unliked_old.m4a',
      file_size_bytes: 2000,
      downloaded_at: 2000,
      is_liked: false,
      last_played_at: 2000, // Older unliked -> Should be evicted first
      play_count: 1,
    };

    const recentUnlikedTrack: VaultTrack = {
      track_uri: 'yt:unliked_recent',
      track_name: 'Fresh Jam',
      artist: 'DJ B',
      duration_ms: 190000,
      local_file_uri: 'file:///data/user/0/fun.openjam.app/files/openjam_audio/unliked_recent.m4a',
      file_size_bytes: 2000,
      downloaded_at: 3000,
      is_liked: false,
      last_played_at: 5000, // More recent unliked
      play_count: 3,
    };

    const tracks = [likedTrack, oldUnlikedTrack, recentUnlikedTrack]; // Total = 5000 bytes
    const budget = 3500; // Limit is 3500 bytes

    const result = pruneLruVaultPure(tracks, budget);

    // Old unliked track (2000 bytes) should be evicted
    assert.strictEqual(result.evicted.length, 1);
    assert.strictEqual(result.evicted[0].track_uri, 'yt:unliked_old');

    // Kept tracks should include liked track and recent unliked track (1000 + 2000 = 3000 <= 3500)
    assert.strictEqual(result.kept.length, 2);
    assert.ok(result.kept.some((t) => t.track_uri === 'yt:liked_1'));
    assert.ok(result.kept.some((t) => t.track_uri === 'yt:unliked_recent'));
  });

  it('keeps all tracks when storage usage is safely under budget limit', () => {
    const tracks: VaultTrack[] = [
      {
        track_uri: 'yt:1',
        track_name: 'Track 1',
        artist: 'Artist 1',
        duration_ms: 100000,
        local_file_uri: 'file:///path/1.m4a',
        file_size_bytes: 1000,
        downloaded_at: 1000,
        is_liked: false,
        last_played_at: 1000,
        play_count: 1,
      },
    ];

    const result = pruneLruVaultPure(tracks, 10000);
    assert.strictEqual(result.evicted.length, 0);
    assert.strictEqual(result.kept.length, 1);
  });

  it('extracts and deduplicates session tracks for 1-tap vault download', () => {
    const nowPlaying = {
      track_uri: 'yt:now_playing',
      track_name: 'Live Song',
      artist: 'Main Artist',
    };
    const queue = [
      { track_uri: 'yt:upcoming_1', track_name: 'Track 1', artist: 'Artist A' },
      { track_uri: 'yt:upcoming_2', track_name: 'Track 2', artist: 'Artist B' },
      { track_uri: 'yt:now_playing', track_name: 'Duplicate Live Song', artist: 'Main Artist' },
      { track_uri: 'yt:upcoming_1', track_name: 'Duplicate Track 1', artist: 'Artist A' },
    ];
    const existingUris = new Set<string>(['yt:upcoming_2']); // Track 2 is already saved

    const toDownload = filterSessionTracksToDownloadPure(nowPlaying, queue, existingUris);

    // Should return nowPlaying and upcoming_1 only (2 items), omitting duplicates and already saved tracks
    assert.strictEqual(toDownload.length, 2);
    assert.strictEqual(toDownload[0].track_uri, 'yt:now_playing');
    assert.strictEqual(toDownload[1].track_uri, 'yt:upcoming_1');
  });

  it('returns empty array when all session tracks are already in vault or session is empty', () => {
    const existingUris = new Set<string>(['yt:1', 'yt:2']);
    const nowPlaying = { track_uri: 'yt:1', track_name: 'Song 1', artist: 'Artist' };
    const queue = [{ track_uri: 'yt:2', track_name: 'Song 2', artist: 'Artist' }];

    const toDownload = filterSessionTracksToDownloadPure(nowPlaying, queue, existingUris);
    assert.strictEqual(toDownload.length, 0);

    const emptyDownload = filterSessionTracksToDownloadPure(null, [], existingUris);
    assert.strictEqual(emptyDownload.length, 0);
  });

  describe('Downloaded Audio Validation', () => {
    function isValidDownloadedAudio(
      sizeBytes: number,
      contentType?: string,
      httpStatus?: number,
    ): boolean {
      if (httpStatus !== undefined && (httpStatus < 200 || httpStatus >= 300)) {
        return false;
      }
      if (contentType) {
        const ct = contentType.toLowerCase();
        if (ct.includes('html') || ct.includes('json') || ct.includes('text')) {
          return false;
        }
      }
      return Number.isFinite(sizeBytes) && sizeBytes >= 32768;
    }

    it('rejects HTTP error status codes', () => {
      assert.strictEqual(isValidDownloadedAudio(100000, 'audio/mp4', 403), false);
      assert.strictEqual(isValidDownloadedAudio(100000, 'audio/mp4', 404), false);
      assert.strictEqual(isValidDownloadedAudio(100000, 'audio/mp4', 500), false);
      assert.strictEqual(isValidDownloadedAudio(100000, 'audio/mp4', 200), true);
      assert.strictEqual(isValidDownloadedAudio(100000, 'audio/mp4', 206), true);
    });

    it('rejects HTML/JSON error payloads regardless of status', () => {
      assert.strictEqual(isValidDownloadedAudio(50000, 'text/html; charset=utf-8', 200), false);
      assert.strictEqual(isValidDownloadedAudio(50000, 'application/json', 200), false);
    });

    it('rejects files below minimum 32KB audio threshold', () => {
      assert.strictEqual(isValidDownloadedAudio(1200, 'audio/mp4', 200), false);
      assert.strictEqual(isValidDownloadedAudio(32767, 'audio/mp4', 200), false);
      assert.strictEqual(isValidDownloadedAudio(32768, 'audio/mp4', 200), true);
      assert.strictEqual(isValidDownloadedAudio(2500000, 'audio/mp4', 200), true);
    });
  });

  describe('Collaborative Vault Track Matching', () => {
    function extractVideoId(uri: string): string | null {
      if (!uri) return null;
      const clean = uri.trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
      if (clean.startsWith('yt:')) {
        const sub = clean.slice(3).trim();
        if (/^[a-zA-Z0-9_-]{11}$/.test(sub)) return sub;
      }
      const match = clean.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/);
      if (match && match[1]) return match[1];
      return null;
    }

    function matchVaultTrackPure(
      tracks: VaultTrack[],
      trackUri: string,
      meta?: { title?: string; artist?: string },
    ): VaultTrack | null {
      if (!trackUri && !meta?.title) return null;
      if (!tracks || tracks.length === 0) return null;

      const byUri = tracks.find((t) => t.track_uri === trackUri);
      if (byUri) return byUri;

      const targetId = extractVideoId(trackUri);
      if (targetId) {
        const byId = tracks.find((t) => extractVideoId(t.track_uri) === targetId);
        if (byId) return byId;
      }

      if (meta?.title && meta?.artist) {
        const cleanTitle = meta.title.trim().toLowerCase();
        const cleanArtist = meta.artist.trim().toLowerCase();
        const byMeta = tracks.find(
          (t) =>
            t.track_name.trim().toLowerCase() === cleanTitle &&
            t.artist.trim().toLowerCase() === cleanArtist,
        );
        if (byMeta) return byMeta;
      }

      return null;
    }

    const mockVault: VaultTrack[] = [
      {
        track_uri: 'yt:dQw4w9WgXcQ',
        track_name: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        local_file_uri: 'file:///vault/rick.m4a',
        downloaded_at: Date.now(),
        file_size_bytes: 4000000,
        is_liked: true,
        last_played_at: Date.now(),
      },
      {
        track_uri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
        track_name: 'Starboy',
        artist: 'The Weeknd',
        local_file_uri: 'file:///vault/starboy.m4a',
        downloaded_at: Date.now(),
        file_size_bytes: 3500000,
        is_liked: false,
        last_played_at: Date.now(),
      },
    ];

    it('matches track by exact URI', () => {
      const match = matchVaultTrackPure(mockVault, 'yt:dQw4w9WgXcQ');
      assert.strictEqual(match?.local_file_uri, 'file:///vault/rick.m4a');
    });

    it('matches track by cross-format YouTube URL and ID', () => {
      const match = matchVaultTrackPure(mockVault, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.strictEqual(match?.local_file_uri, 'file:///vault/rick.m4a');
    });

    it('matches collaborative room track by title and artist when URI differs', () => {
      const match = matchVaultTrackPure(
        mockVault,
        'https://invidious.snopyta.org/watch?v=different_id',
        { title: 'Starboy', artist: 'The Weeknd' },
      );
      assert.strictEqual(match?.local_file_uri, 'file:///vault/starboy.m4a');
    });

    it('returns null safely when track is not in vault', () => {
      const match = matchVaultTrackPure(mockVault, 'yt:unknown12345', { title: 'Unknown', artist: 'Nobody' });
      assert.strictEqual(match, null);
    });
  });

  describe('Offline Playback Filtering Seam', () => {
    function filterOfflinePlayableTracksPure(
      tracks: Array<{ track_uri: string }>,
      vaultUris: Set<string>,
      isOnline: boolean,
    ) {
      if (isOnline) return tracks;
      return tracks.filter((t) => vaultUris.has(t.track_uri));
    }

    it('returns only downloaded tracks when offline', () => {
      const allTracks = [
        { track_uri: 'yt:1', track_name: 'Downloaded' },
        { track_uri: 'yt:2', track_name: 'Online Only' },
      ];
      const vaultUris = new Set(['yt:1']);
      const offlinePlayable = filterOfflinePlayableTracksPure(allTracks, vaultUris, false);
      assert.strictEqual(offlinePlayable.length, 1);
      assert.strictEqual(offlinePlayable[0].track_uri, 'yt:1');
    });

    it('returns all tracks when online', () => {
      const allTracks = [
        { track_uri: 'yt:1', track_name: 'Downloaded' },
        { track_uri: 'yt:2', track_name: 'Online Only' },
      ];
      const vaultUris = new Set(['yt:1']);
      const onlinePlayable = filterOfflinePlayableTracksPure(allTracks, vaultUris, true);
      assert.strictEqual(onlinePlayable.length, 2);
    });
  });
});

