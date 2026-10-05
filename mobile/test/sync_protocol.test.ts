import { describe, it } from 'node:test';
import assert from 'node:assert';
import { C2S, S2C } from '../src/sync/protocol.ts';

export const DRIFT_SEEK_THRESHOLD_MS = 2500;

export function evaluateSyncDrift(
  clientPosMs: number,
  serverPosMs: number,
  lastKnownServerTimeMs: number,
  nowMs: number = Date.now(),
): { needsSeek: boolean; driftMs: number } {
  const latencyComp = Math.max(0, nowMs - lastKnownServerTimeMs);
  const projectedServerPos = serverPosMs + latencyComp;
  const driftMs = Math.abs(clientPosMs - projectedServerPos);
  return {
    needsSeek: driftMs > DRIFT_SEEK_THRESHOLD_MS,
    driftMs,
  };
}

describe('Socket.IO Sync Protocol & Drift Calculation', () => {
  it('defines all required Client-to-Server socket events', () => {
    assert.strictEqual(C2S.JOIN_ROOM, 'join_room');
    assert.strictEqual(C2S.LEAVE_ROOM, 'leave_room');
    assert.strictEqual(C2S.PLAY_NOW, 'play_now');
    assert.strictEqual(C2S.NEXT_TRACK, 'next_track');
    assert.strictEqual(C2S.PREVIOUS_TRACK, 'previous_track');
    assert.strictEqual(C2S.VOTE_SKIP, 'vote_skip');
    assert.strictEqual(C2S.SEND_REACTION, 'send_reaction');
    assert.strictEqual(C2S.SYNC_PING, 'sync_ping');
    assert.strictEqual(C2S.REORDER_QUEUE, 'reorder_queue');
    assert.strictEqual(C2S.TRANSFER_HOST, 'transfer_host');
    assert.strictEqual(C2S.KICK_USER, 'kick_user');
  });

  it('defines all required Server-to-Client socket events', () => {
    assert.strictEqual(S2C.PLAYBACK_SYNC, 'playback_sync');
    assert.strictEqual(S2C.TRACK_CHANGED, 'track_changed');
    assert.strictEqual(S2C.QUEUE_UPDATED, 'queue_updated');
    assert.strictEqual(S2C.LISTENER_COUNT, 'listener_count');
    assert.strictEqual(S2C.SKIP_VOTES_UPDATED, 'skip_votes_updated');
    assert.strictEqual(S2C.SYNC_PONG, 'sync_pong');
    assert.strictEqual(S2C.USER_JOINED, 'user_joined');
    assert.strictEqual(S2C.USER_LEFT, 'user_left');
    assert.strictEqual(S2C.HOST_CHANGED, 'host_changed');
    assert.strictEqual(S2C.KICKED_FROM_ROOM, 'kicked_from_room');
  });

  it('ignores mobile network ping jitter within 2500ms tolerance without seeking', () => {
    const now = 1000000;
    const res = evaluateSyncDrift(46800, 45000, now - 100, now);
    assert.strictEqual(res.needsSeek, false);
    assert.ok(res.driftMs < DRIFT_SEEK_THRESHOLD_MS);
  });

  it('triggers seek correction when drift exceeds 2500ms threshold', () => {
    const now = 1000000;
    const res = evaluateSyncDrift(41000, 45000, now - 100, now);
    assert.strictEqual(res.needsSeek, true);
    assert.ok(res.driftMs >= DRIFT_SEEK_THRESHOLD_MS);
  });

  it('correctly reorders queue items based on ordered IDs array', () => {
    const items = [
      { id: '1', track_name: 'Track A' },
      { id: '2', track_name: 'Track B' },
      { id: '3', track_name: 'Track C' },
    ];
    const orderedIds = ['3', '1', '2'];
    const idMap = new Map(items.map((i) => [i.id, i]));
    const reordered = orderedIds.map((id) => idMap.get(id)!);

    assert.strictEqual(reordered[0].track_name, 'Track C');
    assert.strictEqual(reordered[1].track_name, 'Track A');
    assert.strictEqual(reordered[2].track_name, 'Track B');
  });

  it('detects duplicate tracks by URI or exact title and artist case-insensitively', () => {
    const queue = [
      { track_uri: 'yt_123', track_name: 'Starboy', artist: 'The Weeknd' },
    ];
    const isDuplicate = (candUri: string, candName: string, candArtist: string) => {
      return queue.some(
        (q) =>
          q.track_uri.toLowerCase() === candUri.toLowerCase() ||
          (q.track_name.toLowerCase() === candName.toLowerCase() &&
            q.artist.toLowerCase() === candArtist.toLowerCase()),
      );
    };

    assert.strictEqual(isDuplicate('yt_123', 'Other Title', 'Other Artist'), true);
    assert.strictEqual(isDuplicate('yt_456', 'starboy', 'the weeknd'), true);
    assert.strictEqual(isDuplicate('yt_789', 'Blinding Lights', 'The Weeknd'), false);
  });
});

