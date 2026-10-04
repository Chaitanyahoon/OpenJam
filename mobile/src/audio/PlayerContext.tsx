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

export interface LockScreenMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

interface PlayerControls {
  loadTrack: (urlOrId: string, meta: LockScreenMeta) => void | Promise<void>;
  play: () => void;
  pause: () => void;
  seekToMs: (ms: number) => Promise<void>;
  /** Best-effort current position in ms, extrapolated between polls. */
  positionMs: () => number;
  updateMeta: (meta: LockScreenMeta) => void;
  /** Local device volume 0..1 (not synced to the room). */
  volume: number;
  setVolume: (v: number) => void;
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

  // Monotonic position sample for extrapolation between polls
  const sampleRef = useRef({ at: Date.now(), posMs: 0, playing: false });

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
    async (urlOrId: string, meta: LockScreenMeta) => {
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
        ytBridgeRef.current?.loadVideo(ytId, 0, true);
      } else if (urlOrId && urlOrId.startsWith('http')) {
        // Direct stream URL
        ytBridgeRef.current?.pause();
        setActiveDriver('expo');
        setYtPlaying(false);
        player.replace({ uri: urlOrId });
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

  const [volume, setVolumeState] = useState(1);
  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(1, Math.max(0, v));
      player.volume = clamped;
      ytBridgeRef.current?.setVolume(clamped);
      setVolumeState(clamped);
    },
    [player],
  );

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
        if (durationSec > 0) {
          setYtDurationMs(durationSec * 1000);
        }
      }
    },
    [activeDriver, ytPlaying],
  );

  const handleYtPlaying = useCallback(() => {
    setYtPlaying(true);
    sampleRef.current = {
      at: Date.now(),
      posMs: sampleRef.current.posMs,
      playing: true,
    };
  }, []);

  const handleYtPaused = useCallback(() => {
    setYtPlaying(false);
    sampleRef.current = {
      at: Date.now(),
      posMs: sampleRef.current.posMs,
      playing: false,
    };
  }, []);

  const controls = useMemo(
    () => ({
      loadTrack,
      play,
      pause,
      seekToMs,
      positionMs,
      updateMeta,
      volume,
      setVolume,
    }),
    [loadTrack, play, pause, seekToMs, positionMs, updateMeta, volume, setVolume],
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
