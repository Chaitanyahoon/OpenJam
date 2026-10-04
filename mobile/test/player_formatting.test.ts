import { describe, it } from 'node:test';
import assert from 'node:assert';

export function fmtTimecode(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function calcProgressRatio(posMs: number, durationMs: number): number {
  if (!durationMs || durationMs <= 0 || !isFinite(durationMs)) return 0;
  const clampedPos = Math.max(0, Math.min(posMs, durationMs));
  return clampedPos / durationMs;
}

describe('Player Timecode & Scrubber Calculations', () => {
  it('formats zero and negative durations gracefully as 0:00', () => {
    assert.strictEqual(fmtTimecode(0), '0:00');
    assert.strictEqual(fmtTimecode(-1000), '0:00');
    assert.strictEqual(fmtTimecode(NaN), '0:00');
    assert.strictEqual(fmtTimecode(Infinity), '0:00');
  });

  it('formats single-digit seconds with leading zero', () => {
    assert.strictEqual(fmtTimecode(4000), '0:04');
    assert.strictEqual(fmtTimecode(9000), '0:09');
  });

  it('formats standard song durations accurately', () => {
    assert.strictEqual(fmtTimecode(60000), '1:00');
    assert.strictEqual(fmtTimecode(145000), '2:25');
    assert.strictEqual(fmtTimecode(214000), '3:34');
    assert.strictEqual(fmtTimecode(3600000), '60:00');
  });

  it('clamps scrubber progress ratio between 0.0 and 1.0', () => {
    assert.strictEqual(calcProgressRatio(-500, 180000), 0);
    assert.strictEqual(calcProgressRatio(0, 180000), 0);
    assert.strictEqual(calcProgressRatio(90000, 180000), 0.5);
    assert.strictEqual(calcProgressRatio(180000, 180000), 1.0);
    assert.strictEqual(calcProgressRatio(250000, 180000), 1.0);
  });

  it('handles zero or missing duration safely without division by zero', () => {
    assert.strictEqual(calcProgressRatio(5000, 0), 0);
    assert.strictEqual(calcProgressRatio(5000, -100), 0);
  });
});
