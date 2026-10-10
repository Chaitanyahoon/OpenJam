import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SyncEngine, computeEqualPowerCrossfade } from '../src/sync/engine.ts';
import { classifyStreamInput } from './stream_resolver.test.ts';
import {
  reconcileIncomingChatMessage,
  updateTypingUsersList,
  type ChatMessage,
} from './room_chat_reactions.test.ts';

describe('Microsecond Performance Budget Enforcement Suite', () => {
  it('SyncEngine.evaluateDrift completes 10,000 iterations within budget (<50ms)', () => {
    const engine = new SyncEngine();
    const iterations = 10_000;

    // Warm-up JIT
    for (let i = 0; i < 500; i++) {
      engine.evaluateDrift(1000 + i, 1000 + (i % 300));
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      // Test across Tier 1, Tier 2, and Tier 3 ranges
      const target = 100_000 + (i % 500) - 250;
      const res = engine.evaluateDrift(100_000, target);
      if (res.tier === 1) {
        assert.equal(res.action, 'jitter_buffer');
      }
    }
    const duration = performance.now() - start;
    const perCallUs = (duration / iterations) * 1000;

    // Budget: 50ms total (<5µs per call)
    assert.ok(
      duration < 50,
      `evaluateDrift took ${duration.toFixed(2)}ms (${perCallUs.toFixed(2)}µs/call), budget is 50ms`,
    );
  });

  it('computeEqualPowerCrossfade completes 10,000 iterations within budget (<50ms)', () => {
    const iterations = 10_000;

    // Warm-up
    for (let i = 0; i < 500; i++) {
      computeEqualPowerCrossfade(i, 5000);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const cross = computeEqualPowerCrossfade(i % 5000, 5000);
      assert.ok(cross.totalPower > 0.99 && cross.totalPower < 1.01);
    }
    const duration = performance.now() - start;

    assert.ok(
      duration < 50,
      `computeEqualPowerCrossfade took ${duration.toFixed(2)}ms, budget is 50ms`,
    );
  });

  it('classifyStreamInput completes 5,000 iterations within budget (<30ms)', () => {
    const iterations = 5_000;
    const testInputs = [
      'file:///data/user/0/fun.openjam/files/vault/track.mp3',
      'dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=test',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'https://api.openjam.fun/stream/dQw4w9WgXcQ',
      'not_a_valid_id_song_title',
    ];

    // Warm-up
    for (let i = 0; i < 200; i++) {
      classifyStreamInput(testInputs[i % testInputs.length]);
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const input = testInputs[i % testInputs.length];
      const classified = classifyStreamInput(input);
      assert.ok(classified !== null);
      if (input.includes('dQw4w9WgXcQ')) {
        assert.equal(classified.parsedYouTubeId, 'dQw4w9WgXcQ');
      }
    }
    const duration = performance.now() - start;
    const perCallUs = (duration / iterations) * 1000;

    assert.ok(
      duration < 30,
      `classifyStreamInput took ${duration.toFixed(2)}ms (${perCallUs.toFixed(2)}µs/call), budget is 30ms`,
    );
  });

  it('reconcileIncomingChatMessage completes 1,000 updates over 200-item buffer (<100ms)', () => {
    // Generate realistic 200 message buffer
    const initialList: ChatMessage[] = Array.from({ length: 200 }, (_, idx) => ({
      id: `msg-${idx}`,
      user_id: `user-${idx % 10}`,
      user_name: `Listener ${idx % 10}`,
      content: `Chat message payload test ${idx}`,
      timestamp: Date.now() - (200 - idx) * 1000,
    }));

    const seenIds = new Set<string>(initialList.map((m) => m.id));
    let currentList = [...initialList];

    // Add optimistic pending message to state
    currentList.push({
      id: 'temp_9999',
      user_id: 'me',
      user_name: 'You',
      content: 'Hello everyone!',
      timestamp: Date.now(),
    });
    seenIds.add('temp_9999');

    const iterations = 1_000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const isOptimisticConfirm = i % 100 === 0;
      const incoming: ChatMessage = isOptimisticConfirm
        ? {
            id: `server-msg-${i}`,
            temp_id: 'temp_9999',
            user_id: 'me',
            user_name: 'You',
            content: 'Hello everyone!',
            timestamp: Date.now(),
          }
        : {
            id: `server-msg-${i}`,
            user_id: `user-${i % 15}`,
            user_name: `Listener ${i % 15}`,
            content: `Broadcast chat item ${i}`,
            timestamp: Date.now(),
          };

      currentList = reconcileIncomingChatMessage(
        currentList,
        incoming,
        seenIds,
        'me',
        'You',
      );
    }
    const duration = performance.now() - start;
    const perCallMs = duration / iterations;

    // Buffer capped at 200 messages
    assert.equal(currentList.length, 200);
    // Each call must be well under 0.1ms (100µs)
    assert.ok(
      duration < 100,
      `reconcileIncomingChatMessage took ${duration.toFixed(2)}ms (${perCallMs.toFixed(3)}ms/reconciliation), budget is 100ms`,
    );
  });

  it('updateTypingUsersList completes 5,000 operations within budget (<20ms)', () => {
    let typing: string[] = ['Alice', 'Bob'];
    const iterations = 5_000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const user = `User_${i % 10}`;
      typing = updateTypingUsersList(typing, user, 'You', i % 2 === 0);
    }
    const duration = performance.now() - start;

    assert.ok(
      duration < 20,
      `updateTypingUsersList took ${duration.toFixed(2)}ms, budget is 20ms`,
    );
  });
});
