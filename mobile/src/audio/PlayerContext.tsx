/**
 * Audio driver — Dual engine: Expo Audio + YouTube Audio Bridge.
 *
 * - Direct streams & local files: played via native `expo-audio`.
 * - YouTube tracks: played via headless `YouTubeAudioBridge` running the
 *   official YouTube IFrame Player API directly on the client's Android IP,
 *   bypassing cloud datacenter scraping blocks and bot detection.
 * - Monotonic clock sample extrapolation for seamless sub-second sync.
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
import { getVaultTrack, recordVaultTrackPlayed } from '../storage/vault';

export interface LockScreenMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

interface PlayerControls {
  loadTrack: (urlOrId: string, meta: LockScreenMeta) => Promise<void>;
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => Promise<void>;
  /** Best-effort current position in ms, extrapolated between polls. */
  positionMs: () => number;
  updateMeta: (meta: LockScreenMeta) => void;
  /** Local device volume 0..1 (not synced to the room). */
  volume: number;
  setVolume: (v: number) => void;
  /** Whether a seek command was issued within the last cooldown window */
  isSeekingRecently: () => boolean;
  setOnTrackEnded: (cb: (() => void) | null) => void;
  setOnTrackError: (cb: ((code: number | string) => void) | null) => void;
}

interface PlayerStatus {
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

function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  // 11-char direct YouTube video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  // Extracted from backend /stream/VIDEO_ID URL
  const streamMatch = clean.match(/\/stream\/([a-zA-Z0-9_-]{11})(?:\?|$)/);
  if (streamMatch) return streamMatch[1];
  // Standard YouTube URLs
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

  // Monotonic position sample for extrapolation between polls
  const sampleRef = useRef({ at: Date.now(), posMs: 0, playing: false });
  const lastSeekTimeRef = useRef(0);

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
          return;
        }
      } catch {}

      let ytId = parseYouTubeId(urlOrId);

      // If it's a search title or query with spaces, resolve via backend search/resolve endpoint
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

      if (ytId) {
        // Stop any currently playing expo-audio track
        player.pause();
        setActiveDriver('youtube');
        sampleRef.current = { at: Date.now(), posMs: 0, playing: true };
        setYtPlaying(true);
        ytBridgeRef.current?.loadVideo(ytId, 0, true, volumeRef.current);
      } else if (urlOrId && (urlOrId.startsWith('http') || urlOrId.startsWith('file://'))) {
        // Direct stream URL or file URI
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

  // External listener refs for track lifecycle events
  const onTrackEndedCbRef = useRef<(() => void) | null>(null);
  const onTrackErrorCbRef = useRef<((code: number | string) => void) | null>(null);

  const setOnTrackEnded = useCallback((cb: (() => void) | null) => {
    onTrackEndedCbRef.current = cb;
  }, []);

  const setOnTrackError = useCallback((cb: ((code: number | string) => void) | null) => {
    onTrackErrorCbRef.current = cb;
  }, []);

  // Native expo-audio track completion listener
  useEffect(() => {
    if (activeDriver === 'expo' && (status as { didJustFinish?: boolean })?.didJustFinish) {
      onTrackEndedCbRef.current?.();
    }
  }, [activeDriver, status]);

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
      onTrackEndedCbRef.current?.();
    }
  }, [activeDriver, ytDurationMs]);

  const handleYtError = useCallback((code: number | string) => {
    console.warn('[Player] YouTube Audio Bridge error code:', code);
    onTrackErrorCbRef.current?.(code);
  }, []);

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
      isSeekingRecently,
      setOnTrackEnded,
      setOnTrackError,
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
      isSeekingRecently,
      setOnTrackEnded,
      setOnTrackError,
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
