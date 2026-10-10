import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  timestamp: number;
  temp_id?: string;
  avatar_url?: string | null;
  is_system?: boolean;
  system_type?: 'join' | 'leave' | 'host';
}

export function reconcileIncomingChatMessage(
  currentList: ChatMessage[],
  incoming: ChatMessage,
  seenIds: Set<string>,
  myUserId?: string,
  myUserName?: string,
): ChatMessage[] {
  if (seenIds.has(incoming.id)) return currentList;
  seenIds.add(incoming.id);

  if (incoming.temp_id) {
    const tempIdx = currentList.findIndex((m) => m.id === incoming.temp_id);
    if (tempIdx !== -1) {
      const next = [...currentList];
      next[tempIdx] = incoming;
      return next;
    }
  }

  const isFromMe =
    Boolean(myUserId && incoming.user_id === myUserId) ||
    Boolean(myUserName && incoming.user_name === myUserName) ||
    incoming.user_id === 'me';

  if (isFromMe) {
    const optIndex = currentList.findIndex(
      (m) =>
        m.id.startsWith('temp_') &&
        (m.user_id === incoming.user_id || m.user_id === 'me' || (myUserName && m.user_name === myUserName)) &&
        m.content.trim() === incoming.content.trim(),
    );
    if (optIndex !== -1) {
      const next = [...currentList];
      next[optIndex] = incoming;
      return next;
    }
  }

  if (currentList.some((m) => m.id === incoming.id)) {
    return currentList;
  }

  return [...currentList.slice(-199), incoming];
}

export function updateTypingUsersList(
  currentTyping: string[],
  incomingUserName: string | undefined,
  myUserName?: string,
  isTyping = true,
): string[] {
  if (!incomingUserName || (myUserName && incomingUserName === myUserName)) {
    return currentTyping;
  }
  if (isTyping) {
    return currentTyping.includes(incomingUserName)
      ? currentTyping
      : [...currentTyping, incomingUserName];
  } else {
    return currentTyping.filter((u) => u !== incomingUserName);
  }
}

export function appendFlyingReaction<T extends { key: string; emoji: string }>(
  currentReactions: T[],
  newReaction: T,
  maxCapacity = 20,
): T[] {
  return [...currentReactions.slice(-(maxCapacity - 1)), newReaction];
}


describe('Room Chat & Reactions Seam Suite', () => {
  describe('Chat Message Reconciliation', () => {
    it('matches and replaces temp message when server broadcasts ack with temp_id', () => {
      const seen = new Set<string>();
      const initial: ChatMessage[] = [
        { id: 'msg-1', user_id: 'alice', user_name: 'Alice', content: 'hi', timestamp: 100 },
        { id: 'temp_x1', user_id: 'me', user_name: 'Bob', content: 'test message', timestamp: 105 },
      ];
      seen.add('temp_x1');

      const serverMsg: ChatMessage = {
        id: 'real-uuid-2',
        temp_id: 'temp_x1',
        user_id: 'user_bob',
        user_name: 'Bob',
        content: 'test message',
        timestamp: 106,
      };

      const result = reconcileIncomingChatMessage(initial, serverMsg, seen, 'user_bob');
      assert.equal(result.length, 2);
      assert.equal(result[1].id, 'real-uuid-2');
      assert.equal(result[1].user_name, 'Bob');
      assert.equal(seen.has('real-uuid-2'), true);
    });

    it('matches optimistic message by content and user when temp_id is missing', () => {
      const seen = new Set<string>();
      const initial: ChatMessage[] = [
        { id: 'temp_random', user_id: 'user_bob', user_name: 'Bob', content: 'vibing with lofi', timestamp: 200 },
      ];

      const serverMsg: ChatMessage = {
        id: 'real-uuid-3',
        user_id: 'user_bob',
        user_name: 'Bob',
        content: 'vibing with lofi',
        timestamp: 205,
      };

      const result = reconcileIncomingChatMessage(initial, serverMsg, seen, 'user_bob');
      assert.equal(result.length, 1);
      assert.equal(result[0].id, 'real-uuid-3');
    });

    it('caps message history at exactly 200 entries', () => {
      const seen = new Set<string>();
      const messages: ChatMessage[] = Array.from({ length: 200 }, (_, i) => ({
        id: `msg-${i}`,
        user_id: 'u1',
        user_name: 'User 1',
        content: `Msg ${i}`,
        timestamp: 1000 + i,
      }));

      const newMsg: ChatMessage = {
        id: 'msg-201',
        user_id: 'u2',
        user_name: 'User 2',
        content: 'New message',
        timestamp: 2000,
      };

      const result = reconcileIncomingChatMessage(messages, newMsg, seen);
      assert.equal(result.length, 200);
      assert.equal(result[0].id, 'msg-1');
      assert.equal(result[199].id, 'msg-201');
    });

    it('ignores duplicates if message ID was already processed in seen set', () => {
      const seen = new Set<string>(['dup-1']);
      const initial: ChatMessage[] = [
        { id: 'dup-1', user_id: 'u1', user_name: 'Alice', content: 'already seen', timestamp: 100 },
      ];

      const incoming: ChatMessage = {
        id: 'dup-1',
        user_id: 'u1',
        user_name: 'Alice',
        content: 'already seen',
        timestamp: 100,
      };

      const result = reconcileIncomingChatMessage(initial, incoming, seen);
      assert.equal(result, initial); // strict reference equality
    });
  });

  describe('Typing Indicator Seam', () => {
    it('adds typing user when another listener starts typing', () => {
      const list = updateTypingUsersList([], 'Alice', 'Bob', true);
      assert.deepEqual(list, ['Alice']);
    });

    it('ignores current user self-typing indicator', () => {
      const list = updateTypingUsersList([], 'Bob', 'Bob', true);
      assert.deepEqual(list, []);
    });

    it('removes user when they stop typing', () => {
      const list = updateTypingUsersList(['Alice', 'Charlie'], 'Alice', 'Bob', false);
      assert.deepEqual(list, ['Charlie']);
    });
  });

  describe('Flying Reactions Seam', () => {
    it('appends reactions and caps capacity at max 20 entries', () => {
      let reactions: Array<{ key: string; emoji: string }> = [];
      for (let i = 0; i < 25; i++) {
        reactions = appendFlyingReaction(reactions, { key: `r-${i}`, emoji: '🔥' });
      }
      assert.equal(reactions.length, 20);
      assert.equal(reactions[0].key, 'r-5');
      assert.equal(reactions[19].key, 'r-24');
    });
  });
});
