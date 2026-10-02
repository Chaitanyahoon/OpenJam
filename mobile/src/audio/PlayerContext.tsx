/**
 * Audio driver — expo-audio wrapper with OpenJam sync semantics.
 *
 * - 150ms position polling + monotonic-clock extrapolation for the sync engine
 * - Lock-screen / notification controls (required on Android for sustained
 *   background playback — the OS kills audio ~3 min after backgrounding
 *   without it)
 * - doNotMix interruption mode (required when lock-screen is active)
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

export interface LockScreenMeta {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

interface PlayerControls {
  loadTrack: (url: string, meta: LockScreenMeta) => void;
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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 150 });
  const status = useAudioPlayerStatus(player);

  // Monotonic position sample for extrapolation between 150ms polls.
  const sampleRef = useRef({ at: Date.now(), posMs: 0, playing: false });
  useEffect(() => {
    sampleRef.current = {
      at: Date.now(),
      posMs: (status.currentTime ?? 0) * 1000,
      playing: !!status.playing,
    };
  }, [status]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const loadTrack = useCallback(
    (url: string, meta: LockScreenMeta) => {
      player.replace({ uri: url });
      player.setActiveForLockScreen(true, {
        title: meta.title,
        artist: meta.artist,
        artworkUrl: meta.artworkUrl,
      });
    },
    [player],
  );

  const play = useCallback(() => player.play(), [player]);
  const pause = useCallback(() => player.pause(), [player]);

  const seekToMs = useCallback(
    async (ms: number) => {
      await player.seekTo(Math.max(0, ms) / 1000);
      sampleRef.current = { at: Date.now(), posMs: Math.max(0, ms), playing: sampleRef.current.playing };
    },
    [player],
  );

  const positionMs = useCallback(() => {
    const s = sampleRef.current;
    if (!s.playing) return s.posMs;
    return s.posMs + (Date.now() - s.at);
  }, []);

  const updateMeta = useCallback(
    (meta: LockScreenMeta) => {
      player.updateLockScreenMetadata({
        title: meta.title,
        artist: meta.artist,
        artworkUrl: meta.artworkUrl,
      });
    },
    [player],
  );

  const [volume, setVolumeState] = useState(1);
  const setVolume = useCallback(
    (v: number) => {
      const clamped = Math.min(1, Math.max(0, v));
      player.volume = clamped;
      setVolumeState(clamped);
    },
    [player],
  );

  const controls = useMemo(
    () => ({ loadTrack, play, pause, seekToMs, positionMs, updateMeta, volume, setVolume }),
    [loadTrack, play, pause, seekToMs, positionMs, updateMeta, volume, setVolume],
  );

  const statusValue = useMemo<PlayerStatus>(
    () => ({
      playing: !!status.playing,
      loaded: !!status.isLoaded,
      durationMs: (status.duration ?? 0) * 1000,
    }),
    [status.playing, status.isLoaded, status.duration],
  );

  return (
    <ControlsCtx.Provider value={controls}>
      <StatusCtx.Provider value={statusValue}>{children}</StatusCtx.Provider>
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
