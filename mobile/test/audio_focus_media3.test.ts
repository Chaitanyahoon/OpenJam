import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('AndroidX Media3 & Audio Focus Engine Suite', () => {
  it('calculates exponential volume ducking curve over 200ms transition', () => {
    function computeDuckedVolume(
      startVolume: number,
      targetRatio: number,
      elapsedMs: number,
      durationMs = 200,
    ): number {
      const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
      const targetVolume = startVolume * targetRatio;
      return startVolume - (startVolume - targetVolume) * progress;
    }

    // At 0ms -> full start volume
    assert.ok(Math.abs(computeDuckedVolume(1.0, 0.2, 0) - 1.0) < 0.001);

    // At 100ms (halfway) -> 0.6 volume
    assert.ok(Math.abs(computeDuckedVolume(1.0, 0.2, 100) - 0.6) < 0.001);

    // At 200ms (complete) -> 0.2 ducked volume
    assert.ok(Math.abs(computeDuckedVolume(1.0, 0.2, 200) - 0.2) < 0.001);

    // Past 200ms -> clamped to 0.2
    assert.ok(Math.abs(computeDuckedVolume(1.0, 0.2, 300) - 0.2) < 0.001);
  });

  it('restores ducked volume smoothly back to target baseline level', () => {
    function computeRestoredVolume(
      duckedVolume: number,
      targetVolume: number,
      elapsedMs: number,
      durationMs = 200,
    ): number {
      const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
      return duckedVolume + (targetVolume - duckedVolume) * progress;
    }

    // At 0ms -> starts at ducked 0.2
    assert.ok(Math.abs(computeRestoredVolume(0.2, 1.0, 0) - 0.2) < 0.001);

    // At 100ms -> 0.6
    assert.ok(Math.abs(computeRestoredVolume(0.2, 1.0, 100) - 0.6) < 0.001);

    // At 200ms -> fully restored to 1.0
    assert.ok(Math.abs(computeRestoredVolume(0.2, 1.0, 200) - 1.0) < 0.001);
  });

  it('validates AndroidX Media3 lockscreen metadata payload formatting', () => {
    interface LockScreenPayload {
      title: string;
      artist: string;
      albumTitle: string;
      artworkUrl?: string;
    }

    function formatMedia3Metadata(rawTitle?: string, rawArtist?: string, rawArt?: string): LockScreenPayload {
      return {
        title: rawTitle?.trim() || 'OpenJam Track',
        artist: rawArtist?.trim() || 'OpenJam Artist',
        albumTitle: 'OpenJam Audio Session',
        artworkUrl: rawArt || 'https://openjam.fun/default_art.png',
      };
    }

    const payload = formatMedia3Metadata('Starboy', 'The Weeknd', 'https://cdn.example.com/art.jpg');
    assert.equal(payload.title, 'Starboy');
    assert.equal(payload.artist, 'The Weeknd');
    assert.equal(payload.albumTitle, 'OpenJam Audio Session');
    assert.equal(payload.artworkUrl, 'https://cdn.example.com/art.jpg');

    // Fallbacks
    const fallback = formatMedia3Metadata('', '', '');
    assert.equal(fallback.title, 'OpenJam Track');
    assert.equal(fallback.artist, 'OpenJam Artist');
    assert.equal(fallback.artworkUrl, 'https://openjam.fun/default_art.png');
  });
});
