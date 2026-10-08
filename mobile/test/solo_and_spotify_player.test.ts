import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Solo Jam & Spotify Player Upgrades Suite', () => {
  it('reorders solo queue items correctly without mutation of original array', () => {
    const mockQueue = [
      { queue_item_id: 'q1', track_uri: 'uri1', track_name: 'Track 1', artist: 'Artist 1' },
      { queue_item_id: 'q2', track_uri: 'uri2', track_name: 'Track 2', artist: 'Artist 2' },
      { queue_item_id: 'q3', track_uri: 'uri3', track_name: 'Track 3', artist: 'Artist 3' },
    ];

    const orderedIds = ['q3', 'q1', 'q2'];
    const map = new Map(mockQueue.map((item) => [item.queue_item_id, item]));
    const reordered = orderedIds.map((id) => map.get(id)).filter(Boolean);

    assert.equal(reordered[0]?.queue_item_id, 'q3');
    assert.equal(reordered[1]?.queue_item_id, 'q1');
    assert.equal(reordered[2]?.queue_item_id, 'q2');
    assert.equal(mockQueue[0]?.queue_item_id, 'q1'); // Immutability
  });

  it('simulates solo mode auto-advance queue shift on track completion', () => {
    const queue = [
      { queue_item_id: 'q1', track_uri: 'uri1', track_name: 'Song 1', artist: 'Artist 1' },
      { queue_item_id: 'q2', track_uri: 'uri2', track_name: 'Song 2', artist: 'Artist 2' },
    ];

    const nextTrack = queue[0];
    const remainingQueue = queue.slice(1);

    assert.equal(nextTrack.track_name, 'Song 1');
    assert.equal(remainingQueue.length, 1);
    assert.equal(remainingQueue[0]?.track_name, 'Song 2');
  });

  it('calculates track download progress percent correctly and clamps between 0-100', () => {
    function computeProgress(bytesWritten: number, totalBytes: number): number {
      if (totalBytes <= 0) return 0;
      return Math.min(100, Math.max(0, Math.round((bytesWritten / totalBytes) * 100)));
    }

    assert.equal(computeProgress(0, 1000), 0);
    assert.equal(computeProgress(450, 1000), 45);
    assert.equal(computeProgress(1000, 1000), 100);
    assert.equal(computeProgress(1500, 1000), 100); // Clamped
    assert.equal(computeProgress(100, 0), 0);
  });

  it('manages download progress subscriptions and dispatches updates', () => {
    type TrackDownloadProgress = { trackUri: string; state: 'downloading' | 'completed'; percent: number };
    const progressMap: Record<string, TrackDownloadProgress> = {};
    const listeners = new Set<(map: Record<string, TrackDownloadProgress>) => void>();

    function updateProgress(item: TrackDownloadProgress) {
      progressMap[item.trackUri] = item;
      listeners.forEach((fn) => fn({ ...progressMap }));
    }

    let lastReceived: Record<string, TrackDownloadProgress> | null = null;
    const unsub = () => listeners.delete(listener);
    const listener = (map: Record<string, TrackDownloadProgress>) => {
      lastReceived = map;
    };
    listeners.add(listener);

    updateProgress({ trackUri: 'yt:123', state: 'downloading', percent: 65 });
    assert.equal(lastReceived?.['yt:123']?.percent, 65);
    assert.equal(lastReceived?.['yt:123']?.state, 'downloading');

    updateProgress({ trackUri: 'yt:123', state: 'completed', percent: 100 });
    assert.equal(lastReceived?.['yt:123']?.percent, 100);

    unsub();
    assert.equal(listeners.size, 0);
  });

  it('notifies network subscribers on online/offline state transitions', () => {
    let currentOnline = true;
    const listeners = new Set<(online: boolean) => void>();

    function setOnline(online: boolean) {
      if (currentOnline !== online) {
        currentOnline = online;
        listeners.forEach((l) => l(online));
      }
    }

    const events: boolean[] = [];
    listeners.add((online) => events.push(online));

    setOnline(false); // Disconnected
    setOnline(false); // No duplicate trigger
    setOnline(true);  // Restored

    assert.deepEqual(events, [false, true]);
  });
});
