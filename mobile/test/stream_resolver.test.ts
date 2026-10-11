import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure stream classifier extracted for testing stream resolver seam
 */
export function classifyStreamInput(input: string): {
  isLocalFile: boolean;
  isHttpUrl: boolean;
  parsedYouTubeId: string | null;
} {
  if (!input) {
    return { isLocalFile: false, isHttpUrl: false, parsedYouTubeId: null };
  }
  const clean = input.trim();
  const isLocalFile = clean.startsWith('file://');
  const isHttpUrl = clean.startsWith('http://') || clean.startsWith('https://');

  let parsedYouTubeId: string | null = null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    parsedYouTubeId = clean;
  } else {
    const streamMatch = clean.match(/\/stream\/([a-zA-Z0-9_-]{11})(?:\?|$)/);
    if (streamMatch) {
      parsedYouTubeId = streamMatch[1];
    } else {
      const reg =
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
      const match = clean.match(reg);
      if (match && match[1]) {
        parsedYouTubeId = match[1];
      }
    }
  }

  return { isLocalFile, isHttpUrl, parsedYouTubeId };
}

export type StreamResolutionStrategy = 'local_vault' | 'direct_stream' | 'youtube_bridge';

export function determineStreamStrategy(params: {
  isLocalFile: boolean;
  hasVaultFile: boolean;
  hasDirectStream: boolean;
  hasYouTubeId: boolean;
}): StreamResolutionStrategy {
  if (params.isLocalFile || params.hasVaultFile) {
    return 'local_vault';
  }
  if (params.hasDirectStream) {
    return 'direct_stream';
  }
  return 'youtube_bridge';
}

describe('Audio Stream Resolver Seam Suite', () => {
  describe('Stream Input Classification', () => {
    it('identifies local sandboxed file URIs', () => {
      const res = classifyStreamInput('file:///data/user/0/fun.openjam/files/vault/track1.mp3');
      assert.equal(res.isLocalFile, true);
      assert.equal(res.isHttpUrl, false);
      assert.equal(res.parsedYouTubeId, null);
    });

    it('extracts bare 11-char YouTube ID', () => {
      const res = classifyStreamInput('dQw4w9WgXcQ');
      assert.equal(res.isLocalFile, false);
      assert.equal(res.parsedYouTubeId, 'dQw4w9WgXcQ');
    });

    it('extracts YouTube ID from youtu.be short link', () => {
      const res = classifyStreamInput('https://youtu.be/dQw4w9WgXcQ?si=abcdef');
      assert.equal(res.parsedYouTubeId, 'dQw4w9WgXcQ');
    });

    it('extracts YouTube ID from full watch URL', () => {
      const res = classifyStreamInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
      assert.equal(res.parsedYouTubeId, 'dQw4w9WgXcQ');
    });

    it('extracts YouTube ID from /stream/ proxy endpoint', () => {
      const res = classifyStreamInput('https://api.openjam.fun/stream/dQw4w9WgXcQ?bitrate=192');
      assert.equal(res.parsedYouTubeId, 'dQw4w9WgXcQ');
    });

    it('handles empty or malformed inputs safely', () => {
      assert.equal(classifyStreamInput('').parsedYouTubeId, null);
      assert.equal(classifyStreamInput('unknown artist song title').parsedYouTubeId, null);
    });
  });

  describe('Playback Engine Strategy Hierarchy', () => {
    it('prioritizes local vault file over remote streams', () => {
      const strategy = determineStreamStrategy({
        isLocalFile: false,
        hasVaultFile: true,
        hasDirectStream: true,
        hasYouTubeId: true,
      });
      assert.equal(strategy, 'local_vault');
    });

    it('uses direct audio stream when direct candidate is responsive', () => {
      const strategy = determineStreamStrategy({
        isLocalFile: false,
        hasVaultFile: false,
        hasDirectStream: true,
        hasYouTubeId: true,
      });
      assert.equal(strategy, 'direct_stream');
    });

    it('falls back to headless YouTube bridge when direct streams fail', () => {
      const strategy = determineStreamStrategy({
        isLocalFile: false,
        hasVaultFile: false,
        hasDirectStream: false,
        hasYouTubeId: true,
      });
      assert.equal(strategy, 'youtube_bridge');
    });
  });
});
