import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Unified Mini-Player & Spotify Gestures Suite', () => {
  it('harmonizes active track resolving room track over solo track when room is active', () => {
    const mockRoomTrack = {
      track_name: 'Room Jam Song',
      artist: 'DJ Host',
      album_art_url: 'https://openjam.fun/room_art.png',
      duration_ms: 240000,
    };

    const mockSoloTrack = {
      track_name: 'Solo Track',
      artist: 'Solo Artist',
      album_art_url: 'https://openjam.fun/solo_art.png',
      duration_ms: 180000,
    };

    function resolveActiveTrack(
      roomNowPlaying: typeof mockRoomTrack | null,
      soloCurrentTrack: typeof mockSoloTrack | null,
      isRoomPlaying: boolean,
      isSoloPlaying: boolean,
    ) {
      if (roomNowPlaying) {
        return {
          title: roomNowPlaying.track_name,
          artist: roomNowPlaying.artist,
          artworkUrl: roomNowPlaying.album_art_url,
          isPlaying: isRoomPlaying,
          isRoom: true,
        };
      }
      if (soloCurrentTrack) {
        return {
          title: soloCurrentTrack.track_name,
          artist: soloCurrentTrack.artist,
          artworkUrl: soloCurrentTrack.album_art_url,
          isPlaying: isSoloPlaying,
          isRoom: false,
        };
      }
      return null;
    }

    // Both room and solo tracks available -> Room takes precedence
    const active = resolveActiveTrack(mockRoomTrack, mockSoloTrack, true, false);
    assert.ok(active);
    assert.equal(active.title, 'Room Jam Song');
    assert.equal(active.isRoom, true);
    assert.equal(active.isPlaying, true);

    // Only solo available -> Solo is chosen
    const soloActive = resolveActiveTrack(null, mockSoloTrack, false, true);
    assert.ok(soloActive);
    assert.equal(soloActive.title, 'Solo Track');
    assert.equal(soloActive.isRoom, false);
    assert.equal(soloActive.isPlaying, true);

    // Neither available -> Null
    const noneActive = resolveActiveTrack(null, null, false, false);
    assert.equal(noneActive, null);
  });

  it('correctly detects swipe gestures for track skipping and modal expansion', () => {
    const SWIPE_THRESHOLD = 65;
    const VELOCITY_THRESHOLD = 500;
    const EXPAND_THRESHOLD = -40;

    type GestureAction = 'next' | 'prev' | 'expand' | 'none';

    function evaluatePanAction(
      translateX: number,
      translateY: number,
      velocityX: number,
      velocityY: number,
    ): GestureAction {
      // Upward drag check
      if (translateY < EXPAND_THRESHOLD || velocityY < -VELOCITY_THRESHOLD) {
        return 'expand';
      }
      // Horizontal swipe check
      if (translateX < -SWIPE_THRESHOLD || velocityX < -VELOCITY_THRESHOLD) {
        return 'next';
      }
      if (translateX > SWIPE_THRESHOLD || velocityX > VELOCITY_THRESHOLD) {
        return 'prev';
      }
      return 'none';
    }

    // Swipe left (next track)
    assert.equal(evaluatePanAction(-70, 0, 0, 0), 'next');
    assert.equal(evaluatePanAction(-30, 0, -600, 0), 'next');

    // Swipe right (prev track)
    assert.equal(evaluatePanAction(80, 0, 0, 0), 'prev');
    assert.equal(evaluatePanAction(20, 0, 650, 0), 'prev');

    // Drag up (expand)
    assert.equal(evaluatePanAction(0, -50, 0, 0), 'expand');
    assert.equal(evaluatePanAction(0, -10, 0, -700), 'expand');

    // Subtle drift (no action)
    assert.equal(evaluatePanAction(15, -10, 50, -50), 'none');
  });

  it('calculates micro progress bar percent with millisecond accuracy and bounds', () => {
    function computeProgressPercent(currentPosMs: number, durationMs: number): number {
      const effectiveDuration = durationMs > 0 ? durationMs : 180000;
      return Math.min(100, Math.max(0, (currentPosMs / effectiveDuration) * 100));
    }

    assert.equal(computeProgressPercent(0, 200000), 0);
    assert.equal(computeProgressPercent(50000, 200000), 25);
    assert.equal(computeProgressPercent(200000, 200000), 100);
    assert.equal(computeProgressPercent(250000, 200000), 100); // Clamped
    assert.equal(computeProgressPercent(-100, 200000), 0); // Clamped
    assert.equal(computeProgressPercent(90000, 0), 50); // Default fallback 180s
  });
});
