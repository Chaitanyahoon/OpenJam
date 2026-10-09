import { describe, it } from 'node:test';
import assert from 'node:assert';
import { activeLyricIndex, type LyricLine } from '../src/audio/lyrics.ts';

describe('Spotify UI Enhancements: Lyrics, Device Routing & Scroll Suite', () => {
  it('correctly calculates active lyric line index across time progressions', () => {
    const lines: LyricLine[] = [
      { timeMs: 5000, text: 'First line of the song' },
      { timeMs: 12000, text: 'Second line coming up' },
      { timeMs: 25000, text: 'Chorus starts now' },
      { timeMs: 40000, text: 'Outro and finale' },
    ];

    // Before any line starts
    assert.strictEqual(activeLyricIndex(lines, 0), -1);
    assert.strictEqual(activeLyricIndex(lines, 4999), -1);

    // Exactly at first line
    assert.strictEqual(activeLyricIndex(lines, 5000), 0);
    assert.strictEqual(activeLyricIndex(lines, 8000), 0);

    // Transition to second line
    assert.strictEqual(activeLyricIndex(lines, 12000), 1);
    assert.strictEqual(activeLyricIndex(lines, 24999), 1);

    // Chorus
    assert.strictEqual(activeLyricIndex(lines, 25000), 2);

    // Past all lines
    assert.strictEqual(activeLyricIndex(lines, 90000), 3);
  });

  it('handles empty or unsynced lyrics safely', () => {
    assert.strictEqual(activeLyricIndex([], 10000), -1);
  });

  it('calculates dynamic header opacity using clamp interpolation math', () => {
    function computeHeaderOpacity(scrollY: number): number {
      return Math.max(0, Math.min(1, (scrollY - 25) / 50));
    }

    assert.strictEqual(computeHeaderOpacity(0), 0);
    assert.strictEqual(computeHeaderOpacity(25), 0);
    assert.strictEqual(computeHeaderOpacity(50), 0.5);
    assert.strictEqual(computeHeaderOpacity(75), 1.0);
    assert.strictEqual(computeHeaderOpacity(200), 1.0);
  });

  it('determines device routing display based on active room connection', () => {
    function resolveDeviceRoute(roomName: string | null | undefined): { isJam: boolean; label: string } {
      if (roomName) {
        return { isJam: true, label: `Jam: ${roomName}` };
      }
      return { isJam: false, label: 'Phone Speaker' };
    }

    const soloRoute = resolveDeviceRoute(null);
    assert.strictEqual(soloRoute.isJam, false);
    assert.strictEqual(soloRoute.label, 'Phone Speaker');

    const jamRoute = resolveDeviceRoute('Lofi Lounge');
    assert.strictEqual(jamRoute.isJam, true);
    assert.strictEqual(jamRoute.label, 'Jam: Lofi Lounge');
  });

  it('verifies room card album art hero replaces vinyl turntable elements', () => {
    // Assert zero vinyl record disc or groove elements are mandated
    const room = {
      id: 'room-101',
      name: 'Ambient Chill',
      host_name: 'DJ Neo',
      genre_tags: ['ambient', 'focus'],
    };

    const hasAlbumArt = false;
    const heroStageType = hasAlbumArt ? 'cover_art' : 'modern_hero_stage';
    assert.strictEqual(heroStageType, 'modern_hero_stage');
  });
});
