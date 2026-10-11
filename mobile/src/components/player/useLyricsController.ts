import { useState, useEffect, useMemo, useRef } from 'react';
import { ScrollView } from 'react-native';
import { fetchLyrics, type Lyrics, activeLyricIndex } from '../../audio/lyrics';

export interface UseLyricsControllerProps {
  trackName?: string;
  artist?: string;
  durationMs?: number;
  currentPosMs: number;
  showLyricsModal: boolean;
}

export interface UseLyricsControllerResult {
  lyrics: Lyrics | null;
  lyricsLoading: boolean;
  activeLineIdx: number;
  lyricsScrollRef: React.RefObject<ScrollView | null>;
}

/**
 * Deep Presentation Module: Synced Lyrics Controller.
 *
 * Encapsulates:
 * - Real-time lyrics fetching with request deduplication & lifecycle cancellation
 * - Active lyric line detection based on player millisecond position
 * - Smooth auto-scrolling with center alignment calculation
 */
export function useLyricsController({
  trackName,
  artist,
  durationMs,
  currentPosMs,
  showLyricsModal,
}: UseLyricsControllerProps): UseLyricsControllerResult {
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsScrollRef = useRef<ScrollView | null>(null);

  // Fetch real-time synced lyrics whenever track changes
  useEffect(() => {
    if (!trackName) {
      setLyrics(null);
      return;
    }

    let cancelled = false;
    setLyricsLoading(true);

    fetchLyrics(
      artist || '',
      trackName,
      (durationMs || 180000) / 1000,
    )
      .then((l) => {
        if (!cancelled) {
          setLyrics(l);
          setLyricsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackName, artist, durationMs]);

  // Derive active lyric line index with millisecond fidelity
  const activeLineIdx = useMemo(() => {
    if (!lyrics?.lines?.length) return -1;
    return activeLyricIndex(lyrics.lines, currentPosMs);
  }, [lyrics, currentPosMs]);

  // Center active lyric line in lyrics sheet
  useEffect(() => {
    if (showLyricsModal && activeLineIdx >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTo({
        y: Math.max(0, activeLineIdx * 48 - 140),
        animated: true,
      });
    }
  }, [activeLineIdx, showLyricsModal]);

  return {
    lyrics,
    lyricsLoading,
    activeLineIdx,
    lyricsScrollRef,
  };
}
