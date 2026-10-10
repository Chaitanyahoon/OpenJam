import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface TestTrack {
  track_uri: string;
  track_name: string;
  artist?: string;
  duration_ms?: number;
}

/**
 * Pure queue truncation helper replicating PlayerContext.clearUpcomingQueue logic
 */
export function pureClearUpcomingQueue(
  queue: TestTrack[],
  currentTrack: TestTrack | null,
  currentIndex: number,
): TestTrack[] {
  const activeIdx = currentTrack
    ? queue.findIndex((t) => t.track_uri === currentTrack.track_uri)
    : currentIndex;
  const safeIdx = activeIdx >= 0 ? activeIdx : Math.max(0, currentIndex);
  if (safeIdx >= queue.length - 1) {
    return queue;
  }
  return queue.slice(0, safeIdx + 1);
}

/**
 * Pure track index resolver replicating PlayerContext.playTrack index synchronization
 */
export function pureResolveCurrentIndex(
  track: TestTrack,
  existingQueue: TestTrack[],
  newQueue?: TestTrack[],
): { queue: TestTrack[]; currentIndex: number } {
  if (newQueue && newQueue.length > 0) {
    const idx = newQueue.findIndex((t) => t.track_uri === track.track_uri);
    return { queue: newQueue, currentIndex: Math.max(0, idx) };
  }
  const existingIdx = existingQueue.findIndex((t) => t.track_uri === track.track_uri);
  return {
    queue: existingQueue,
    currentIndex: existingIdx >= 0 ? existingIdx : 0,
  };
}

/**
 * Pure audio device normalizer ensuring legacy 'room' route safely falls back to hardware
 */
export function normalizeAudioDeviceRoute(saved: string | null | undefined): 'speaker' | 'bluetooth' | 'wired' {
  if (saved === 'bluetooth') return 'bluetooth';
  if (saved === 'wired') return 'wired';
  return 'speaker'; // Defaults to speaker and cleanses legacy 'room'
}

/**
 * Pure Solo Jam home screen redirection decider
 */
export function resolveSoloJamAction(
  currentTrack: TestTrack | null,
): 'expand_player' | 'open_search' {
  if (currentTrack) {
    return 'expand_player';
  }
  return 'open_search';
}

describe('Solo Direct Listener Sovereignty Suite', () => {
  it('clears upcoming queue while strictly preserving the currently active track and history', () => {
    const track1: TestTrack = { track_uri: 'yt:1', track_name: 'Intro' };
    const track2: TestTrack = { track_uri: 'yt:2', track_name: 'Current Banger' };
    const track3: TestTrack = { track_uri: 'yt:3', track_name: 'Upcoming 1' };
    const track4: TestTrack = { track_uri: 'yt:4', track_name: 'Upcoming 2' };

    const initialQueue = [track1, track2, track3, track4];
    const cleared = pureClearUpcomingQueue(initialQueue, track2, 1);

    assert.equal(cleared.length, 2);
    assert.deepEqual(cleared, [track1, track2]);
    assert.equal(cleared[1].track_uri, 'yt:2');
  });

  it('safely finds active track by URI even if currentIndex is desynchronized', () => {
    const track1: TestTrack = { track_uri: 'yt:1', track_name: 'Track 1' };
    const track2: TestTrack = { track_uri: 'yt:2', track_name: 'Track 2' };
    const track3: TestTrack = { track_uri: 'yt:3', track_name: 'Track 3' };
    const queue = [track1, track2, track3];

    // Simulating desynced currentIndex = 0 while track2 is playing
    const cleared = pureClearUpcomingQueue(queue, track2, 0);

    assert.equal(cleared.length, 2);
    assert.equal(cleared[0].track_uri, 'yt:1');
    assert.equal(cleared[1].track_uri, 'yt:2');
  });

  it('no-ops safely when current track is already the last track in the queue', () => {
    const track1: TestTrack = { track_uri: 'yt:1', track_name: 'Only Track' };
    const queue = [track1];

    const result = pureClearUpcomingQueue(queue, track1, 0);
    assert.equal(result.length, 1);
    assert.equal(result[0].track_uri, 'yt:1');
  });

  it('handles empty queue without throwing errors', () => {
    const emptyQueue: TestTrack[] = [];
    const result = pureClearUpcomingQueue(emptyQueue, null, 0);
    assert.equal(result.length, 0);
  });

  it('synchronizes currentIndex when playing an upcoming track from existing queue', () => {
    const track1: TestTrack = { track_uri: 'yt:1', track_name: 'Track 1' };
    const track2: TestTrack = { track_uri: 'yt:2', track_name: 'Track 2' };
    const track3: TestTrack = { track_uri: 'yt:3', track_name: 'Track 3' };
    const queue = [track1, track2, track3];

    // User taps track 3 in existing queue without supplying newQueue
    const { currentIndex, queue: q } = pureResolveCurrentIndex(track3, queue);
    assert.equal(currentIndex, 2);
    assert.equal(q.length, 3);
  });

  it('initializes queue and currentIndex when playing track with newQueue', () => {
    const trackA: TestTrack = { track_uri: 'yt:a', track_name: 'Alpha' };
    const trackB: TestTrack = { track_uri: 'yt:b', track_name: 'Beta' };
    const newQueue = [trackA, trackB];

    const { currentIndex, queue: q } = pureResolveCurrentIndex(trackB, [], newQueue);
    assert.equal(currentIndex, 1);
    assert.equal(q[currentIndex].track_name, 'Beta');
  });

  it('safely cleanses legacy room audio route to speaker', () => {
    assert.equal(normalizeAudioDeviceRoute('bluetooth'), 'bluetooth');
    assert.equal(normalizeAudioDeviceRoute('wired'), 'wired');
    assert.equal(normalizeAudioDeviceRoute('speaker'), 'speaker');
    assert.equal(normalizeAudioDeviceRoute('room'), 'speaker'); // Cleansed
    assert.equal(normalizeAudioDeviceRoute(null), 'speaker');
    assert.equal(normalizeAudioDeviceRoute(undefined), 'speaker');
  });

  it('resolves Solo Jam action to expand player whenever a track is loaded (playing or paused)', () => {
    const mockTrack: TestTrack = { track_uri: 'yt:1', track_name: 'Jam Song' };

    // Music is loaded (playing or paused) -> expand player modal
    assert.equal(resolveSoloJamAction(mockTrack), 'expand_player');

    // Fresh session (no track loaded) -> open discovery search
    assert.equal(resolveSoloJamAction(null), 'open_search');
  });

  it('appends queued tracks non-disruptively without mutating existing active queue', () => {
    const activeTrack: TestTrack = { track_uri: 'yt:cur', track_name: 'Now Playing' };
    const queue = [activeTrack];

    const newSong: TestTrack = { track_uri: 'yt:new', track_name: 'Added Song' };
    const updatedQueue = [...queue, newSong];

    assert.equal(queue.length, 1); // Immutability
    assert.equal(updatedQueue.length, 2);
    assert.equal(updatedQueue[0].track_uri, 'yt:cur');
    assert.equal(updatedQueue[1].track_uri, 'yt:new');
  });
});
