import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Spotify Fullscreen Player & Precision Scrubber Suite', () => {
  it('calculates continuous vertical deflection damping smoothly without jumps', () => {
    function computeDeflectionSpeed(deflectionY: number): number {
      const activeDeflection = Math.max(0, deflectionY - 30);
      return Math.max(0.1, Math.min(1.0, 1.0 - 0.009 * activeDeflection));
    }

    // Near the bar (deflection <= 30) -> 1.0 full speed
    assert.equal(computeDeflectionSpeed(0), 1.0);
    assert.equal(computeDeflectionSpeed(15), 1.0);
    assert.equal(computeDeflectionSpeed(30), 1.0);

    // Mid deflection (Y = 60 -> active 30) -> 1.0 - 0.27 = 0.73
    const speedAt60 = computeDeflectionSpeed(60);
    assert.ok(Math.abs(speedAt60 - 0.73) < 0.001);

    // Deep deflection (Y = 90 -> active 60) -> 1.0 - 0.54 = 0.46
    const speedAt90 = computeDeflectionSpeed(90);
    assert.ok(Math.abs(speedAt90 - 0.46) < 0.001);

    // Extreme deflection (Y >= 130) -> Clamped to 0.1 (fine scrubbing)
    assert.ok(Math.abs(computeDeflectionSpeed(130) - 0.1) < 0.001);
    assert.ok(Math.abs(computeDeflectionSpeed(250) - 0.1) < 0.001);
  });

  it('maps precision scrub speeds to intuitive user feedback pills', () => {
    function getScrubPillLabel(speed: number): string {
      if (speed <= 0.25) return 'Fine Scrubbing (0.1x)';
      if (speed <= 0.55) return 'Quarter-Speed Scrubbing (0.25x)';
      if (speed < 0.95) return 'Half-Speed Scrubbing (0.5x)';
      return 'Normal Speed';
    }

    assert.equal(getScrubPillLabel(0.1), 'Fine Scrubbing (0.1x)');
    assert.equal(getScrubPillLabel(0.2), 'Fine Scrubbing (0.1x)');
    assert.equal(getScrubPillLabel(0.4), 'Quarter-Speed Scrubbing (0.25x)');
    assert.equal(getScrubPillLabel(0.7), 'Half-Speed Scrubbing (0.5x)');
    assert.equal(getScrubPillLabel(1.0), 'Normal Speed');
  });

  it('generates deterministic ambient palette with valid contrast stops', () => {
    // Basic mock of getAmbientPalette logic
    const CURATED = [
      { top: '#3a200a', mid: '#1d1005', bottom: '#08080a', accent: '#ff9f1c' },
      { top: '#24123a', mid: '#12091d', bottom: '#08080a', accent: '#a855f7' },
      { top: '#380e22', mid: '#1c0711', bottom: '#08080a', accent: '#f43f5e' },
      { top: '#0a2e1d', mid: '#05170e', bottom: '#08080a', accent: '#10b981' },
    ];

    function hash(str: string): number {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h);
    }

    function pickPalette(name: string, artist: string) {
      const idx = hash(`${name}:${artist}`) % CURATED.length;
      return CURATED[idx];
    }

    const p1 = pickPalette('Midnight City', 'M83');
    const p2 = pickPalette('Midnight City', 'M83');
    assert.deepEqual(p1, p2, 'Same metadata must produce identical deterministic palette');

    // All palettes have valid hex format
    assert.match(p1.top, /^#[0-9a-fA-F]{6}$/);
    assert.match(p1.mid, /^#[0-9a-fA-F]{6}$/);
    assert.match(p1.bottom, /^#[0-9a-fA-F]{6}$/);
    assert.match(p1.accent, /^#[0-9a-fA-F]{6}$/);
  });

  it('calculates dynamic artwork size without exceeding viewport clearance across form factors', () => {
    function computeDynamicArtworkSize(
      screenWidth: number,
      screenHeight: number,
      insetsTop: number,
      insetsBottom: number,
      hasLyrics = false,
    ): number {
      const availableArtworkHeight = Math.max(
        160,
        screenHeight - insetsTop - insetsBottom - (hasLyrics ? 370 : 315),
      );
      return Math.floor(
        Math.min(screenWidth - 48, Math.min(330, availableArtworkHeight)),
      );
    }

    // 1. Compact screen (360 x 640, top: 24, bottom: 16)
    const compactSize = computeDynamicArtworkSize(360, 640, 24, 16);
    assert.equal(compactSize, 285);
    // Total vertical content clearance: artwork (285) + controls (315) + insets (40) = 640 <= 640
    assert.ok(compactSize + 315 + 40 <= 640);

    // 2. Ultra-short screen / split screen (360 x 560, top: 24, bottom: 0)
    const splitSize = computeDynamicArtworkSize(360, 560, 24, 0);
    assert.equal(splitSize, 221);
    assert.ok(splitSize + 315 + 24 <= 560);

    // 3. Modern tall screen (393 x 852, top: 47, bottom: 34)
    const tallSize = computeDynamicArtworkSize(393, 852, 47, 34);
    assert.equal(tallSize, 330); // hits max 330 clamp cleanly

    // 4. Compact screen with active lyrics card (360 x 640)
    const compactLyricsSize = computeDynamicArtworkSize(360, 640, 24, 16, true);
    assert.equal(compactLyricsSize, 230);
    assert.ok(compactLyricsSize + 370 + 40 <= 640);
  });

  it('determines effective bottom insets for Unified MiniPlayer ensuring comfortable margin from screen edge', () => {
    function computeEffectiveBottom(bottomOffset = 0, insetsBottom = 0): number {
      return Math.max(bottomOffset, insetsBottom, 10);
    }

    // 3-button nav (insets.bottom == 0, no bottomOffset) -> guarantees 10dp clearance
    assert.equal(computeEffectiveBottom(0, 0), 10);

    // Gesture navigation (insets.bottom == 24) -> sits cleanly at 24dp above screen edge
    assert.equal(computeEffectiveBottom(0, 24), 24);

    // Elevated tab bar (bottomOffset == 60) -> respects custom caller offset
    assert.equal(computeEffectiveBottom(60, 0), 60);
    assert.equal(computeEffectiveBottom(60, 24), 60);
  });
});
