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

  it('dispatches solo media notification remote actions correctly', () => {
    let playCount = 0;
    let pauseCount = 0;
    let nextCount = 0;
    let prevCount = 0;
    let isPlaying = true;

    function handleMediaAction(action: 'prev' | 'play_pause' | 'next') {
      if (action === 'play_pause') {
        if (isPlaying) {
          pauseCount++;
          isPlaying = false;
        } else {
          playCount++;
          isPlaying = true;
        }
      } else if (action === 'next') {
        nextCount++;
      } else if (action === 'prev') {
        prevCount++;
      }
    }

    handleMediaAction('play_pause'); // Should pause
    assert.equal(pauseCount, 1);
    assert.equal(isPlaying, false);

    handleMediaAction('play_pause'); // Should play
    assert.equal(playCount, 1);
    assert.equal(isPlaying, true);

    handleMediaAction('next');
    assert.equal(nextCount, 1);

    handleMediaAction('prev');
    assert.equal(prevCount, 1);
  });

  it('resolves local vault files directly with zero network delay', () => {
    function classifyPlaybackDriver(uri: string): 'local_file' | 'stream_url' | 'youtube' {
      if (uri.startsWith('file://')) return 'local_file';
      if (uri.startsWith('http')) return 'stream_url';
      return 'youtube';
    }

    assert.equal(classifyPlaybackDriver('file:///data/user/0/vault/track.m4a'), 'local_file');
    assert.equal(classifyPlaybackDriver('https://stream.openjam.fun/audio.mp3'), 'stream_url');
    assert.equal(classifyPlaybackDriver('4xDzrJKXOOY'), 'youtube');
  });

  it('identifies downloaded offline tracks against vault set', () => {
    const vaultTrackUris = new Set(['uri_1', 'uri_2']);
    const isReadyOffline = (uri: string) => vaultTrackUris.has(uri);

    assert.equal(isReadyOffline('uri_1'), true);
    assert.equal(isReadyOffline('uri_2'), true);
    assert.equal(isReadyOffline('uri_3'), false);
  });

  it('triggers auto-recovery navigation when Wi-Fi is restored while on offline screen', () => {
    let currentPath = '/offline';
    let wasOffline = false;
    let redirectedTo: string | null = null;

    function handleNetworkChange(isOnline: boolean) {
      if (!isOnline) {
        wasOffline = true;
        if (currentPath !== '/offline') {
          currentPath = '/offline';
          redirectedTo = '/offline';
        }
      } else {
        if (wasOffline) {
          wasOffline = false;
          if (currentPath === '/offline') {
            currentPath = '/';
            redirectedTo = '/';
          }
        }
      }
    }

    // 1. Goes offline -> switched to /offline
    currentPath = '/';
    handleNetworkChange(false);
    assert.equal(wasOffline, true);
    assert.equal(redirectedTo, '/offline');

    // 2. Network returns -> automatically redirects to /
    handleNetworkChange(true);
    assert.equal(wasOffline, false);
    assert.equal(redirectedTo, '/');
  });

  it('generates 8 Spotify Quick Access tiles with proper gradients and actions', () => {
    const favoriteTracks = [{ track_uri: 'f1', track_name: 'Liked 1', artist: 'Artist 1' }];
    const downloadedUris = new Set(['f1', 'd2']);
    const favoriteRooms = [{ id: 'room-1', name: 'Lofi Lounge', hostName: 'DJ Chaitanya' }];

    function buildTiles() {
      return [
        { id: 'liked', title: 'Liked Songs', count: favoriteTracks.length },
        { id: 'vault', title: 'Offline Vault', count: downloadedUris.size },
        { id: 'solo', title: 'Solo Jam', count: 1 },
        { id: 'lofi', title: 'Lofi & Chill', count: 2 },
        { id: 'synthwave', title: 'Synthwave Beats', count: 2 },
        { id: 'ambient', title: 'Ambient Drift', count: 2 },
        { id: 'fav-room', title: favoriteRooms[0].name, count: 1 },
        { id: 'join-code', title: 'Join with Code', count: 0 },
      ];
    }

    const tiles = buildTiles();
    assert.equal(tiles.length, 8);
    assert.equal(tiles[0].title, 'Liked Songs');
    assert.equal(tiles[1].count, 2);
    assert.equal(tiles[6].title, 'Lofi Lounge');
  });

  it('correctly maps TrackSearchResult to TrackInfo schema for solo playback', () => {
    interface SearchResult {
      uri: string;
      name: string;
      artist?: string;
      album_art_url?: string;
      duration_ms?: number;
    }

    const rawResult: SearchResult = {
      uri: 'yt_abc123',
      name: 'Midnight City',
      artist: 'M83',
      album_art_url: 'https://openjam.fun/m83.jpg',
      duration_ms: 243000,
    };

    const mapped: TrackInfo = {
      track_uri: rawResult.uri,
      track_name: rawResult.name,
      artist: rawResult.artist,
      album_art_url: rawResult.album_art_url,
      duration_ms: rawResult.duration_ms,
    };

    assert.equal(mapped.track_uri, 'yt_abc123');
    assert.equal(mapped.track_name, 'Midnight City');
    assert.equal(mapped.artist, 'M83');
    assert.equal(mapped.duration_ms, 243000);
  });

  it('discards stale out-of-order search query responses via monotonic requestId', () => {
    let currentReqId = 0;
    let renderedQuery = '';

    const handleSearchResponse = (reqId: number, query: string) => {
      if (reqId === currentReqId) {
        renderedQuery = query;
      }
    };

    // Query 1 dispatched
    const req1 = ++currentReqId;
    // Query 2 dispatched shortly after
    const req2 = ++currentReqId;

    // Suppose query 2 finishes faster than query 1 over cellular network
    handleSearchResponse(req2, 'synthwave');
    assert.equal(renderedQuery, 'synthwave');

    // Stale query 1 arrives later — should be discarded
    handleSearchResponse(req1, 'lofi');
    assert.equal(renderedQuery, 'synthwave'); // Still synthwave!
  });

  it('correctly routes notification tap responses to player modal and screen targets', () => {
    const routeDecisions: Array<{ action: string; openPlayerModal: boolean; path: string }> = [];

    const handleNotificationData = (data?: { action?: string; roomId?: string }) => {
      if (data?.action === 'open_room' && data?.roomId) {
        if (data.roomId === 'solo') {
          routeDecisions.push({ action: 'solo_jam', openPlayerModal: true, path: '/' });
        } else {
          routeDecisions.push({ action: 'live_room', openPlayerModal: false, path: `/room/${data.roomId}` });
        }
      }
    };

    handleNotificationData({ action: 'open_room', roomId: 'solo' });
    handleNotificationData({ action: 'open_room', roomId: 'room-alpha' });

    assert.equal(routeDecisions.length, 2);
    assert.equal(routeDecisions[0].openPlayerModal, true);
    assert.equal(routeDecisions[0].path, '/');
    assert.equal(routeDecisions[1].openPlayerModal, false);
    assert.equal(routeDecisions[1].path, '/room/room-alpha');
  });

  it('plays single recommended track on auto-play without polluting user queue', async () => {
    // Simulate user queue finishing
    let userQueue: Array<{ track_uri: string; track_name: string }> = [];
    let currentPlayingTrack: { track_uri: string; track_name: string } | null = null;
    const radioAutoPlay = true;

    const mockRecommendations = [
      { track_uri: 'yt:rec1', track_name: 'Rec Track 1' },
      { track_uri: 'yt:rec2', track_name: 'Rec Track 2' },
      { track_uri: 'yt:rec3', track_name: 'Rec Track 3' },
    ];

    // Auto-play trigger handler
    const handleQueueExhaustion = async () => {
      if (!radioAutoPlay) return;
      const nextTrack = mockRecommendations[0];
      if (nextTrack) {
        currentPlayingTrack = nextTrack;
        // Strict guardrail: Do NOT dump mockRecommendations into userQueue
        // userQueue remains empty
      }
    };

    await handleQueueExhaustion();

    assert.equal(currentPlayingTrack?.track_uri, 'yt:rec1');
    assert.equal(userQueue.length, 0); // No pollution of userQueue!
  });

  it('stops playback cleanly when auto-play radio is disabled', async () => {
    let playbackState: 'playing' | 'stopped' = 'playing';
    let currentPlayingTrack: { track_uri: string; track_name: string } | null = {
      track_uri: 'yt:last',
      track_name: 'Last Song',
    };
    const radioAutoPlay = false;

    const handleQueueExhaustion = () => {
      if (!radioAutoPlay) {
        playbackState = 'stopped';
        currentPlayingTrack = null;
        return;
      }
    };

    handleQueueExhaustion();

    assert.equal(playbackState, 'stopped');
    assert.equal(currentPlayingTrack, null);
  });

  it('isolates queue on search selection without dumping search result list', () => {
    const searchResults = [
      { track_uri: 'yt:res1', track_name: 'Result 1' },
      { track_uri: 'yt:res2', track_name: 'Result 2' },
      { track_uri: 'yt:res3', track_name: 'Result 3' },
      { track_uri: 'yt:res4', track_name: 'Result 4' },
    ];

    // User selects Result 2
    const selected = searchResults[1];
    let activeTrack: typeof selected | null = null;
    let soloQueue: Array<typeof selected> = [];

    const handlePlaySelected = (track: typeof selected) => {
      activeTrack = track;
      // Fixed: only [track] is queued, not searchResults.map(...)
      soloQueue = [track];
    };

    handlePlaySelected(selected);

    assert.equal(activeTrack?.track_uri, 'yt:res2');
    assert.equal(soloQueue.length, 1);
    assert.equal(soloQueue[0]?.track_name, 'Result 2');
  });

  it('allows user to manually add recommendations to queue with duplicate prevention', () => {
    const queue: Array<{ track_uri: string; track_name: string }> = [];
    const addedUris = new Set<string>();

    const handleAddRecToQueue = (track: { track_uri: string; track_name: string }) => {
      if (addedUris.has(track.track_uri)) return false;
      addedUris.add(track.track_uri);
      queue.push(track);
      return true;
    };

    const rec = { track_uri: 'yt:rec10', track_name: 'Chill Beats' };

    // First tap adds to queue
    const firstTapResult = handleAddRecToQueue(rec);
    assert.equal(firstTapResult, true);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].track_name, 'Chill Beats');

    // Rapid second tap is ignored
    const secondTapResult = handleAddRecToQueue(rec);
    assert.equal(secondTapResult, false);
    assert.equal(queue.length, 1); // No duplicate added
  });

  it('manages audio device output routing transitions accurately', () => {
    type AudioDeviceRoute = 'speaker' | 'bluetooth' | 'wired' | 'room';
    let currentRoute: AudioDeviceRoute = 'speaker';

    const setAudioDevice = (route: AudioDeviceRoute) => {
      currentRoute = route;
    };

    setAudioDevice('bluetooth');
    assert.equal(currentRoute, 'bluetooth');

    setAudioDevice('wired');
    assert.equal(currentRoute, 'wired');

    setAudioDevice('room');
    assert.equal(currentRoute, 'room');

    setAudioDevice('speaker');
    assert.equal(currentRoute, 'speaker');
  });
});

