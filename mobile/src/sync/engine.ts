/**
 * Spotify-Grade 3-Tier Jam Synchronization & SNTP Clock Engine.
 *
 * Capabilities:
 * - 8-sample sliding window SNTP filter with minimum RTT tracking (error <= RTT_min / 2).
 * - 3-tier drift compensation hierarchy:
 *   - Tier 1 (<= 15ms): Absorbed by jitter buffer elasticity (inaudible, no action).
 *   - Tier 2 (15ms - 150ms): Pitch-neutral rate steering (0.98x - 1.02x) for seamless alignment.
 *   - Tier 3 (> 150ms): Crossfaded micro-seek to server target position.
 * - Constant-energy trigonometric equal-power crossfade (cos^2 + sin^2 == 1.0).
 */
import type { PlaybackSyncPayload, SyncPongPayload } from './protocol';

const MAX_SAMPLES = 8;
const MAX_RTT_MS = 1800;

export interface SntpSample {
  rtt: number;
  offset: number;
  recordedAt: number;
}

export type DriftTier = 1 | 2 | 3;

export interface DriftEvaluation {
  tier: DriftTier;
  action: 'jitter_buffer' | 'rate_steer' | 'micro_seek';
  driftMs: number;
  suggestedRate: number;
  targetPositionMs: number;
}

export class SyncEngine {
  private samples: SntpSample[] = [];

  /**
   * Feed a sync_pong response. Records 4-timestamp SNTP measurement into
   * sliding window of 8 samples. Returns the new median offset or null if outlier.
   */
  measure(pong: SyncPongPayload): number | null {
    const t3 = Date.now();
    const { t0, t1, t2 } = pong;
    const rtt = t3 - t0 - (t2 - t1);
    if (rtt < 0 || rtt > MAX_RTT_MS) return null;

    const offset = ((t1 - t0) + (t2 - t3)) / 2;
    this.samples.push({ rtt, offset, recordedAt: t3 });
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.shift();
    }
    return this.offset;
  }

  /**
   * Best-sample minimum RTT in active window.
   */
  get minRtt(): number {
    if (this.samples.length === 0) return 0;
    return Math.min(...this.samples.map((s) => s.rtt));
  }

  /**
   * Theoretical clock estimation error bound (Error <= RTT_min / 2).
   */
  get boundedErrorMs(): number {
    return this.minRtt / 2;
  }

  /**
   * Median clock offset across active sliding window.
   */
  get offset(): number {
    if (this.samples.length === 0) return 0;
    const offsets = this.samples.map((s) => s.offset).sort((a, b) => a - b);
    const mid = Math.floor(offsets.length / 2);
    return offsets.length % 2 === 0
      ? (offsets[mid - 1] + offsets[mid]) / 2
      : offsets[mid];
  }

  /**
   * True once we have accumulated >= 3 valid measurements.
   */
  get reliable(): boolean {
    return this.samples.length >= 3;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  /**
   * Reset sliding window (call on network disconnect/reconnect).
   */
  reset(): void {
    this.samples = [];
  }

  /**
   * Current server time estimate from local clock + offset.
   */
  serverNow(): number {
    return Date.now() + this.offset;
  }

  /**
   * Convert playback_sync payload into local target playback position.
   */
  targetPositionMs(payload: PlaybackSyncPayload, isHost: boolean): number {
    let pos = Math.max(0, payload.position_ms ?? 0);
    if (!isHost && payload.server_timestamp) {
      const latency = this.serverNow() - payload.server_timestamp;
      if (latency > 0 && latency < 5000) pos += latency;
    }
    return pos;
  }

  /**
   * 3-Tier Multi-Device Drift Evaluation:
   * Categorizes drift into Tier 1 (buffer), Tier 2 (rate steer), or Tier 3 (micro-seek).
   */
  evaluateDrift(clientPosMs: number, targetMs: number): DriftEvaluation {
    const driftMs = targetMs - clientPosMs;
    const absDrift = Math.abs(driftMs);

    // Tier 1: Inaudible Jitter (|Δ| <= 15ms)
    if (absDrift <= 15) {
      return {
        tier: 1,
        action: 'jitter_buffer',
        driftMs,
        suggestedRate: 1.0,
        targetPositionMs: targetMs,
      };
    }

    // Tier 2: Pitch-Neutral Rate Steering (15ms < |Δ| <= 150ms)
    if (absDrift <= 150) {
      // Proportional speed adjustment: 1.0 ± 0.02 (0.98x - 1.02x)
      const correction = Math.sign(driftMs) * Math.min(0.02, (absDrift / 150) * 0.02);
      const suggestedRate = Math.max(0.98, Math.min(1.02, 1.0 + correction));
      return {
        tier: 2,
        action: 'rate_steer',
        driftMs,
        suggestedRate,
        targetPositionMs: targetMs,
      };
    }

    // Tier 3: Crossfaded Micro-Seek (|Δ| > 150ms)
    return {
      tier: 3,
      action: 'micro_seek',
      driftMs,
      suggestedRate: 1.0,
      targetPositionMs: targetMs,
    };
  }
}

/**
 * Constant-Energy Equal-Power Trigonometric Crossfade (cos^2 + sin^2 == 1.0).
 * Prevents the 3dB acoustic power dip of linear crossfading.
 */
export function computeEqualPowerCrossfade(
  elapsedMs: number,
  durationMs: number,
): { volumeOutgoing: number; volumeIncoming: number; totalPower: number } {
  if (durationMs <= 0) {
    return { volumeOutgoing: 0, volumeIncoming: 1, totalPower: 1 };
  }
  const norm = Math.max(0, Math.min(1, elapsedMs / durationMs));
  const volumeOutgoing = Math.cos((Math.PI / 2) * norm);
  const volumeIncoming = Math.sin((Math.PI / 2) * norm);
  const totalPower = volumeOutgoing * volumeOutgoing + volumeIncoming * volumeIncoming;
  return { volumeOutgoing, volumeIncoming, totalPower };
}
