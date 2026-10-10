import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { TrackInfo, QueueItem } from '../src/sync/protocol.ts';

/**
 * Prepares the payload to seed a live collaborative room from an active solo session.
 */
export function prepareSoloToRoomHandoff(
  currentTrack: TrackInfo | null,
  queue: TrackInfo[],
  userName: string = 'Jammer',
  maxSeedTracks: number = 10,
) {
  if (!currentTrack) {
    return { canStartJam: false, roomName: '', tracksToSeed: [] };
  }

  const cleanName = userName.trim() || 'Jammer';
  const roomName = `${cleanName}'s Jam`;

  // Deduplicate and gather upcoming tracks from queue excluding past tracks
  const remaining = queue.filter((t) => t.track_uri !== currentTrack.track_uri);
  const tracksToSeed = [currentTrack, ...remaining].slice(0, maxSeedTracks);

  return {
    canStartJam: true,
    roomName,
    initialTrack: currentTrack,
    tracksToSeed,
    inviteUrl: (roomId: string) => `https://www.openjam.fun/room/${roomId}`,
  };
}

/**
 * Prepares the payload to transfer active room playback to Solo Jam on leave.
 */
export function prepareRoomToSoloHandoff(
  nowPlaying: TrackInfo | null,
  roomQueue: QueueItem[],
  currentElapsedMs: number = 0,
) {
  if (!nowPlaying) {
    return { shouldContinueSolo: false, soloTrack: null, soloQueue: [], initialPositionMs: 0 };
  }

  const upcomingTracks = roomQueue.map((item) => item.track);
  const combinedQueue = [nowPlaying, ...upcomingTracks.filter((t) => t.track_uri !== nowPlaying.track_uri)];

  return {
    shouldContinueSolo: true,
    soloTrack: nowPlaying,
    soloQueue: combinedQueue,
    initialPositionMs: Math.max(0, currentElapsedMs),
    sourceTitle: 'Solo Jam',
  };
}

describe('Seamless Solo ⇋ Room Audio Handoff Engine', () => {
  it('correctly prepares Solo to Room handoff with seeded queue and room title', () => {
    const currentTrack: TrackInfo = {
      track_uri: 'spotify:track:1',
      track_name: 'Blinding Lights',
      artist: 'The Weeknd',
      duration_ms: 200000,
    };
    const queue: TrackInfo[] = [
      currentTrack,
      { track_uri: 'spotify:track:2', track_name: 'Save Your Tears', artist: 'The Weeknd' },
      { track_uri: 'spotify:track:3', track_name: 'Starboy', artist: 'The Weeknd' },
    ];

    const handoff = prepareSoloToRoomHandoff(currentTrack, queue, 'Alex');
    assert.strictEqual(handoff.canStartJam, true);
    assert.strictEqual(handoff.roomName, "Alex's Jam");
    assert.strictEqual(handoff.tracksToSeed.length, 3);
    assert.strictEqual(handoff.tracksToSeed[0].track_name, 'Blinding Lights');
    assert.strictEqual(handoff.inviteUrl('room-42'), 'https://www.openjam.fun/room/room-42');
  });

  it('handles null track gracefully when attempting Solo to Room handoff', () => {
    const handoff = prepareSoloToRoomHandoff(null, []);
    assert.strictEqual(handoff.canStartJam, false);
    assert.strictEqual(handoff.tracksToSeed.length, 0);
  });

  it('correctly preserves room playback position and upcoming queue when leaving to Solo', () => {
    const nowPlaying: TrackInfo = {
      track_uri: 'spotify:track:alpha',
      track_name: 'Resonance',
      artist: 'HOME',
      duration_ms: 212000,
    };
    const roomQueue: QueueItem[] = [
      {
        id: 'q-1',
        track: { track_uri: 'spotify:track:beta', track_name: 'Sunset Lover', artist: 'Petit Biscuit' },
        added_by: 'user-1',
        added_at: Date.now(),
        votes: 1,
      },
    ];

    const handoff = prepareRoomToSoloHandoff(nowPlaying, roomQueue, 85400);
    assert.strictEqual(handoff.shouldContinueSolo, true);
    assert.strictEqual(handoff.soloTrack?.track_name, 'Resonance');
    assert.strictEqual(handoff.initialPositionMs, 85400);
    assert.strictEqual(handoff.soloQueue.length, 2);
    assert.strictEqual(handoff.soloQueue[1].track_name, 'Sunset Lover');
  });

  it('safely handles empty room state without throwing', () => {
    const handoff = prepareRoomToSoloHandoff(null, [], 0);
    assert.strictEqual(handoff.shouldContinueSolo, false);
    assert.strictEqual(handoff.soloTrack, null);
    assert.strictEqual(handoff.soloQueue.length, 0);
  });
});
