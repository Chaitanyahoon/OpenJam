/**
 * Audio driver — Dual engine: Expo Audio + YouTube Audio Bridge.
 *
 * Capabilities:
 * - Direct streams & local files: played via native `expo-audio`.
 * - YouTube tracks: multi-tier resolution (Cobalt/Piped/Invidious direct stream)
 *   with local Vault caching and backend stream proxy failover.
 * - Global Solo Player queue state (Up Next, Shuffle, Repeat, Like, Radio recommendations).
 * - Full Android media notification & lock-screen sync with remote control handlers.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  preload,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { getBackendUrl } from '../api';
import { resolveAudioStream, parseYouTubeId } from './streamResolver';
import {
  isFavoriteTrack,
  toggleFavoriteTrack,
  recordTrackPlayed,
  subscribeFavoriteTracks,
} from '../storage/history';
import type { TrackInfo } from '../sync/protocol';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  updateMediaNotification,
  dismissMediaNotification,
  registerMediaActionListener,
} from '../notifications';

export interface LockScreenMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type AudioDeviceRoute = 'speaker' | 'bluetooth' | 'wired';

export interface PlayerControls {
  // Low-level controls (used by Room sync engine & Solo mode)
  loadTrack: (urlOrId: string, meta: LockScreenMeta) => Promise<void>;
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => Promise<void>;
  positionMs: () => number;
  updateMeta: (meta: LockScreenMeta) => void;
  setLockScreenActive: (active: boolean, meta?: LockScreenMeta) => void;
  volume: number;
  setVolume: (v: number) => void;
  duckVolume: (targetRatio?: number, durationMs?: number) => void;
  restoreVolume: (durationMs?: number) => void;
  isSeekingRecently: () => boolean;
  setOnTrackEnded: (cb: (() => void) | null) => void;
  setOnTrackError: (cb: ((code: number | string) => void) | null) => void;

  // High-level Solo & Spotify Player State
  currentTrack: TrackInfo | null;
  queue: TrackInfo[];
  currentIndex: number;
  shuffle: boolean;
  repeat: RepeatMode;
  isLiked: boolean;
  isPlayerModalOpen: boolean;
  sourceTitle: string;

  playTrack: (
    track: TrackInfo,
    newQueue?: TrackInfo[],
    options?: { sourceTitle?: string; autoPlay?: boolean; initialPositionMs?: number; index?: number },
  ) => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  toggleLike: () => Promise<boolean>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlayerModalOpen: (open: boolean) => void;
  setQueue: (queue: TrackInfo[]) => void;
  addToQueue: (track: TrackInfo) => void;
  playNextInQueue: (track: TrackInfo) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearUpcomingQueue: () => void;

  // Audio Device Routing & Radio Auto-Play
  activeAudioDevice: AudioDeviceRoute;
  setAudioDevice: (device: AudioDeviceRoute) => void;
  radioAutoPlay: boolean;
  toggleRadioAutoPlay: () => void;
  setSourceTitle: (title: string) => void;
  clearPlayback: () => void;
}

export interface PlayerStatus {
  playing: boolean;
  loaded: boolean;
  durationMs: number;
}

const ControlsCtx = createContext<PlayerControls | null>(null);
const StatusCtx = createContext<PlayerStatus>({
  playing: false,
  loaded: false,
  durationMs: 0,
});

export { parseYouTubeId };

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, {
    updateInterval: 150,
    keepAudioSessionActive: true,
    preferredForwardBufferDuration: 180,
  });
  const status = useAudioPlayerStatus(player);
  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);
  volumeRef.current = volume;

  // Solo Player & Spotify state
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [queue, setQueueState] = useState<TrackInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [isLiked, setIsLiked] = useState(false);
  const [isPlayerModalOpen, setPlayerModalOpen] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('Solo Jam');

  const [activeAudioDevice, setActiveAudioDeviceState] = useState<AudioDeviceRoute>('speaker');
  const [radioAutoPlay, setRadioAutoPlayState] = useState<boolean>(false);
  const radioAutoPlayRef = useRef(false);
  radioAutoPlayRef.current = radioAutoPlay;

  const currentTrackRef = useRef<TrackInfo | null>(null);
  currentTrackRef.current = currentTrack;
  const queueRef = useRef<TrackInfo[]>([]);
  queueRef.current = queue;
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  const repeatRef = useRef<RepeatMode>('off');
  repeatRef.current = repeat;
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;
  const lastFinishedUriRef = useRef<string | null>(null);

  // Load saved device output route and radio autoplay preference
  useEffect(() => {
    AsyncStorage.getItem('@openjam_audio_route')
      .then((saved) => {
        if (saved === 'speaker' || saved === 'bluetooth' || saved === 'wired') {
          setActiveAudioDeviceState(saved as AudioDeviceRoute);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@openjam_radio_autoplay')
      .then((saved) => {
        if (saved !== null) {
          const val = saved === 'true';
          setRadioAutoPlayState(val);
          radioAutoPlayRef.current = val;
        } else {
          setRadioAutoPlayState(false);
          radioAutoPlayRef.current = false;
        }
      })
      .catch(() => {});
  }, []);

  const setAudioDevice = useCallback((device: AudioDeviceRoute) => {
    setActiveAudioDeviceState(device);
    void AsyncStorage.setItem('@openjam_audio_route', device).catch(() => {});
  }, []);

  const toggleRadioAutoPlay = useCallback(() => {
    setRadioAutoPlayState((prev) => {
      const next = !prev;
      radioAutoPlayRef.current = next;
      void AsyncStorage.setItem('@openjam_radio_autoplay', String(next)).catch(() => {});
      return next;
    });
  }, []);

  // Monotonic position sample for extrapolation between polls
  const sampleRef = useRef({ at: Date.now(), posMs: 0, playing: false });
  const lastSeekTimeRef = useRef(0);

  // Sync liked state whenever currentTrack changes
  useEffect(() => {
    if (!currentTrack?.track_uri) {
      setIsLiked(false);
      return;
    }
    void isFavoriteTrack(currentTrack.track_uri).then(setIsLiked);
  }, [currentTrack]);

  // Keep liked state live if favorite storage changes
  useEffect(() => {
    const unsub = subscribeFavoriteTracks((favs) => {
      if (currentTrackRef.current?.track_uri) {
        const found = favs.some((f) => f.track_uri === currentTrackRef.current?.track_uri);
        setIsLiked(found);
      }
    });
    return unsub;
  }, []);

  // Update sample when Expo Audio polls
  // Update sample when Expo Audio polls
  useEffect(() => {
    sampleRef.current = {
      at: Date.now(),
      posMs: (status.currentTime ?? 0) * 1000,
      playing: !!status.playing,
    };
  }, [status]);

  useEffect(() => {
    const applyAudioMode = () => {
      setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch(() => {});
    };
    applyAudioMode();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') {
        applyAudioMode();
      }
    });
    return () => sub.remove();
  }, []);

  const loadTrack = useCallback(
    async (urlOrId: string, meta: LockScreenMeta): Promise<void> => {
      const stream = await resolveAudioStream(urlOrId, meta);
      if (stream.uri) {
        sampleRef.current = { at: Date.now(), posMs: 0, playing: true };
        player.replace({ uri: stream.uri });
        player.volume = volumeRef.current;
        player.play();
      }

      try {
        if (
          typeof (player as { setActiveForLockScreen?: unknown })
            .setActiveForLockScreen === 'function'
        ) {
          (
            player as {
              setActiveForLockScreen: (
                active: boolean,
                meta: LockScreenMeta,
                options?: { showSeekForward?: boolean; showSeekBackward?: boolean },
              ) => void;
            }
          ).setActiveForLockScreen(
            true,
            {
              title: stream.title || meta.title,
              artist: stream.artist || meta.artist,
              artworkUrl: stream.artworkUrl || meta.artworkUrl,
            },
            { showSeekForward: true, showSeekBackward: true },
          );
        }
      } catch {}
    },
    [player],
  );

  const play = useCallback(() => {
    sampleRef.current.playing = true;
    player.play();
    if (sourceTitle !== 'room' && currentTrackRef.current?.track_name) {
      void updateMediaNotification({
        title: currentTrackRef.current.track_name,
        artist: currentTrackRef.current.artist || 'Unknown Artist',
        isPlaying: true,
        roomId: 'solo',
        artworkUrl: currentTrackRef.current.album_art_url,
      });
    }
  }, [player, sourceTitle]);

  const pause = useCallback(() => {
    sampleRef.current.playing = false;
    player.pause();
    if (sourceTitle !== 'room' && currentTrackRef.current?.track_name) {
      void updateMediaNotification({
        title: currentTrackRef.current.track_name,
        artist: currentTrackRef.current.artist || 'Unknown Artist',
        isPlaying: false,
        roomId: 'solo',
        artworkUrl: currentTrackRef.current.album_art_url,
      });
    }
  }, [player, sourceTitle]);

  const seekToMs = useCallback(
    async (ms: number) => {
      lastSeekTimeRef.current = Date.now();
      const safeMs = Math.max(0, ms);
      await player.seekTo(safeMs / 1000);
      sampleRef.current = {
        at: Date.now(),
        posMs: safeMs,
        playing: sampleRef.current.playing,
      };
    },
    [player],
  );

  const positionMs = useCallback(() => {
    const s = sampleRef.current;
    if (!s.playing) return s.posMs;
    return s.posMs + (Date.now() - s.at);
  }, []);

  const isSeekingRecently = useCallback(() => {
    return Date.now() - lastSeekTimeRef.current < 3500;
  }, []);

  const updateMeta = useCallback(
    (meta: LockScreenMeta) => {
      try {
        if (
          typeof (player as { updateLockScreenMetadata?: unknown })
            .updateLockScreenMetadata === 'function'
        ) {
          (
            player as {
              updateLockScreenMetadata: (meta: LockScreenMeta) => void;
            }
          ).updateLockScreenMetadata({
            title: meta.title,
            artist: meta.artist,
            artworkUrl: meta.artworkUrl,
          });
        }
      } catch {}
    },
    [player],
  );

  const setLockScreenActive = useCallback(
    (active: boolean, meta?: LockScreenMeta) => {
      try {
        if (typeof (player as any).setActiveForLockScreen === 'function') {
          (player as any).setActiveForLockScreen(
            active,
            meta,
            { showSeekForward: true, showSeekBackward: true },
          );
        } else if (!active && typeof (player as any).clearLockScreenControls === 'function') {
          (player as any).clearLockScreenControls();
        }
      } catch {}
    },
    [player],
  );

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(1, Math.max(0, v));
      player.volume = clamped;
      setVolumeState(clamped);
    },
    [player],
  );

  const duckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (duckIntervalRef.current) clearInterval(duckIntervalRef.current);
    };
  }, []);

  const duckVolume = useCallback(
    (targetRatio = 0.2, durationMs = 200) => {
      if (duckIntervalRef.current) clearInterval(duckIntervalRef.current);
      const startVolume = volumeRef.current;
      const startTime = Date.now();
      duckIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const current = startVolume - (startVolume - startVolume * targetRatio) * progress;
        player.volume = current;
        if (progress >= 1) {
          if (duckIntervalRef.current) clearInterval(duckIntervalRef.current);
          duckIntervalRef.current = null;
        }
      }, 25);
    },
    [player],
  );

  const restoreVolume = useCallback(
    (durationMs = 200) => {
      if (duckIntervalRef.current) clearInterval(duckIntervalRef.current);
      const startVolume = player.volume;
      const targetVolume = volumeRef.current;
      const startTime = Date.now();
      duckIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const current = startVolume + (targetVolume - startVolume) * progress;
        player.volume = current;
        if (progress >= 1) {
          if (duckIntervalRef.current) clearInterval(duckIntervalRef.current);
          duckIntervalRef.current = null;
        }
      }, 25);
    },
    [player],
  );

  // External listener refs for track lifecycle events
  const onTrackEndedCbRef = useRef<(() => void) | null>(null);
  const onTrackErrorCbRef = useRef<((code: number | string) => void) | null>(null);

  const setOnTrackEnded = useCallback((cb: (() => void) | null) => {
    onTrackEndedCbRef.current = cb;
  }, []);

  const setOnTrackError = useCallback((cb: ((code: number | string) => void) | null) => {
    onTrackErrorCbRef.current = cb;
  }, []);

  // ── Solo & Spotify Queue Management ────────────────────────────────────

  const playTrack = useCallback(
    async (
      track: TrackInfo,
      newQueue?: TrackInfo[],
      options?: { sourceTitle?: string; autoPlay?: boolean; initialPositionMs?: number; index?: number },
    ) => {
      if (!track) return;
      setCurrentTrack(track);
      if (options?.sourceTitle) {
        setSourceTitle(options.sourceTitle);
      }

      if (newQueue && newQueue.length > 0) {
        setQueueState(newQueue);
        const idx =
          typeof options?.index === 'number'
            ? options.index
            : newQueue.findIndex((t) => t.track_uri === track.track_uri);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else if (typeof options?.index === 'number') {
        setCurrentIndex(options.index);
      } else {
        const existingIdx = queueRef.current.findIndex((t) => t.track_uri === track.track_uri);
        if (existingIdx >= 0) {
          setCurrentIndex(existingIdx);
        }
      }

      void recordTrackPlayed(track);
      lastFinishedUriRef.current = null;

      await loadTrack(track.track_uri, {
        title: track.track_name,
        artist: track.artist,
        artworkUrl: track.album_art_url,
      });

      if (typeof options?.initialPositionMs === 'number' && options.initialPositionMs > 0) {
        await seekToMs(options.initialPositionMs);
      }

      if (options?.autoPlay !== false) {
        play();
      }
    },
    [loadTrack, play, seekToMs],
  );

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (repeatRef.current === 'one') {
      lastFinishedUriRef.current = null;
      await seekToMs(0);
      play();
      return;
    }

    let nextIdx = currentIndexRef.current + 1;
    if (shuffleRef.current && q.length > 1) {
      nextIdx = Math.floor(Math.random() * q.length);
      if (nextIdx === currentIndexRef.current) {
        nextIdx = (nextIdx + 1) % q.length;
      }
    }

    if (nextIdx < q.length) {
      setCurrentIndex(nextIdx);
      const nextTrack = q[nextIdx];
      await playTrack(nextTrack, undefined, { index: nextIdx });
    } else if (repeatRef.current === 'all') {
      setCurrentIndex(0);
      const firstTrack = q[0];
      await playTrack(firstTrack, undefined, { index: 0 });
    } else {
      // Reached the end of the user's Up Next queue
      if (!radioAutoPlayRef.current) {
        pause();
        return;
      }

      // Continuous Spotify Radio Auto-Play Mode (Plays next similar track without polluting user queue)
      try {
        const cur = currentTrackRef.current;
        const seedQuery = cur ? `${cur.track_name} ${cur.artist || ''}`.trim() : 'chill lofi';
        const backendUrl = getBackendUrl();
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 4000);
        const resp = await fetch(
          `${backendUrl}/search/recommendations?seed=${encodeURIComponent(seedQuery)}`,
          { signal: ctrl.signal },
        );
        clearTimeout(timeout);
        if (resp.ok) {
          const recommendations: TrackInfo[] = await resp.json();
          if (Array.isArray(recommendations) && recommendations.length > 0) {
            const nextTrack = recommendations[0];
            // Play ONLY the single radio track; queue stays clean for user songs
            await playTrack(nextTrack, [nextTrack], { sourceTitle: 'Radio Auto-Play' });
            return;
          }
        }
      } catch (err) {
        console.warn('[PlayerContext] auto-play radio recommendations failed:', err);
      }

      // Cleanly stop if no radio tracks are returned
      pause();
    }
  }, [playTrack, seekToMs, play, pause]);

  const playPrev = useCallback(async () => {
    const pos = positionMs();
    if (pos > 3000) {
      await seekToMs(0);
      return;
    }

    const q = queueRef.current;
    if (q.length === 0) return;

    const prevIdx = Math.max(0, currentIndexRef.current - 1);
    setCurrentIndex(prevIdx);
    await playTrack(q[prevIdx], undefined, { index: prevIdx });
  }, [positionMs, seekToMs, playTrack]);

  const toggleLike = useCallback(async (): Promise<boolean> => {
    const track = currentTrackRef.current;
    if (!track) return false;
    const nowLiked = await toggleFavoriteTrack(track);
    setIsLiked(nowLiked);
    return nowLiked;
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  const setQueue = useCallback((newQ: TrackInfo[]) => {
    setQueueState(newQ);
  }, []);

  const addToQueue = useCallback((track: TrackInfo) => {
    setQueueState((prev) => [...prev, track]);
  }, []);

  const playNextInQueue = useCallback((track: TrackInfo) => {
    setQueueState((prev) => {
      const activeIdx = currentTrackRef.current
        ? prev.findIndex((t) => t.track_uri === currentTrackRef.current?.track_uri)
        : currentIndexRef.current;
      const insertIdx = (activeIdx >= 0 ? activeIdx : Math.max(0, currentIndexRef.current)) + 1;
      const updated = [...prev.slice(0, insertIdx), track, ...prev.slice(insertIdx)];
      queueRef.current = updated;
      return updated;
    });
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueueState((prev) => prev.filter((_, i) => i !== index));
    if (index < currentIndexRef.current) {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    }
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueueState((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    setQueueState((prev) => {
      const activeIdx = currentTrackRef.current
        ? prev.findIndex((t) => t.track_uri === currentTrackRef.current?.track_uri)
        : currentIndexRef.current;
      const safeIdx = activeIdx >= 0 ? activeIdx : Math.max(0, currentIndexRef.current);
      if (safeIdx >= prev.length - 1) {
        queueRef.current = prev;
        return prev;
      }
      const trimmed = prev.slice(0, safeIdx + 1);
      queueRef.current = trimmed;
      return trimmed;
    });
  }, []);

  // Track finished listener
  const handleTrackFinished = useCallback(() => {
    onTrackEndedCbRef.current?.();
    // Auto-advance if we have a solo queue running
    if (queueRef.current.length > 0) {
      void playNext();
    }
  }, [playNext]);

  // Native expo-audio track completion listener with deduplication and boundary fallback
  useEffect(() => {
    const curUri = currentTrackRef.current?.track_uri;
    const isFinished =
      Boolean((status as { didJustFinish?: boolean })?.didJustFinish) ||
      (status.duration > 0 &&
        status.currentTime >= status.duration - 0.25 &&
        !status.playing &&
        status.isLoaded);

    if (isFinished && curUri && lastFinishedUriRef.current !== curUri) {
      lastFinishedUriRef.current = curUri;
      handleTrackFinished();
    }
  }, [status, handleTrackFinished]);

  // Next-Track Audio Pre-Caching Seam (Gapless Spotify-Grade Playback)
  const prewarmedUriRef = useRef<string | null>(null);

  useEffect(() => {
    const curTime = status.currentTime ?? 0;
    const dur = status.duration ?? 0;
    if (dur > 20 && dur - curTime <= 12 && status.playing) {
      const q = queueRef.current;
      const idx = currentIndexRef.current;
      const nextTrack = q[idx + 1];
      if (nextTrack?.track_uri && prewarmedUriRef.current !== nextTrack.track_uri) {
        prewarmedUriRef.current = nextTrack.track_uri;
        void resolveAudioStream(nextTrack.track_uri, {
          title: nextTrack.track_name,
          artist: nextTrack.artist,
          artworkUrl: nextTrack.album_art_url,
        }).then((resolved) => {
          if (resolved?.uri) {
            try {
              preload(resolved.uri);
            } catch {}
          }
        });
        const ytId = parseYouTubeId(nextTrack.track_uri);
        if (ytId) {
          const backendUrl = getBackendUrl();
          fetch(`${backendUrl}/stream/${ytId}`, {
            headers: { Range: 'bytes=0-65536' },
          }).catch(() => {});
        }
      }
    }
  }, [status.currentTime, status.duration, status.playing]);

  const clearPlayback = useCallback(() => {
    try {
      player.pause();
      void player.seekTo(0);
      if (typeof (player as any).setActiveForLockScreen === 'function') {
        (player as any).setActiveForLockScreen(false, { title: '', artist: '' });
      }
    } catch {}
    void dismissMediaNotification();
    lastFinishedUriRef.current = null;
    sampleRef.current = { at: Date.now(), posMs: 0, playing: false };
    setCurrentTrack(null);
    currentTrackRef.current = null;
    setQueueState([]);
    queueRef.current = [];
    setCurrentIndex(0);
  }, [player]);

  const controls = useMemo<PlayerControls>(
    () => ({
      loadTrack,
      play,
      pause,
      seekToMs,
      positionMs,
      updateMeta,
      setLockScreenActive,
      volume,
      setVolume,
      duckVolume,
      restoreVolume,
      isSeekingRecently,
      setOnTrackEnded,
      setOnTrackError,

      currentTrack,
      queue,
      currentIndex,
      shuffle,
      repeat,
      isLiked,
      isPlayerModalOpen,
      sourceTitle,
      setSourceTitle,
      clearPlayback,

      playTrack,
      playNext,
      playPrev,
      toggleLike,
      toggleShuffle,
      toggleRepeat,
      setPlayerModalOpen,
      setQueue,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      reorderQueue,
      clearUpcomingQueue,

      activeAudioDevice,
      setAudioDevice,
      radioAutoPlay,
      toggleRadioAutoPlay,
    }),
    [
      loadTrack,
      play,
      pause,
      seekToMs,
      positionMs,
      updateMeta,
      setLockScreenActive,
      volume,
      setVolume,
      duckVolume,
      restoreVolume,
      isSeekingRecently,
      setOnTrackEnded,
      setOnTrackError,

      currentTrack,
      queue,
      currentIndex,
      shuffle,
      repeat,
      isLiked,
      isPlayerModalOpen,
      sourceTitle,
      clearPlayback,

      playTrack,
      playNext,
      playPrev,
      toggleLike,
      toggleShuffle,
      toggleRepeat,
      setPlayerModalOpen,
      setQueue,
      addToQueue,
      playNextInQueue,
      removeFromQueue,
      reorderQueue,
      clearUpcomingQueue,

      activeAudioDevice,
      setAudioDevice,
      radioAutoPlay,
      toggleRadioAutoPlay,
    ],
  );

  const isCurrentlyPlaying = !!status.playing;
  const isCurrentlyPlayingRef = useRef(isCurrentlyPlaying);
  isCurrentlyPlayingRef.current = isCurrentlyPlaying;
  const isLoaded = !!status.isLoaded;
  const currentDurationMs = (status.duration ?? 0) * 1000;

  const statusValue = useMemo<PlayerStatus>(
    () => ({
      playing: isCurrentlyPlaying,
      loaded: isLoaded,
      durationMs: currentDurationMs,
    }),
    [isCurrentlyPlaying, isLoaded, currentDurationMs],
  );

  // ── Solo Mode Media Notification & Lock Screen Synchronization ───────
  useEffect(() => {
    if (sourceTitle === 'room') return; // Managed by RoomContext
    if (currentTrack?.track_name) {
      void updateMediaNotification({
        title: currentTrack.track_name,
        artist: currentTrack.artist || 'Unknown Artist',
        isPlaying: isCurrentlyPlaying,
        roomId: 'solo',
        artworkUrl: currentTrack.album_art_url,
      });
    } else {
      void dismissMediaNotification();
    }
  }, [
    sourceTitle,
    currentTrack?.track_name,
    currentTrack?.artist,
    currentTrack?.album_art_url,
    isCurrentlyPlaying,
  ]);

  // Clean up media notification on provider unmount if solo
  useEffect(() => {
    return () => {
      if (sourceTitle !== 'room') {
        void dismissMediaNotification();
      }
    };
  }, [sourceTitle]);

  // Media notification remote action handlers (Play/Pause, Next, Prev)
  useEffect(() => {
    if (sourceTitle === 'room') return; // Managed by RoomContext
    const unregister = registerMediaActionListener((action) => {
      if (action === 'play_pause') {
        const nextPlaying = !isCurrentlyPlayingRef.current;
        if (nextPlaying) {
          play();
        } else {
          pause();
        }
        if (currentTrackRef.current?.track_name) {
          void updateMediaNotification({
            title: currentTrackRef.current.track_name,
            artist: currentTrackRef.current.artist || 'Unknown Artist',
            isPlaying: nextPlaying,
            roomId: 'solo',
            artworkUrl: currentTrackRef.current.album_art_url,
          });
        }
      } else if (action === 'next') {
        void playNext();
      } else if (action === 'prev') {
        void playPrev();
      }
    });
    return unregister;
  }, [sourceTitle, pause, play, playNext, playPrev]);

  return (
    <ControlsCtx.Provider value={controls}>
      <StatusCtx.Provider value={statusValue}>
        {children}
      </StatusCtx.Provider>
    </ControlsCtx.Provider>
  );
}

export function usePlayer(): PlayerControls {
  const ctx = useContext(ControlsCtx);
  if (!ctx) throw new Error('usePlayer must be used inside PlayerProvider');
  return ctx;
}

export function usePlayerStatus(): PlayerStatus {
  return useContext(StatusCtx);
}
