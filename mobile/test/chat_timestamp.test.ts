import { describe, it } from 'node:test';
import assert from 'node:assert';

export function parseChatTimestamp(ts: number | string): Date | null {
  if (!ts) return null;
  let d: Date;
  if (typeof ts === 'string') {
    const clean = ts.trim();
    if (!clean.endsWith('Z') && !clean.includes('+') && !clean.slice(10).includes('-')) {
      d = new Date(`${clean}Z`);
    } else {
      d = new Date(clean);
    }
  } else {
    d = new Date(ts);
  }
  return isNaN(d.getTime()) ? null : d;
}

export function deduplicateChatMessage(
  existingMessages: { id: string; user_id: string; content: string }[],
  incomingMessage: { id: string; user_id: string; content: string },
  currentUserId: string,
): { id: string; user_id: string; content: string }[] {
  const isFromMe = incomingMessage.user_id === currentUserId || incomingMessage.user_id === 'me';
  if (isFromMe) {
    const optIndex = existingMessages.findIndex(
      (m) => m.id.startsWith('temp_') && m.content === incomingMessage.content,
    );
    if (optIndex !== -1) {
      const next = [...existingMessages];
      next[optIndex] = incomingMessage;
      return next;
    }
  }
  return [...existingMessages, incomingMessage];
}

describe('Chat Timestamp & Deduplication Engine', () => {
  it('parses numeric epoch timestamps accurately', () => {
    const now = 1791264840000;
    const d = parseChatTimestamp(now);
    assert.ok(d !== null);
    assert.strictEqual(d.getTime(), now);
  });

  it('normalizes naive UTC strings without trailing Z to true UTC', () => {
    const naiveUtc = '2026-10-06T05:24:00';
    const d = parseChatTimestamp(naiveUtc);
    assert.ok(d !== null);
    // In UTC, 05:24:00 is 5h * 3600 + 24m * 60 = 19440 seconds into the day
    assert.strictEqual(d.getUTCHours(), 5);
    assert.strictEqual(d.getUTCMinutes(), 24);
  });

  it('replaces optimistic temp message in-place when server broadcast arrives', () => {
    const list = [
      { id: 'msg-1', user_id: 'alice', content: 'hello' },
      { id: 'temp_abc123', user_id: 'me', content: 'hey there!' },
    ];
    const serverBroadcast = {
      id: 'uuid-999',
      user_id: 'user_bob',
      content: 'hey there!',
    };

    const result = deduplicateChatMessage(list, serverBroadcast, 'user_bob');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].id, 'uuid-999');
    assert.strictEqual(result[1].content, 'hey there!');
  });

  it('appends non-duplicate messages normally', () => {
    const list = [
      { id: 'msg-1', user_id: 'alice', content: 'hello' },
    ];
    const incoming = {
      id: 'msg-2',
      user_id: 'bob',
      content: 'world',
    };

    const result = deduplicateChatMessage(list, incoming, 'user_charlie');
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].id, 'msg-2');
  });
});
