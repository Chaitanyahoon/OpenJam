/**
 * NTP-style clock sync engine, ported from the web app
 * (frontend-next/app/room/[id]/RoomClient.js).
 *
 * The server is the source of truth for "what should be playing at time T".
 * Each client measures its clock offset via sync_ping/sync_pong, then converts
 * server timestamps into local playback targets.
 */
import type { PlaybackSyncPayload, SyncPongPayload } from './protocol';

const MAX_SAMPLES = 8;
/** Matches the web app's outlier filter (cold-start / sleep spikes). */
const MAX_RTT_MS = 1800;

export class SyncEngine {
  private samples: number[] = [];

  /**
   * Feed a sync_pong response. Returns the new median offset, or null if the
   * sample was rejected as an outlier.
   *
   * Math (identical to web app):
   *   rtt    = (t3 - t0) - (t2 - t1)
   *   offset = ((t1 - t0) + (t2 - t3)) / 2
   */
  measure(pong: SyncPongPayload): number | null {
    const t3 = Date.now();
    const { t0, t1, t2 } = pong;
    const rtt = t3 - t0 - (t2 - t1);
    if (rtt < 0 || rtt > MAX_RTT_MS) return null;
    const offset = ((t1 - t0) + (t2 - t3)) / 2;
    this.samples.push(offset);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    return this.offset;
  }

  /** Median of collected offsets; 0 when no samples yet. */
  get offset(): number {
    if (this.samples.length === 0) return 0;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /** True once we have enough samples to trust the offset. */
  get reliable(): boolean {
    return this.samples.length >= 3;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  /** Drop all samples — call on socket disconnect/reconnect. */
  reset(): void {
    this.samples = [];
  }

  /** Current server time estimate from the local clock. */
  serverNow(): number {
    return Date.now() + this.offset;
  }

  /**
   * Convert a playback_sync payload into the local target position.
   * Mirrors the web app: latency-correct for non-hosts, bounded to [0, 5000ms].
   */
  targetPositionMs(payload: PlaybackSyncPayload, isHost: boolean): number {
    let pos = Math.max(0, payload.position_ms ?? 0);
    if (!isHost && payload.server_timestamp) {
      const latency = this.serverNow() - payload.server_timestamp;
      if (latency > 0 && latency < 5000) pos += latency;
    }
    return pos;
  }
}
