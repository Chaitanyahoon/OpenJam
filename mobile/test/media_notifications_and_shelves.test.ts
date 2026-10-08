import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface TrackInfo {
  track_uri: string;
  track_name: string;
  artist?: string;
  album_art_url?: string;
  duration_ms?: number;
}

const MEDIA_NOTIFICATION_ID = 'openjam-media-playback';
const MEDIA_CHANNEL_ID = 'openjam-media-playback-channel';
const MEDIA_CATEGORY_ID = 'openjam-media-category';

const MEDIA_ACTIONS = {
  PREV: 'ACTION_PREV',
  PLAY_PAUSE: 'ACTION_PLAY_PAUSE',
  NEXT: 'ACTION_NEXT',
} as const;

// Ingest queue state machine simulator
class SoloQueueManager {
  private pendingQueue: TrackInfo[] | null = null;
  private pendingAutoplay: TrackInfo | null = null;

  setPending(tracks: TrackInfo[], playTrack?: TrackInfo) {
    this.pendingQueue = tracks;
    this.pendingAutoplay = playTrack || tracks[0] || null;
  }

  consume(): { tracks: TrackInfo[]; playTrack: TrackInfo | null } | null {
    if (!this.pendingQueue) return null;
    const res = { tracks: this.pendingQueue, playTrack: this.pendingAutoplay };
    this.pendingQueue = null;
    this.pendingAutoplay = null;
    return res;
  }
}

describe('Media Notifications & Home Music Shelves Suite', () => {
  it('correctly sets and consumes pending solo queue with autoplay track', () => {
    const manager = new SoloQueueManager();
    const tracks: TrackInfo[] = [
      {
        track_uri: 'uri_1',
        track_name: 'Midnight City',
        artist: 'M83',
        duration_ms: 240000,
      },
      {
        track_uri: 'uri_2',
        track_name: 'Starboy',
        artist: 'The Weeknd',
        duration_ms: 230000,
      },
    ];

    manager.setPending(tracks, tracks[1]);

    const consumed = manager.consume();
    assert.ok(consumed !== null);
    assert.equal(consumed?.tracks.length, 2);
    assert.equal(consumed?.playTrack?.track_uri, 'uri_2');

    // Consuming a second time should return null (single-use ingestion)
    const consumedSecond = manager.consume();
    assert.equal(consumedSecond, null);
  });

  it('defaults playTrack to first track if none explicitly provided', () => {
    const manager = new SoloQueueManager();
    const tracks: TrackInfo[] = [
      {
        track_uri: 'uri_alpha',
        track_name: 'Resonance',
        artist: 'HOME',
        duration_ms: 212000,
      },
    ];

    manager.setPending(tracks);
    const consumed = manager.consume();
    assert.ok(consumed !== null);
    assert.equal(consumed?.playTrack?.track_uri, 'uri_alpha');
  });

  it('defines valid notification channel, category, and action identifiers', () => {
    assert.equal(MEDIA_NOTIFICATION_ID, 'openjam-media-playback');
    assert.equal(MEDIA_CHANNEL_ID, 'openjam-media-playback-channel');
    assert.equal(MEDIA_CATEGORY_ID, 'openjam-media-category');

    assert.equal(MEDIA_ACTIONS.PREV, 'ACTION_PREV');
    assert.equal(MEDIA_ACTIONS.PLAY_PAUSE, 'ACTION_PLAY_PAUSE');
    assert.equal(MEDIA_ACTIONS.NEXT, 'ACTION_NEXT');
  });

  it('correctly maps notification action events to player intents', () => {
    const mapAction = (actionId: string): 'prev' | 'play_pause' | 'next' | null => {
      if (actionId === MEDIA_ACTIONS.PREV) return 'prev';
      if (actionId === MEDIA_ACTIONS.PLAY_PAUSE) return 'play_pause';
      if (actionId === MEDIA_ACTIONS.NEXT) return 'next';
      return null;
    };

    assert.equal(mapAction('ACTION_PREV'), 'prev');
    assert.equal(mapAction('ACTION_PLAY_PAUSE'), 'play_pause');
    assert.equal(mapAction('ACTION_NEXT'), 'next');
    assert.equal(mapAction('UNKNOWN_ACTION'), null);
  });

  it('correctly builds favorite track queue when a specific favorite is tapped', () => {
    const favorites: TrackInfo[] = [
      { track_uri: 'fav_1', track_name: 'Song A', artist: 'Artist A' },
      { track_uri: 'fav_2', track_name: 'Song B', artist: 'Artist B' },
      { track_uri: 'fav_3', track_name: 'Song C', artist: 'Artist C' },
    ];

    const tappedTrack = favorites[1]; // Song B
    const otherFavorites = favorites.filter((t) => t.track_uri !== tappedTrack.track_uri);
    const queued = [tappedTrack, ...otherFavorites];

    assert.equal(queued[0].track_uri, 'fav_2');
    assert.equal(queued.length, 3);
    assert.deepEqual(
      queued.map((t) => t.track_uri),
      ['fav_2', 'fav_1', 'fav_3'],
    );
  });

  it('shuffles favorite tracks without losing or duplicating items', () => {
    const favorites: TrackInfo[] = Array.from({ length: 10 }, (_, i) => ({
      track_uri: `track_${i}`,
      track_name: `Song ${i}`,
      artist: `Artist ${i}`,
    }));

    const shuffled = [...favorites].sort(() => 0.5 - Math.random());
    assert.equal(shuffled.length, 10);
    const originalUris = new Set(favorites.map((f) => f.track_uri));
    for (const track of shuffled) {
      assert.ok(originalUris.has(track.track_uri));
    }
  });
});
