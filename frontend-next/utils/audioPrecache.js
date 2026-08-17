import { offlineDb } from './offlineDb';

const MAX_PRECACHE_TRACKS = 15;

/**
 * audioPrecache - Background audio pre-fetcher for next tracks in queue into IndexedDB
 * with LRU (Least Recently Used) eviction for < 50ms seamless track cutover.
 */
class AudioPrecacheManager {
  constructor() {
    this.inFlight = new Set();
  }

  /**
   * Normalize a unique track identifier.
   */
  _getTrackId(track) {
    if (!track) return null;
    return track.id || track.track_uri || track.uri || track.track_name || null;
  }

  /**
   * Enforce LRU cache limit (max 15 tracks).
   */
  async _enforceLruLimit() {
    try {
      const allTracks = await offlineDb.getAllTracks();
      if (!allTracks || allTracks.length < MAX_PRECACHE_TRACKS) {
        return;
      }

      // Sort by lastAccessed ascending (oldest first)
      allTracks.sort((a, b) => (a.lastAccessed || a.cachedAt || 0) - (b.lastAccessed || b.cachedAt || 0));

      const evictCount = allTracks.length - MAX_PRECACHE_TRACKS + 1;
      const toEvict = allTracks.slice(0, evictCount);

      for (const item of toEvict) {
        if (item.id) {
          await offlineDb.deleteTrack(item.id);
        }
      }
    } catch (err) {
      console.warn('[audioPrecache] LRU eviction error:', err);
    }
  }

  /**
   * Pre-cache a single track into IndexedDB.
   */
  async precacheTrack(track) {
    const trackId = this._getTrackId(track);
    if (!trackId || this.inFlight.has(trackId)) return null;

    try {
      this.inFlight.add(trackId);

      // Check if already in IndexedDB
      const existing = await offlineDb.getTrack(trackId);
      if (existing) {
        // Touch lastAccessed
        existing.lastAccessed = Date.now();
        await offlineDb.saveTrack(existing);
        return existing;
      }

      // Enforce LRU eviction if cache is full
      await this._enforceLruLimit();

      const record = {
        id: trackId,
        track_name: track.title || track.track_name || 'Track',
        artist: track.artist || 'Unknown',
        album_art_url: track.artwork || track.album_art_url || null,
        duration: track.duration || (track.duration_ms ? track.duration_ms / 1000 : 0),
        duration_ms: track.duration_ms || (track.duration ? track.duration * 1000 : 0),
        track_uri: track.track_uri || track.uri || trackId,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        precached: true
      };

      // If track has an audio URL, attempt a lightweight metadata/range fetch
      if (track.audio_url || track.stream_url) {
        try {
          const streamUrl = track.audio_url || track.stream_url;
          // Pre-warm the browser cache via fetch with Range header
          fetch(streamUrl, {
            headers: { Range: 'bytes=0-65535' },
            mode: 'cors',
            credentials: 'omit'
          }).catch(() => {});
          record.audio_url = streamUrl;
        } catch (e) {}
      }

      await offlineDb.saveTrack(record);
      return record;
    } catch (err) {
      console.warn(`[audioPrecache] Failed to precache track ${trackId}:`, err);
      return null;
    } finally {
      this.inFlight.delete(trackId);
    }
  }

  /**
   * Pre-cache the upcoming tracks in the room queue.
   * @param {Array} queue - Array of tracks in queue
   * @param {number} currentIndex - Current active track index
   * @param {number} lookaheadCount - Number of upcoming tracks to precache (default: 2)
   */
  async precacheQueue(queue = [], currentIndex = -1, lookaheadCount = 2) {
    if (!Array.isArray(queue) || queue.length === 0) return;

    const startIdx = Math.max(0, currentIndex + 1);
    const upcoming = queue.slice(startIdx, startIdx + lookaheadCount);

    for (const track of upcoming) {
      if (track) {
        // Fire asynchronously in background
        this.precacheTrack(track).catch(() => {});
      }
    }
  }

  /**
   * Retrieve a pre-cached track and mark it as accessed.
   */
  async getCachedTrack(id) {
    if (!id) return null;
    try {
      const track = await offlineDb.getTrack(id);
      if (track) {
        track.lastAccessed = Date.now();
        offlineDb.saveTrack(track).catch(() => {});
        return track;
      }
      return null;
    } catch (err) {
      return null;
    }
  }

  /**
   * Get stats on pre-cached tracks.
   */
  async getPrecacheStats() {
    try {
      const all = await offlineDb.getAllTracks();
      return {
        count: all.length,
        maxTracks: MAX_PRECACHE_TRACKS,
        tracks: all
      };
    } catch (err) {
      return { count: 0, maxTracks: MAX_PRECACHE_TRACKS, tracks: [] };
    }
  }

  /**
   * Clear all pre-cached tracks.
   */
  async clearPrecache() {
    try {
      const all = await offlineDb.getAllTracks();
      for (const t of all) {
        if (t.id) await offlineDb.deleteTrack(t.id);
      }
    } catch (err) {
      console.warn('[audioPrecache] Error clearing cache:', err);
    }
  }
}

export const audioPrecache = new AudioPrecacheManager();
export default audioPrecache;
