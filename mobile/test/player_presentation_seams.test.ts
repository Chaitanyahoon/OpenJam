import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure gesture math and decision rules extracted for testing player seams
 */
export function evaluateDoubleTap(lastTapTime: number, currentTapTime: number, windowMs = 320): boolean {
  if (lastTapTime === 0) return false;
  return currentTapTime - lastTapTime < windowMs;
}

export type SwipeDecision = 'next' | 'prev' | 'reset';

export function evaluateArtworkSwipe(
  dx: number,
  vx: number,
  thresholdDx = 55,
  thresholdVx = 0.35,
): SwipeDecision {
  if (dx < -thresholdDx || vx < -thresholdVx) {
    return 'next';
  }
  if (dx > thresholdDx || vx > thresholdVx) {
    return 'prev';
  }
  return 'reset';
}

export function computeArtworkDampingScale(dx: number, screenWidth = 360): number {
  return Math.max(0.92, 1 - Math.abs(dx) / (screenWidth * 2));
}

export function computeLyricScrollOffset(activeLineIndex: number, lineHeight = 48, centerOffset = 140): number {
  if (activeLineIndex < 0) return 0;
  return Math.max(0, activeLineIndex * lineHeight - centerOffset);
}

describe('Player Presentation Seams Suite', () => {
  describe('Double-Tap Heart Burst Seam', () => {
    it('detects valid double tap within 320ms threshold', () => {
      const firstTap = 1000;
      const secondTap = 1250; // 250ms diff
      assert.equal(evaluateDoubleTap(firstTap, secondTap), true);
    });

    it('rejects taps separated by more than 320ms as separate interactions', () => {
      const firstTap = 1000;
      const secondTap = 1380; // 380ms diff
      assert.equal(evaluateDoubleTap(firstTap, secondTap), false);
    });

    it('handles initial tap cleanly without false trigger', () => {
      assert.equal(evaluateDoubleTap(0, 1000), false);
    });
  });

  describe('Artwork Swipe-to-Skip Seam', () => {
    it('decides "next" track on left swipe past distance threshold', () => {
      assert.equal(evaluateArtworkSwipe(-60, 0), 'next');
    });

    it('decides "next" track on quick left flick past velocity threshold even with small distance', () => {
      assert.equal(evaluateArtworkSwipe(-30, -0.4), 'next');
    });

    it('decides "prev" track on right swipe past distance threshold', () => {
      assert.equal(evaluateArtworkSwipe(70, 0), 'prev');
    });

    it('decides "prev" track on quick right flick past velocity threshold', () => {
      assert.equal(evaluateArtworkSwipe(30, 0.45), 'prev');
    });

    it('decides "reset" when gesture is below both thresholds', () => {
      assert.equal(evaluateArtworkSwipe(20, 0.1), 'reset');
      assert.equal(evaluateArtworkSwipe(-15, -0.2), 'reset');
    });

    it('clamps artwork damping scale safely between 0.92 and 1.0', () => {
      assert.equal(computeArtworkDampingScale(0, 360), 1.0);
      const smallDrag = computeArtworkDampingScale(20, 360);
      assert.ok(smallDrag < 1.0 && smallDrag > 0.92);
      const largeDrag = computeArtworkDampingScale(200, 360);
      assert.equal(largeDrag, 0.92);
    });
  });

  describe('Lyrics Auto-Scroll Geometry Seam', () => {
    it('returns 0 for negative or unset active lyric line index', () => {
      assert.equal(computeLyricScrollOffset(-1), 0);
    });

    it('returns 0 when active line is near top to avoid negative scroll', () => {
      assert.equal(computeLyricScrollOffset(0), 0);
      assert.equal(computeLyricScrollOffset(1), 0); // 1 * 48 - 140 = -92 -> clamped to 0
    });

    it('calculates proper center scroll offset for deeper lines', () => {
      // 5 * 48 = 240, 240 - 140 = 100
      assert.equal(computeLyricScrollOffset(5), 100);
      // 10 * 48 = 480, 480 - 140 = 340
      assert.equal(computeLyricScrollOffset(10), 340);
    });
  });
});
