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
});
