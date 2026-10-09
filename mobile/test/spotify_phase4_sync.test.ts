import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SyncEngine, computeEqualPowerCrossfade } from '../src/sync/engine.ts';

describe('Phase 4: 3-Tier Jam Sync & Equal-Power Crossfade Suite', () => {
  it('classifies Tier 1 inaudible drift (<= 15ms) as jitter buffer absorption', () => {
    const engine = new SyncEngine();
    const evalZero = engine.evaluateDrift(10000, 10000);
    assert.strictEqual(evalZero.tier, 1);
    assert.strictEqual(evalZero.action, 'jitter_buffer');
    assert.strictEqual(evalZero.suggestedRate, 1.0);
    assert.strictEqual(evalZero.driftMs, 0);

    const evalPlus10 = engine.evaluateDrift(10000, 10010);
    assert.strictEqual(evalPlus10.tier, 1);
    assert.strictEqual(evalPlus10.action, 'jitter_buffer');
    assert.strictEqual(evalPlus10.suggestedRate, 1.0);
    assert.strictEqual(evalPlus10.driftMs, 10);

    const evalMinus15 = engine.evaluateDrift(10015, 10000);
    assert.strictEqual(evalMinus15.tier, 1);
    assert.strictEqual(evalMinus15.action, 'jitter_buffer');
    assert.strictEqual(evalMinus15.suggestedRate, 1.0);
    assert.strictEqual(evalMinus15.driftMs, -15);
  });

  it('classifies Tier 2 pitch-neutral rate steering (15ms - 150ms) with proportional rates', () => {
    const engine = new SyncEngine();
    // Client is behind by 60ms -> speed up slightly (rate > 1.0)
    const evalBehind = engine.evaluateDrift(10000, 10060);
    assert.strictEqual(evalBehind.tier, 2);
    assert.strictEqual(evalBehind.action, 'rate_steer');
    assert.ok(evalBehind.suggestedRate > 1.0 && evalBehind.suggestedRate <= 1.02);

    // Client is ahead by 150ms -> slow down (rate < 1.0)
    const evalAhead = engine.evaluateDrift(10150, 10000);
    assert.strictEqual(evalAhead.tier, 2);
    assert.strictEqual(evalAhead.action, 'rate_steer');
    assert.ok(evalAhead.suggestedRate < 1.0 && evalAhead.suggestedRate >= 0.98);
    assert.strictEqual(evalAhead.suggestedRate, 0.98); // Max correction for 150ms is -0.02
  });

  it('classifies Tier 3 micro-seek for drift > 150ms', () => {
    const engine = new SyncEngine();
    const evalLarge = engine.evaluateDrift(10000, 10500);
    assert.strictEqual(evalLarge.tier, 3);
    assert.strictEqual(evalLarge.action, 'micro_seek');
    assert.strictEqual(evalLarge.suggestedRate, 1.0);
    assert.strictEqual(evalLarge.targetPositionMs, 10500);
  });

  it('computes constant-energy equal-power crossfade (cos^2 + sin^2 == 1.0)', () => {
    const duration = 4000;

    // Start (t = 0)
    const start = computeEqualPowerCrossfade(0, duration);
    assert.strictEqual(start.volumeOutgoing, 1);
    assert.strictEqual(start.volumeIncoming, 0);
    assert.ok(Math.abs(start.totalPower - 1.0) < 0.0001);

    // Midpoint (t = 2000)
    const mid = computeEqualPowerCrossfade(2000, duration);
    assert.ok(Math.abs(mid.volumeOutgoing - Math.SQRT1_2) < 0.001);
    assert.ok(Math.abs(mid.volumeIncoming - Math.SQRT1_2) < 0.001);
    assert.ok(Math.abs(mid.totalPower - 1.0) < 0.0001);

    // End (t = 4000)
    const end = computeEqualPowerCrossfade(4000, duration);
    assert.ok(Math.abs(end.volumeOutgoing) < 0.0001);
    assert.ok(Math.abs(end.volumeIncoming - 1.0) < 0.0001);
    assert.ok(Math.abs(end.totalPower - 1.0) < 0.0001);
  });

  it('tracks sliding window SNTP minRtt and bounded error ms', () => {
    const engine = new SyncEngine();
    assert.strictEqual(engine.minRtt, 0);
    assert.strictEqual(engine.boundedErrorMs, 0);
    assert.strictEqual(engine.reliable, false);

    const now = Date.now();
    // Simulate 4 pong measurements
    engine.measure({ t0: now - 50, t1: now - 30, t2: now - 25 });
    engine.measure({ t0: now - 40, t1: now - 20, t2: now - 15 });
    engine.measure({ t0: now - 60, t1: now - 40, t2: now - 35 });
    engine.measure({ t0: now - 30, t1: now - 15, t2: now - 10 });

    assert.strictEqual(engine.sampleCount, 4);
    assert.strictEqual(engine.reliable, true);
    assert.ok(engine.minRtt > 0);
    assert.strictEqual(engine.boundedErrorMs, engine.minRtt / 2);
  });
});
