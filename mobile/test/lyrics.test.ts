import { describe, it } from 'node:test';
import assert from 'node:assert';
import { activeLyricIndex, type LyricLine } from '../src/audio/lyrics.ts';

describe('Lyrics Sync Engine', () => {
  const sampleLines: LyricLine[] = [
    { timeMs: 0, text: 'Instrumental Intro' },
    { timeMs: 5000, text: 'First verse starts here' },
    { timeMs: 12500, text: 'Second line of the verse' },
    { timeMs: 25000, text: 'Chorus drop!' },
    { timeMs: 45000, text: 'Guitar solo' },
  ];

  it('returns -1 when lines array is empty', () => {
    assert.strictEqual(activeLyricIndex([], 10000), -1);
  });

  it('identifies initial line before first transition', () => {
    assert.strictEqual(activeLyricIndex(sampleLines, 0), 0);
    assert.strictEqual(activeLyricIndex(sampleLines, 2500), 0);
    assert.strictEqual(activeLyricIndex(sampleLines, 4999), 0);
  });

  it('transitions exactly on the millisecond timestamp', () => {
    assert.strictEqual(activeLyricIndex(sampleLines, 5000), 1);
    assert.strictEqual(activeLyricIndex(sampleLines, 12499), 1);
    assert.strictEqual(activeLyricIndex(sampleLines, 12500), 2);
  });

  it('correctly tracks position during mid-track scrubbing', () => {
    assert.strictEqual(activeLyricIndex(sampleLines, 25000), 3);
    assert.strictEqual(activeLyricIndex(sampleLines, 30000), 3);
  });

  it('holds last line until track completion', () => {
    assert.strictEqual(activeLyricIndex(sampleLines, 45000), 4);
    assert.strictEqual(activeLyricIndex(sampleLines, 120000), 4);
  });
});
