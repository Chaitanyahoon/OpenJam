import { describe, it } from 'node:test';
import assert from 'node:assert';
import { filterRecentSearches } from '../src/storage/history.ts';
import type { TrackInfo } from '../src/sync/protocol.ts';

describe('Solo Enhancements & Artwork Gestures Engine', () => {
  describe('Recent Searches Filtering', () => {
    it('prepends new search term to the top of list', () => {
      const existing = ['synthwave', 'lofi beats'];
      const result = filterRecentSearches(existing, 'daft punk');
      assert.deepStrictEqual(result, ['daft punk', 'synthwave', 'lofi beats']);
    });

    it('deduplicates case-insensitively and moves query to front', () => {
      const existing = ['Lofi Beats', 'synthwave', 'rock'];
      const result = filterRecentSearches(existing, 'lofi beats');
      assert.deepStrictEqual(result, ['lofi beats', 'synthwave', 'rock']);
    });

    it('ignores empty queries or queries shorter than 2 characters', () => {
      const existing = ['chillhop', 'ambient'];
      assert.deepStrictEqual(filterRecentSearches(existing, ''), existing);
      assert.deepStrictEqual(filterRecentSearches(existing, '   '), existing);
      assert.deepStrictEqual(filterRecentSearches(existing, 'a'), existing);
    });

    it('enforces maximum recent search history capacity', () => {
      const existing = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      const result = filterRecentSearches(existing, 'brand new query', 10);
      assert.strictEqual(result.length, 10);
      assert.strictEqual(result[0], 'brand new query');
      assert.strictEqual(result[9], '9');
    });
  });

  describe('Play Next In Queue Semantics', () => {
    const queue: TrackInfo[] = [
      { track_uri: 'uri:1', track_name: 'Song 1', artist: 'Artist A' },
      { track_uri: 'uri:2', track_name: 'Song 2', artist: 'Artist B' },
      { track_uri: 'uri:3', track_name: 'Song 3', artist: 'Artist C' },
    ];

    function insertPlayNext(currentQueue: TrackInfo[], activeIndex: number, newTrack: TrackInfo): TrackInfo[] {
      const insertIdx = Math.min(currentQueue.length, activeIndex + 1);
      return [
        ...currentQueue.slice(0, insertIdx),
        newTrack,
        ...currentQueue.slice(insertIdx),
      ];
    }

    it('inserts track immediately after the currently playing song ahead of upcoming queue', () => {
      const newTrack: TrackInfo = { track_uri: 'uri:priority', track_name: 'Priority Song', artist: 'Artist P' };
      // Song 1 is currently playing (index 0)
      const updated = insertPlayNext(queue, 0, newTrack);
      assert.strictEqual(updated.length, 4);
      assert.strictEqual(updated[0].track_uri, 'uri:1');
      assert.strictEqual(updated[1].track_uri, 'uri:priority');
      assert.strictEqual(updated[2].track_uri, 'uri:2');
      assert.strictEqual(updated[3].track_uri, 'uri:3');
    });

    it('handles queueing next at the end of queue', () => {
      const newTrack: TrackInfo = { track_uri: 'uri:last', track_name: 'Last Song', artist: 'Artist L' };
      // Currently at index 2 (last track)
      const updated = insertPlayNext(queue, 2, newTrack);
      assert.strictEqual(updated.length, 4);
      assert.strictEqual(updated[3].track_uri, 'uri:last');
    });
  });

  describe('Album Artwork Gesture Detection', () => {
    function evaluateArtworkSwipe(dx: number, vx: number, threshold = 55): 'next' | 'prev' | 'none' {
      if (dx < -threshold || vx < -0.35) {
        return 'next';
      }
      if (dx > threshold || vx > 0.35) {
        return 'prev';
      }
      return 'none';
    }

    function isDoubleTap(lastTapTime: number, currentTapTime: number, maxIntervalMs = 320): boolean {
      return currentTapTime - lastTapTime > 0 && currentTapTime - lastTapTime < maxIntervalMs;
    }

    it('detects swipe left as next track action', () => {
      assert.strictEqual(evaluateArtworkSwipe(-65, 0), 'next');
      assert.strictEqual(evaluateArtworkSwipe(-20, -0.45), 'next');
    });

    it('detects swipe right as previous track action', () => {
      assert.strictEqual(evaluateArtworkSwipe(70, 0), 'prev');
      assert.strictEqual(evaluateArtworkSwipe(25, 0.45), 'prev');
    });

    it('ignores small horizontal movements below threshold', () => {
      assert.strictEqual(evaluateArtworkSwipe(15, 0.1), 'none');
      assert.strictEqual(evaluateArtworkSwipe(-25, -0.2), 'none');
    });

    it('detects double tap when two taps occur within 320ms', () => {
      const tap1 = 1000;
      const tap2 = 1200; // delta 200ms
      assert.strictEqual(isDoubleTap(tap1, tap2), true);
    });

    it('rejects double tap when interval exceeds 320ms', () => {
      const tap1 = 1000;
      const tap2 = 1450; // delta 450ms
      assert.strictEqual(isDoubleTap(tap1, tap2), false);
    });
  });
});
