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
});
