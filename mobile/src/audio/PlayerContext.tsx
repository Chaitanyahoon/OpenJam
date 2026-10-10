/**
 * Audio driver — Dual engine: Expo Audio + YouTube Audio Bridge.
 *
 * Capabilities:
 * - Direct streams & local files: played via native `expo-audio`.
 * - YouTube tracks: multi-tier resolution (Cobalt/Piped/Invidious direct stream)
 *   with graceful headless WebView YouTube Audio Bridge fallback.
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
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import {
  YouTubeAudioBridge,
  type YouTubeAudioBridgeRef,
} from './YouTubeAudioBridge';
import { getBackendUrl } from '../api';
import {
  getVaultTrack,
  recordVaultTrackPlayed,
  resolveDirectAudioStreamUrls,
} from '../storage/vault';
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
export type AudioDeviceRoute = 'speaker' | 'bluetooth' | 'wired' | 'room';

export interface PlayerControls {
  // Low-level controls (used by Room sync engine & Solo mode)
  loadTrack: (urlOrId: string, meta: LockScreenMeta) => Promise<void>;
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => Promise<void>;
  positionMs: () => number;
  updateMeta: (meta: LockScreenMeta) => void;
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
    options?: { sourceTitle?: string; autoPlay?: boolean; initialPositionMs?: number },
  ) => Promise<void>;
  playNext: () => Promise<void>;
  playPrev: () => Promise<void>;
  toggleLike: () => Promise<boolean>;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setPlayerModalOpen: (open: boolean) => void;
  setQueue: (queue: TrackInfo[]) => void;
  addToQueue: (track: TrackInfo) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // Audio Device Routing & Radio Auto-Play
  activeAudioDevice: AudioDeviceRoute;
  setAudioDevice: (device: AudioDeviceRoute) => void;
  radioAutoPlay: boolean;
  toggleRadioAutoPlay: () => void;
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

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  const streamMatch = clean.match(/\/stream\/([a-zA-Z0-9_-]{11})(?:\?|$)/);
  if (streamMatch) return streamMatch[1];
  const reg =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = clean.match(reg);
  if (match && match[1]) return match[1];
  return null;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 150 });
  const status = useAudioPlayerStatus(player);
  const ytBridgeRef = useRef<YouTubeAudioBridgeRef>(null);

  const [activeDriver, setActiveDriver] = useState<'expo' | 'youtube'>('youtube');
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytDurationMs, setYtDurationMs] = useState(0);
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
  const [radioAutoPlay, setRadioAutoPlayState] = useState<boolean>(true);
  const radioAutoPlayRef = useRef(true);
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

  // Load saved device output route and radio autoplay preference
  useEffect(() => {
    AsyncStorage.getItem('@openjam_audio_route')
      .then((saved) => {
        if (saved === 'speaker' || saved === 'bluetooth' || saved === 'wired' || saved === 'room') {
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
  useEffect(() => {
    if (activeDriver === 'expo') {
      sampleRef.current = {
        at: Date.now(),
        posMs: (status.currentTime ?? 0) * 1000,
        playing: !!status.playing,
      };
    }
  }, [status, activeDriver]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const loadTrack = useCallback(
    async (urlOrId: string, meta: LockScreenMeta): Promise<void> => {
      // 1. Direct local sandboxed file playback
      if (urlOrId && urlOrId.startsWith('file://')) {
        ytBridgeRef.current?.pause();
        setActiveDriver('expo');
        setYtPlaying(false);
        player.replace({ uri: urlOrId });
        player.volume = volumeRef.current;
        player.play();
        if (player && typeof (player as any).setActiveForLockScreen === 'function') {
          try {
            (player as any).setActiveForLockScreen(
              true,
              {
                title: meta.title || 'OpenJam Offline Track',
                artist: meta.artist || 'OpenJam Vault',
                albumTitle: 'OpenJam Audio Vault',
                artworkUrl: meta.artworkUrl,
              },
              {
                showSeekForward: true,
                showSeekBackward: true,
                isLiveStream: false,
              },
            );
          } catch {}
        }
        return;
      }

      // 2. Check if track is pre-cached in sandboxed offline vault
      try {
        const vaultTrack = await getVaultTrack(urlOrId);
        if (vaultTrack && vaultTrack.local_file_uri) {
          ytBridgeRef.current?.pause();
          setActiveDriver('expo');
          setYtPlaying(false);
          player.replace({ uri: vaultTrack.local_file_uri });
          player.volume = volumeRef.current;
          player.play();
          void recordVaultTrackPlayed(urlOrId);
          if (player && typeof (player as any).setActiveForLockScreen === 'function') {
            try {
              (player as any).setActiveForLockScreen(
                true,
                {
                  title: meta.title || vaultTrack.track_name,
                  artist: meta.artist || vaultTrack.artist,
                  albumTitle: 'OpenJam Audio Vault',
                  artworkUrl: meta.artworkUrl || vaultTrack.album_art_url,
                },
                {
                  showSeekForward: true,
                  showSeekBackward: true,
                  isLiveStream: false,
                },
              );
            } catch {}
          }
          return;
        }
      } catch {}

      let ytId = parseYouTubeId(urlOrId);

      // If it's a search query with spaces, resolve via backend search
      if (!ytId && urlOrId && !urlOrId.startsWith('http')) {
        try {
          const backendUrl = getBackendUrl();
          const resp = await fetch(
            `${backendUrl}/search/resolve?q=${encodeURIComponent(urlOrId)}`,
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data?.video_id) {
              ytId = data.video_id;
            }
          }
        } catch (err) {
          console.warn('Failed to resolve track query:', err);
        }
      }

      // 3. For YouTube video tracks, try direct audio streams first for native expo-audio background playback
      let directStreamSuccess = false;
      if (ytId) {
        try {
          const directUrls = await resolveDirectAudioStreamUrls(ytId);
          for (const directUrl of directUrls) {
            try {
              const testCtrl = new AbortController();
              const testTimeout = setTimeout(() => testCtrl.abort(), 2000);
              const testRes = await fetch(directUrl, {
                method: 'GET',
                headers: { Range: 'bytes=0-1024' },
                signal: testCtrl.signal,
              });
              clearTimeout(testTimeout);
              if (testRes.ok || testRes.status === 206) {
                ytBridgeRef.current?.pause();
                setActiveDriver('expo');
                setYtPlaying(false);
                sampleRef.current = { at: Date.now(), posMs: 0, playing: true };
                player.replace({ uri: directUrl });
                player.volume = volumeRef.current;
                player.play();
                directStreamSuccess = true;
                break;
              }
            } catch {}
          }
        } catch {}
      }

      // 4. Fallback to YouTube Audio Bridge WebView if direct streams failed
      if (!directStreamSuccess && ytId) {
        player.pause();
        setActiveDriver('youtube');
        sampleRef.current = { at: Date.now(), posMs: 0, playing: true };
        setYtPlaying(true);
        ytBridgeRef.current?.loadVideo(ytId, 0, true, volumeRef.current);
      } else if (!directStreamSuccess && urlOrId && (urlOrId.startsWith('http') || urlOrId.startsWith('file://'))) {
        ytBridgeRef.current?.pause();
        setActiveDriver('expo');
        setYtPlaying(false);
        player.replace({ uri: urlOrId });
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
              ) => void;
            }
          ).setActiveForLockScreen(true, {
            title: meta.title,
            artist: meta.artist,
            artworkUrl: meta.artworkUrl,
          });
        }
      } catch {}
    },
    [player],
  );

  const play = useCallback(() => {
    if (activeDriver === 'youtube') {
      ytBridgeRef.current?.play();
      setYtPlaying(true);
      sampleRef.current = {
        at: Date.now(),
        posMs: sampleRef.current.posMs,
        playing: true,
      };
    } else {
      player.play();
    }
  }, [activeDriver, player]);

  const pause = useCallback(() => {
    if (activeDriver === 'youtube') {
      ytBridgeRef.current?.pause();
      setYtPlaying(false);
      sampleRef.current = {
        at: Date.now(),
        posMs: sampleRef.current.posMs,
        playing: false,
      };
    } else {
      player.pause();
    }
  }, [activeDriver, player]);

  const seekToMs = useCallback(
    async (ms: number) => {
      lastSeekTimeRef.current = Date.now();
      const safeMs = Math.max(0, ms);
      if (activeDriver === 'youtube') {
        ytBridgeRef.current?.seekTo(safeMs / 1000);
      } else {
        await player.seekTo(safeMs / 1000);
      }
      sampleRef.current = {
        at: Date.now(),
        posMs: safeMs,
        playing: sampleRef.current.playing,
      };
    },
    [activeDriver, player],
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

  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(1, Math.max(0, v));
      player.volume = clamped;
      ytBridgeRef.current?.setVolume(clamped);
      setVolumeState(clamped);
    },
    [player],
  );

  const duckVolume = useCallback(
    (targetRatio = 0.2, durationMs = 200) => {
      const startVolume = volumeRef.current;
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const current = startVolume - (startVolume - startVolume * targetRatio) * progress;
        player.volume = current;
        ytBridgeRef.current?.setVolume(current);
        if (progress >= 1) clearInterval(interval);
      }, 25);
    },
    [player],
  );

  const restoreVolume = useCallback(
    (durationMs = 200) => {
      const startVolume = player.volume;
      const targetVolume = volumeRef.current;
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / durationMs);
        const current = startVolume + (targetVolume - startVolume) * progress;
        player.volume = current;
        ytBridgeRef.current?.setVolume(current);
        if (progress >= 1) clearInterval(interval);
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
      options?: { sourceTitle?: string; autoPlay?: boolean; initialPositionMs?: number },
    ) => {
      if (!track) return;
      setCurrentTrack(track);
      if (options?.sourceTitle) {
        setSourceTitle(options.sourceTitle);
      }

      if (newQueue && newQueue.length > 0) {
        setQueueState(newQueue);
        const idx = newQueue.findIndex((t) => t.track_uri === track.track_uri);
        setCurrentIndex(idx >= 0 ? idx : 0);
      }

      void recordTrackPlayed(track);

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
      await playTrack(nextTrack);
    } else if (repeatRef.current === 'all') {
      setCurrentIndex(0);
      const firstTrack = q[0];
      await playTrack(firstTrack);
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
        const resp = await fetch(
          `${backendUrl}/search/recommendations?seed=${encodeURIComponent(seedQuery)}`,
        );
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
    await playTrack(q[prevIdx]);
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

  // Track finished listener
  const handleTrackFinished = useCallback(() => {
    onTrackEndedCbRef.current?.();
    // Auto-advance if we have a solo queue running
    if (queueRef.current.length > 0) {
      void playNext();
    }
  }, [playNext]);

  // Native expo-audio track completion listener
  useEffect(() => {
    if (activeDriver === 'expo' && (status as { didJustFinish?: boolean })?.didJustFinish) {
      handleTrackFinished();
    }
  }, [activeDriver, status, handleTrackFinished]);

  // YouTube Audio Bridge callbacks
  const handleYtProgress = useCallback(
    (currentTimeSec: number, durationSec: number) => {
      if (activeDriver === 'youtube') {
        const posMs = currentTimeSec * 1000;
        sampleRef.current = {
          at: Date.now(),
          posMs,
          playing: ytPlaying,
        };
        const durMs = Math.round(durationSec * 1000);
        if (durMs > 0 && durMs !== ytDurationMs) {
          setYtDurationMs(durMs);
        }
      }
    },
    [activeDriver, ytPlaying, ytDurationMs],
  );

  const handleYtPlaying = useCallback(() => {
    if (activeDriver === 'youtube') {
      setYtPlaying(true);
      sampleRef.current = {
        at: Date.now(),
        posMs: sampleRef.current.posMs,
        playing: true,
      };
    }
  }, [activeDriver]);

  const handleYtPaused = useCallback(() => {
    if (activeDriver === 'youtube') {
      setYtPlaying(false);
      sampleRef.current = {
        at: Date.now(),
        posMs: sampleRef.current.posMs,
        playing: false,
      };
    }
  }, [activeDriver]);

  const handleYtEnded = useCallback(() => {
    if (activeDriver === 'youtube') {
      setYtPlaying(false);
      sampleRef.current = {
        at: Date.now(),
        posMs: ytDurationMs,
        playing: false,
      };
      handleTrackFinished();
    }
  }, [activeDriver, ytDurationMs, handleTrackFinished]);

  const handleYtError = useCallback(async (code: number | string) => {
    console.warn('[Player] YouTube Audio Bridge error code:', code);
    onTrackErrorCbRef.current?.(code);

    // If embed is restricted (150 / 101), auto-resolve alternate audio source
    if (code === 150 || code === 101 || code === '150' || code === '101') {
      const cur = currentTrackRef.current;
      if (cur) {
        try {
          const query = `${cur.track_name} ${cur.artist || ''}`.trim();
          const backendUrl = getBackendUrl();
          const resp = await fetch(
            `${backendUrl}/search/alternate?q=${encodeURIComponent(query)}&exclude=${encodeURIComponent(cur.track_uri)}`,
          );
          if (resp.ok) {
            const data = await resp.json();
            if (data?.video_id) {
              ytBridgeRef.current?.loadVideo(data.video_id, 0, true, volumeRef.current);
              return;
            }
          }
        } catch {}
      }
      // If alternate fails, skip to next track
      void playNext();
    }
  }, [playNext]);

  const controls = useMemo<PlayerControls>(
    () => ({
      loadTrack,
      play,
      pause,
      seekToMs,
      positionMs,
      updateMeta,
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

      playTrack,
      playNext,
      playPrev,
      toggleLike,
      toggleShuffle,
      toggleRepeat,
      setPlayerModalOpen,
      setQueue,
      addToQueue,
      removeFromQueue,
      reorderQueue,

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

      playTrack,
      playNext,
      playPrev,
      toggleLike,
      toggleShuffle,
      toggleRepeat,
      setPlayerModalOpen,
      setQueue,
      addToQueue,
      removeFromQueue,
      reorderQueue,

      activeAudioDevice,
      setAudioDevice,
      radioAutoPlay,
      toggleRadioAutoPlay,
    ],
  );

  const isCurrentlyPlaying =
    activeDriver === 'youtube' ? ytPlaying : !!status.playing;
  const isLoaded =
    activeDriver === 'youtube' ? true : !!status.isLoaded;
  const currentDurationMs =
    activeDriver === 'youtube'
      ? ytDurationMs
      : (status.duration ?? 0) * 1000;

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
        if (isCurrentlyPlaying) {
          pause();
        } else {
          play();
        }
      } else if (action === 'next') {
        void playNext();
      } else if (action === 'prev') {
        void playPrev();
      }
    });
    return unregister;
  }, [sourceTitle, isCurrentlyPlaying, pause, play, playNext, playPrev]);

  // Remote notification tap response handler (expand Spotify Player sheet)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { action?: string; roomId?: string }
        | undefined;
      if (data?.roomId === 'solo') {
        setPlayerModalOpen(true);
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  // expo-audio runtime error fallback to YouTubeAudioBridge
  useEffect(() => {
    if (activeDriver === 'expo' && (status as any)?.status === 'error') {
      const cur = currentTrackRef.current;
      const ytId = cur ? parseYouTubeId(cur.track_uri) : null;
      if (ytId) {
        console.warn('[Player] expo-audio error reported, falling back to YouTube Audio Bridge');
        setActiveDriver('youtube');
        setYtPlaying(true);
        ytBridgeRef.current?.loadVideo(ytId, 0, true, volumeRef.current);
      }
    }
  }, [activeDriver, status]);

  return (
    <ControlsCtx.Provider value={controls}>
      <StatusCtx.Provider value={statusValue}>
        {children}
        <YouTubeAudioBridge
          ref={ytBridgeRef}
          onProgress={handleYtProgress}
          onPlaying={handleYtPlaying}
          onPaused={handleYtPaused}
          onEnded={handleYtEnded}
          onError={handleYtError}
        />
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
