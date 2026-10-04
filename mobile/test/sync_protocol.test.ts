import { describe, it } from 'node:test';
import assert from 'node:assert';
import { C2S, S2C } from '../src/sync/protocol.ts';

export const DRIFT_SEEK_THRESHOLD_MS = 1500;

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
  });

  it('defines all required Server-to-Client socket events', () => {
    assert.strictEqual(S2C.PLAYBACK_SYNC, 'playback_sync');
    assert.strictEqual(S2C.TRACK_CHANGED, 'track_changed');
    assert.strictEqual(S2C.QUEUE_UPDATED, 'queue_updated');
    assert.strictEqual(S2C.LISTENER_COUNT, 'listener_count');
    assert.strictEqual(S2C.SKIP_VOTES_UPDATED, 'skip_votes_updated');
    assert.strictEqual(S2C.SYNC_PONG, 'sync_pong');
  });

  it('ignores minor drift within 1500ms tolerance without seeking', () => {
    const now = 1000000;
    const res = evaluateSyncDrift(45200, 45000, now - 100, now);
    assert.strictEqual(res.needsSeek, false);
    assert.ok(res.driftMs < DRIFT_SEEK_THRESHOLD_MS);
  });

  it('triggers seek correction when drift exceeds 1500ms threshold', () => {
    const now = 1000000;
    const res = evaluateSyncDrift(42000, 45000, now - 100, now);
    assert.strictEqual(res.needsSeek, true);
    assert.ok(res.driftMs >= DRIFT_SEEK_THRESHOLD_MS);
  });
});
