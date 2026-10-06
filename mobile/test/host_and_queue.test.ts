import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { JoinSuccessPayload, QueueItem } from '../src/sync/protocol.ts';

/**
 * Helper replicating the secure host evaluation in RoomContext.tsx
 */
export function resolveHostStatus(
  data: Partial<JoinSuccessPayload>,
  currentUserId?: string | null,
): boolean {
  if (typeof data.is_host === 'boolean') {
    return data.is_host;
  }
  const hostId = data.host_user_id || data.room?.host_user_id || null;
  return Boolean(hostId && currentUserId && hostId === currentUserId);
}

/**
 * Helper replicating the up-next queue filtering in QueueList.tsx
 */
export function filterUpNextTracks(queue: QueueItem[]): QueueItem[] {
  return queue.filter((item) => item.status !== 'playing');
}

/**
 * Helper replicating safe queue nudge reordering in QueueList.tsx
 */
export function nudgeQueue(
  queue: QueueItem[],
  upNextIndex: number,
  direction: 'up' | 'down',
): QueueItem[] {
  const playingTrack = queue.find((item) => item.status === 'playing');
  const upNext = queue.filter((item) => item.status !== 'playing');

  const targetIndex = direction === 'up' ? upNextIndex - 1 : upNextIndex + 1;
  if (targetIndex < 0 || targetIndex >= upNext.length) return queue;

  const nextUp = [...upNext];
  const [moved] = nextUp.splice(upNextIndex, 1);
  nextUp.splice(targetIndex, 0, moved);

  return playingTrack ? [playingTrack, ...nextUp] : nextUp;
}

describe('Host Authorization & Queue Separation Engine', () => {
  it('correctly resolves host status when server explicitly emits is_host: true', () => {
    const isHost = resolveHostStatus({ is_host: true });
    assert.strictEqual(isHost, true);
  });

  it('correctly resolves host status when server emits is_host: false', () => {
    const isHost = resolveHostStatus({ is_host: false, host_user_id: 'host-123' }, 'user-456');
    assert.strictEqual(isHost, false);
  });

  it('evaluates host from host_user_id matching current user ID when is_host is omitted', () => {
    const isHost = resolveHostStatus({ host_user_id: 'user-abc' }, 'user-abc');
    assert.strictEqual(isHost, true);
  });

  it('prevents privilege escalation when both host_user_id and current user are undefined', () => {
    const isHost = resolveHostStatus({});
    assert.strictEqual(isHost, false);
  });

  it('prevents privilege escalation when guest joins room created by another user', () => {
    const isHost = resolveHostStatus(
      { room: { id: 'r1', name: 'Chill Room', host_user_id: 'host-999' } as any },
      'guest-111',
    );
    assert.strictEqual(isHost, false);
  });

  it('separates currently playing track from UP NEXT tracks', () => {
    const sampleQueue: QueueItem[] = [
      {
        id: 'q-1',
        room_id: 'r1',
        track_uri: 'yt:missed-you',
        track_name: 'Missed You',
        artist: 'The Weeknd',
        status: 'playing',
        added_by_name: 'Alice',
      },
      {
        id: 'q-2',
        room_id: 'r1',
        track_uri: 'yt:starboy',
        track_name: 'Starboy',
        artist: 'The Weeknd',
        status: 'queued',
        added_by_name: 'Bob',
      },
      {
        id: 'q-3',
        room_id: 'r1',
        track_uri: 'yt:blinding-lights',
        track_name: 'Blinding Lights',
        artist: 'The Weeknd',
        status: 'queued',
        added_by_name: 'Charlie',
      },
    ];

    const upNext = filterUpNextTracks(sampleQueue);
    assert.strictEqual(upNext.length, 2);
    assert.strictEqual(upNext[0].id, 'q-2');
    assert.strictEqual(upNext[1].id, 'q-3');
    // Ensure the currently playing track 'Missed You' is not in UP NEXT
    assert.ok(upNext.every((item) => item.status !== 'playing'));
  });

  it('nudges upcoming tracks up and down while locking playing track at index 0', () => {
    const sampleQueue: QueueItem[] = [
      {
        id: 'q-1',
        room_id: 'r1',
        track_uri: 'yt:track1',
        track_name: 'Track 1',
        status: 'playing',
      },
      {
        id: 'q-2',
        room_id: 'r1',
        track_uri: 'yt:track2',
        track_name: 'Track 2',
        status: 'queued',
      },
      {
        id: 'q-3',
        room_id: 'r1',
        track_uri: 'yt:track3',
        track_name: 'Track 3',
        status: 'queued',
      },
    ];

    // Nudge 'Track 3' (upNextIndex 1) UP
    const nudgedUp = nudgeQueue(sampleQueue, 1, 'up');
    assert.strictEqual(nudgedUp[0].id, 'q-1'); // Playing track remains at 0
    assert.strictEqual(nudgedUp[1].id, 'q-3'); // Track 3 moved before Track 2
    assert.strictEqual(nudgedUp[2].id, 'q-2');

    // Nudge top upcoming track DOWN
    const nudgedDown = nudgeQueue(nudgedUp, 0, 'down');
    assert.strictEqual(nudgedDown[0].id, 'q-1');
    assert.strictEqual(nudgedDown[1].id, 'q-2');
    assert.strictEqual(nudgedDown[2].id, 'q-3');
  });
});
