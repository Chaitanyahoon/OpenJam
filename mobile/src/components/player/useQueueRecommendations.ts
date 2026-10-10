import { useState, useEffect, useRef, useCallback } from 'react';
import { getBackendUrl, searchHybridTracks, type TrackSearchResult } from '../../api';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { useToast } from '../ToastContext';
import type { TrackInfo } from '../../sync/protocol';

export interface UseQueueRecommendationsProps {
  showQueue: boolean;
  currentTrack: TrackInfo | null;
  onAddToQueue: (track: TrackInfo) => void;
}

export interface UseQueueRecommendationsResult {
  recommendations: TrackInfo[];
  loadingRecommendations: boolean;
  addedRecUris: Set<string>;
  handleAddRecToQueue: (track: TrackInfo) => void;

  showSearchInline: boolean;
  setShowSearchInline: React.Dispatch<React.SetStateAction<boolean>>;
  searchInlineQuery: string;
  searchInlineResults: TrackSearchResult[];
  searchInlineLoading: boolean;
  addedInlineUris: Set<string>;
  handleSearchInlineChange: (text: string) => void;
  clearSearchInline: () => void;
  handleAddInlineToQueue: (item: TrackSearchResult) => void;
}

/**
 * Deep Presentation Module: Queue Recommendations & Inline Search Controller.
 *
 * Encapsulates:
 * - Smart seed-based recommendation fetching on queue panel open
 * - Debounced inline track search with 350ms throttle
 * - Deduplication tracking of added songs via URI sets
 */
export function useQueueRecommendations({
  showQueue,
  currentTrack,
  onAddToQueue,
}: UseQueueRecommendationsProps): UseQueueRecommendationsResult {
  const toast = useToast();

  const [recommendations, setRecommendations] = useState<TrackInfo[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [addedRecUris, setAddedRecUris] = useState<Set<string>>(new Set());

  const [showSearchInline, setShowSearchInline] = useState(false);
  const [searchInlineQuery, setSearchInlineQuery] = useState('');
  const [searchInlineResults, setSearchInlineResults] = useState<TrackSearchResult[]>([]);
  const [searchInlineLoading, setSearchInlineLoading] = useState(false);
  const [addedInlineUris, setAddedInlineUris] = useState<Set<string>>(new Set());
  const searchDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch recommendations when queue panel opens
  useEffect(() => {
    if (!showQueue || !currentTrack?.track_name) return;
    let cancelled = false;
    setLoadingRecommendations(true);
    const seed = `${currentTrack.track_name} ${currentTrack.artist || ''}`.trim();
    const backendUrl = getBackendUrl();
    fetch(`${backendUrl}/search/recommendations?seed=${encodeURIComponent(seed)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TrackInfo[]) => {
        if (!cancelled && Array.isArray(data)) {
          setRecommendations(data.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRecommendations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showQueue, currentTrack?.track_name, currentTrack?.artist]);

  const handleAddRecToQueue = useCallback(
    (track: TrackInfo) => {
      if (addedRecUris.has(track.track_uri)) return;
      void hapticLight();
      setAddedRecUris((prev) => new Set(prev).add(track.track_uri));
      onAddToQueue(track);
      toast(`Added "${track.track_name}" to queue`, 'success');
    },
    [addedRecUris, onAddToQueue, toast],
  );

  const handleSearchInlineChange = useCallback((text: string) => {
    setSearchInlineQuery(text);
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    if (!text.trim()) {
      setSearchInlineResults([]);
      setSearchInlineLoading(false);
      return;
    }
    setSearchInlineLoading(true);
    searchDebounceTimer.current = setTimeout(async () => {
      try {
        const found = await searchHybridTracks(text.trim());
        setSearchInlineResults(found);
      } catch {
        setSearchInlineResults([]);
      } finally {
        setSearchInlineLoading(false);
      }
    }, 350);
  }, []);

  const clearSearchInline = useCallback(() => {
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    setSearchInlineQuery('');
    setSearchInlineResults([]);
    setSearchInlineLoading(false);
  }, []);

  const handleAddInlineToQueue = useCallback(
    (item: TrackSearchResult) => {
      void hapticMedium();
      const trackInfo: TrackInfo = {
        track_uri: item.uri,
        track_name: item.name,
        artist: item.artist,
        album_art_url: item.album_art_url,
        duration_ms: item.duration_ms,
      };
      onAddToQueue(trackInfo);
      setAddedInlineUris((prev) => new Set(prev).add(item.uri));
      toast(`Added "${item.name}" to queue`, 'success');
    },
    [onAddToQueue, toast],
  );

  return {
    recommendations,
    loadingRecommendations,
    addedRecUris,
    handleAddRecToQueue,
    showSearchInline,
    setShowSearchInline,
    searchInlineQuery,
    searchInlineResults,
    searchInlineLoading,
    addedInlineUris,
    handleSearchInlineChange,
    clearSearchInline,
    handleAddInlineToQueue,
  };
}
