/**
 * Queue Tab: decluttered, Spotify-inspired track search & queue management.
 *
 * - When query/results are active: displays full-height Search Results with a "Back to Queue" button.
 * - When viewing queue: displays clean, high-contrast Up Next track list without clutter.
 * - Supports direct YouTube / Spotify URL paste detection with instant "+ Add" button.
 * - Upvoting with optimistic feedback and host remove controls.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Search,
  X,
  Plus,
  Play,
  ChevronLeft,
  Music,
  ListMusic,
  ArrowBigUp,
  Trash2,
  Sparkles,
  DownloadCloud,
  CheckCircle2,
  Heart,
  GripVertical,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';
import { searchTracks, searchHybridTracks, isPlaylistUrl, type TrackSearchResult } from '../api';
import { useToast } from './ToastContext';
import { hapticLight, hapticMedium, hapticHeavy, hapticSelection } from '../utils/haptics';
import { ImportPlaylistModal } from './ImportPlaylistModal';
import {
  downloadTrackToVault,
  getVaultTracks,
  filterSessionTracksToDownloadPure,
  subscribeDownloadProgress,
  type TrackDownloadProgress,
} from '../storage/vault';
import {
  getFavoriteTracks,
  toggleFavoriteTrack,
  subscribeFavoriteTracks,
} from '../storage/history';
import type { TrackInfo } from '../sync/protocol';

function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

function extractYouTubeId(urlOrQuery: string): string | null {
  const clean = urlOrQuery.trim();
  const reg =
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/;
  const match = clean.match(reg);
  if (match && match[1]) return match[1];
  const streamMatch = clean.match(/(?:\/stream\/|^yt:|^ytid:)([a-zA-Z0-9_-]{11})(?:\?|$)/);
  if (streamMatch && streamMatch[1]) return streamMatch[1];
  return null;
}

function QueueRowDragHandle({
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const lastDy = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 3,
      onPanResponderGrant: () => {
        lastDy.current = 0;
        void hapticSelection();
      },
      onPanResponderMove: (_, gesture) => {
        const delta = gesture.dy - lastDy.current;
        if (delta < -28 && index > 0) {
          lastDy.current = gesture.dy;
          onMoveUp();
          void hapticLight();
        } else if (delta > 28 && index < total - 1) {
          lastDy.current = gesture.dy;
          onMoveDown();
          void hapticLight();
        }
      },
      onPanResponderRelease: () => {
        lastDy.current = 0;
      },
      onPanResponderTerminate: () => {
        lastDy.current = 0;
      },
    })
  ).current;

  return (
    <View {...pan.panHandlers} style={styles.dragHandle} accessibilityLabel="Drag to reorder track">
      <GripVertical size={16} color={colors.text3} />
    </View>
  );
}

export function QueueList() {
  const {
    queue,
    nowPlaying,
    isHost,
    canControl,
    addTrack,
    addMultipleTracks,
    playNow,
    voteTrack,
    removeTrack,
    reorderQueue,
  } = useRoom();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importUrlToScan, setImportUrlToScan] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const isLink =
    query.trim().startsWith('http://') ||
    query.trim().startsWith('https://') ||
    query.trim().includes('youtu.be') ||
    query.trim().includes('youtube.com') ||
    query.trim().includes('spotify.com');

  const handleLinkAdd = (explicitQuery?: string) => {
    const q = (explicitQuery !== undefined ? explicitQuery : query).trim();
    if (!q) return;

    if (isPlaylistUrl(q)) {
      setImportUrlToScan(q);
      setImportModalVisible(true);
      setQuery('');
      setResults([]);
      setShowResults(false);
      return;
    }

    const ytId = extractYouTubeId(q);
    if (ytId) {
      addTrack({
        track_uri: ytId,
        track_name: 'YouTube Video',
        artist: 'YouTube',
      });
      toast('YouTube video added to queue', 'success');
      void hapticMedium();
    } else {
      addTrack({
        track_uri: q,
        track_name: q.startsWith('http') ? 'Queued Link' : q,
        artist: q.startsWith('http') ? 'Resolving Source…' : 'Search Query',
      });
      toast('Link added to queue', 'success');
      void hapticMedium();
    }
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const executeSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim();
    if (!q) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const ytId = extractYouTubeId(q);
    if (isLink || ytId) {
      handleLinkAdd(q);
      return;
    }

    setSearching(true);
    try {
      const res = await searchHybridTracks(q, (localMatches) => {
        if (localMatches.length > 0) {
          setResults(localMatches);
          setShowResults(true);
        }
      });
      setResults(res);
      setShowResults(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced auto-search
  useEffect(() => {
    const q = query.trim();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!q || isLink || extractYouTubeId(q)) {
      if (!q) {
        setResults([]);
        setShowResults(false);
      }
      return;
    }

    if (q.length < 2) return;

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchHybridTracks(q, (localMatches) => {
          if (localMatches.length > 0) {
            setResults(localMatches);
            setShowResults(true);
          }
        });
        setResults(res);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 380);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query, isLink]);

  const handleSelectTrack = (item: TrackSearchResult) => {
    addTrack({
      track_uri: item.uri,
      track_name: item.name,
      artist: item.artist,
      album_art_url: item.album_art_url,
      duration_ms: item.duration_ms,
    });
    void hapticMedium();
    toast(`Added "${item.name}"`, 'success');
    setResults([]);
    setShowResults(false);
    setQuery('');
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const playingQueueItem = queue.find((item) => item.status === 'playing');
  const activeTrack =
    nowPlaying ||
    (playingQueueItem
      ? {
          track_uri: playingQueueItem.track_uri,
          track_name: playingQueueItem.track_name,
          artist: playingQueueItem.artist,
          album_art_url: playingQueueItem.album_art_url,
          duration_ms: playingQueueItem.duration_ms,
        }
      : null);

  const activeTrackUri = (activeTrack?.track_uri || '').trim().toLowerCase();

  const upNextTracks = queue.filter((item) => {
    if (item.status === 'playing') return false;
    if (activeTrackUri && (item.track_uri || '').trim().toLowerCase() === activeTrackUri) {
      return false;
    }
    if (playingQueueItem) {
      const playingId = playingQueueItem.queue_item_id || playingQueueItem.id;
      const itemId = item.queue_item_id || item.id;
      if (playingId && itemId && playingId === itemId) return false;
    }
    return true;
  });

  const handleNudge = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= upNextTracks.length) return;
    const newUpcoming = [...upNextTracks];
    const temp = newUpcoming[index];
    newUpcoming[index] = newUpcoming[targetIndex];
    newUpcoming[targetIndex] = temp;
    const orderedIds = newUpcoming
      .map((item) => item.queue_item_id || item.id || '')
      .filter(Boolean);
    reorderQueue(orderedIds);
    void hapticLight();
  };

  // Universal Favorites / Likes in Queue
  const [favUris, setFavUris] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void getFavoriteTracks().then((favs) => {
      if (active) setFavUris(new Set(favs.map((f) => f.track_uri)));
    });
    const unsub = subscribeFavoriteTracks((favs) => {
      if (active) setFavUris(new Set(favs.map((f) => f.track_uri)));
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const handleToggleLike = async (track: TrackInfo) => {
    void hapticSelection();
    const next = await toggleFavoriteTrack(track);
    toast(next ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
  };

  // Live Download Progress Subscription
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, TrackDownloadProgress>>({});
  useEffect(() => {
    return subscribeDownloadProgress((map) => {
      setDownloadProgressMap({ ...map });
    });
  }, []);

  const isAnyDownloading = Object.values(downloadProgressMap).some((p) => p.state === 'downloading');

  const [isSavingVault, setIsSavingVault] = useState(false);
  const [isVaultSaved, setIsVaultSaved] = useState(false);

  const handleSaveQueueToVault = async () => {
    try {
      setIsSavingVault(true);
      const existing = await getVaultTracks();
      const existingUris = new Set(existing.map((t) => t.track_uri));
      const toDownload = filterSessionTracksToDownloadPure(activeTrack, upNextTracks, existingUris);

      if (toDownload.length === 0) {
        if (!activeTrack && upNextTracks.length === 0) {
          toast('No tracks to save', 'info');
        } else {
          setIsVaultSaved(true);
          toast('All upcoming tracks already in your vault!', 'info');
        }
        return;
      }

      toast(`Saving ${toDownload.length} track${toDownload.length > 1 ? 's' : ''} to vault…`, 'info');
      let count = 0;
      for (const t of toDownload) {
        try {
          await downloadTrackToVault(t, false);
          count++;
        } catch (e) {
          console.warn('Queue download error:', e);
        }
      }
      setIsVaultSaved(true);
      toast(`Saved ${count} track${count > 1 ? 's' : ''} to offline vault!`, 'success');
      void hapticMedium();
    } catch {
      toast('Failed saving queue to vault', 'error');
    } finally {
      setIsSavingVault(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <View style={styles.searchInputWrap}>
          <Pressable onPress={() => executeSearch()} hitSlop={6}>
            <Search size={16} color={colors.text3} style={{ marginRight: 8 }} />
          </Pressable>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs or paste a link…"
            placeholderTextColor={colors.text3}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => executeSearch()}
          />
          {query.length > 0 ? (
            <Pressable onPress={clearSearch} hitSlop={8} style={styles.clearBtn}>
              <X size={14} color={colors.text3} />
            </Pressable>
          ) : null}
        </View>

        {(isLink || extractYouTubeId(query)) && query.trim() ? (
          <Pressable
            onPress={() => handleLinkAdd()}
            style={({ pressed }) => [styles.linkBtn, pressed && styles.pressed]}
          >
            <Plus size={14} color="#08080a" strokeWidth={2.5} />
            <Text style={styles.linkBtnText}>Add</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => {
              setImportUrlToScan('');
              setImportModalVisible(true);
            }}
            style={({ pressed }) => [styles.importBtn, pressed && styles.pressed]}
            hitSlop={6}
            accessibilityLabel="Import Spotify or YouTube Playlist"
          >
            <DownloadCloud size={14} color={colors.amber} />
            <Text style={styles.importBtnText}>Import</Text>
          </Pressable>
        )}
      </View>

      {/* Searching spinner */}
      {searching ? (
        <View style={styles.searchingRow}>
          <ActivityIndicator color={colors.amber} size="small" />
          <Text style={styles.searchingText}>Searching tracks…</Text>
        </View>
      ) : null}

      {/* Screen Mode: Search Results OR Live Queue */}
      {showResults && results.length > 0 ? (
        <View style={styles.fullListContainer}>
          <View style={styles.listSectionHeader}>
            <Text style={styles.sectionTitle}>
              SEARCH RESULTS ({results.length})
            </Text>
            <Pressable
              onPress={clearSearch}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <ChevronLeft size={14} color={colors.amber} />
              <Text style={styles.dismissText}>Back to Queue</Text>
            </Pressable>
          </View>

          <FlatList
            data={results}
            keyExtractor={(i, idx) => i.uri || String(idx)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleSelectTrack(item)}
                style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
              >
                {item.album_art_url ? (
                  <Image source={{ uri: item.album_art_url }} style={styles.resultArt} contentFit="cover" />
                ) : (
                  <View style={[styles.resultArt, styles.artFallback]}>
                    <Music size={18} color={colors.text3} opacity={0.6} />
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.resultArtist} numberOfLines={1}>{item.artist}</Text>
                </View>
                {item.duration_ms ? (
                  <Text style={styles.resultDuration}>{fmtDuration(item.duration_ms)}</Text>
                ) : null}
                <View style={styles.resultActionsRow}>
                  <Pressable
                    onPress={() =>
                      handleToggleLike({
                        track_uri: item.uri,
                        track_name: item.name,
                        artist: item.artist,
                        album_art_url: item.album_art_url,
                        duration_ms: item.duration_ms,
                      })
                    }
                    style={styles.resultLikeBtn}
                    hitSlop={8}
                    accessibilityLabel={favUris.has(item.uri) ? 'Unlike track' : 'Like track'}
                  >
                    <Heart
                      size={15}
                      color={favUris.has(item.uri) ? '#ef4444' : colors.text3}
                      fill={favUris.has(item.uri) ? '#ef4444' : 'transparent'}
                    />
                  </Pressable>
                  {canControl ? (
                    <Pressable
                      onPress={() => {
                        playNow({
                          track_uri: item.uri,
                          track_name: item.name,
                          artist: item.artist,
                          album_art_url: item.album_art_url,
                          duration_ms: item.duration_ms,
                        });
                        void hapticMedium();
                        setResults([]);
                        setShowResults(false);
                        setQuery('');
                      }}
                      style={({ pressed }) => [styles.playNowPill, pressed && styles.pressed]}
                      hitSlop={6}
                    >
                      <Play size={10} color="#08080a" fill="#08080a" />
                      <Text style={styles.playNowPillText}>Play</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => handleSelectTrack(item)}
                    style={styles.addPill}
                    hitSlop={6}
                  >
                    <Plus size={12} color={colors.amber} strokeWidth={2.5} />
                    <Text style={styles.addPillText}>Add</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        </View>
      ) : (
        <View style={styles.fullListContainer}>
          {showResults && results.length === 0 && !searching && query.length >= 2 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No tracks found for "{query}"</Text>
              <Pressable onPress={clearSearch} style={styles.backToQueueBtn}>
                <Text style={styles.backToQueueText}>Show Queue</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={upNextTracks}
              keyExtractor={(i, index) => i.queue_item_id || i.id || `q-${index}`}
              showsVerticalScrollIndicator={false}
              style={styles.queueList}
              ListHeaderComponent={
                <View>
                  {/* Dedicated Now Playing Hero in Queue Tab */}
                  {activeTrack ? (
                    <View style={styles.nowPlayingSection}>
                      <View style={styles.nowPlayingHeaderRow}>
                        <View style={styles.liveIndicatorDot} />
                        <Text style={styles.nowPlayingSectionLabel}>NOW PLAYING</Text>
                      </View>
                      <View style={styles.nowPlayingCard}>
                        {activeTrack.album_art_url ? (
                          <Image
                            source={{ uri: activeTrack.album_art_url }}
                            style={styles.nowPlayingArt}
                            contentFit="cover"
                          />
                        ) : (
                          <View style={[styles.nowPlayingArt, styles.artFallback]}>
                            <Music size={20} color={colors.amber} />
                          </View>
                        )}
                        <View style={styles.nowPlayingInfo}>
                          <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                            {activeTrack.track_name}
                          </Text>
                          <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                            {activeTrack.artist}
                          </Text>
                        </View>
                        {activeTrack.duration_ms ? (
                          <Text style={styles.nowPlayingDuration}>
                            {fmtDuration(activeTrack.duration_ms)}
                          </Text>
                        ) : null}
                        <Pressable
                          onPress={() => handleToggleLike(activeTrack)}
                          style={({ pressed }) => [styles.nowPlayingLikeBtn, pressed && styles.pressed]}
                          hitSlop={8}
                          accessibilityLabel={favUris.has(activeTrack.track_uri) ? 'Unlike song' : 'Like song'}
                        >
                          <Heart
                            size={18}
                            color={favUris.has(activeTrack.track_uri) ? '#ef4444' : colors.text3}
                            fill={favUris.has(activeTrack.track_uri) ? '#ef4444' : 'transparent'}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {upNextTracks.length > 0 ? (
                    <View style={styles.listSectionHeader}>
                      <Text style={styles.sectionTitle}>
                        UP NEXT ({upNextTracks.length})
                      </Text>
                      <Pressable
                        onPress={handleSaveQueueToVault}
                        disabled={isSavingVault || isAnyDownloading}
                        style={({ pressed }) => [
                          styles.saveVaultBtn,
                          isVaultSaved && styles.saveVaultBtnSaved,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={6}
                        accessibilityLabel="Save entire queue to offline vault"
                      >
                        {isSavingVault || isAnyDownloading ? (
                          <>
                            <ActivityIndicator size="small" color={colors.amber} />
                            <Text style={[styles.saveVaultText, { color: colors.amber, marginLeft: 4 }]}>
                              Saving…
                            </Text>
                          </>
                        ) : isVaultSaved ? (
                          <>
                            <CheckCircle2 size={12} color="#10b981" />
                            <Text style={[styles.saveVaultText, { color: '#10b981' }]}>Saved</Text>
                          </>
                        ) : (
                          <>
                            <DownloadCloud size={12} color={colors.amber} />
                            <Text style={styles.saveVaultText}>Save to Vault</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <ListMusic size={36} color={colors.text3} opacity={0.4} style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyTitle}>
                    {activeTrack ? 'No songs up next' : 'Queue is empty'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {activeTrack
                      ? 'The music will stop after this track. Search songs above or import a playlist to keep the queue rolling.'
                      : 'Search songs above, paste a link, or import a Spotify / YouTube playlist to start playing music together.'}
                  </Text>
                  <View style={styles.emptyActionRow}>
                    <Pressable
                      onPress={() => inputRef.current?.focus()}
                      style={({ pressed }) => [styles.emptyActionBtn, pressed && styles.pressed]}
                      hitSlop={6}
                    >
                      <Search size={14} color="#08080a" />
                      <Text style={styles.emptyActionBtnText}>Search Songs</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setImportUrlToScan('');
                        setImportModalVisible(true);
                      }}
                      style={({ pressed }) => [styles.emptyImportBtn, pressed && styles.pressed]}
                      hitSlop={6}
                    >
                      <DownloadCloud size={14} color={colors.amber} />
                      <Text style={styles.emptyImportBtnText}>Import Playlist</Text>
                    </Pressable>
                  </View>
                </View>
              }
              renderItem={({ item, index }) => {
                const itemId = item.queue_item_id || item.id || '';
                return (
                  <View style={styles.queueRow}>
                    {/* Position Index */}
                    <Text style={styles.posIndex}>#{index + 1}</Text>

                    {/* Album Art */}
                    {item.album_art_url ? (
                      <Image source={{ uri: item.album_art_url }} style={styles.queueArt} contentFit="cover" />
                    ) : (
                      <View style={[styles.queueArt, styles.artFallback]}>
                        <Music size={18} color={colors.text3} opacity={0.6} />
                      </View>
                    )}

                    {/* Track Info */}
                    <View style={styles.queueInfo}>
                      <Text style={styles.queueName} numberOfLines={1}>
                        {item.track_name}
                      </Text>
                      <View style={styles.artistRow}>
                        <Text style={styles.queueArtist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                        {item.added_by ? (
                          <View style={styles.addedByBadge}>
                            <Text style={styles.addedByText} numberOfLines={1}>
                              @{item.added_by}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Play Now (for host / controller) */}
                    {canControl ? (
                      <Pressable
                        onPress={() => {
                          playNow({
                            track_uri: item.track_uri,
                            track_name: item.track_name,
                            artist: item.artist,
                            album_art_url: item.album_art_url,
                            duration_ms: item.duration_ms,
                          });
                          void hapticMedium();
                        }}
                        style={({ pressed }) => [styles.queuePlayBtn, pressed && styles.pressed]}
                        hitSlop={8}
                        accessibilityLabel="Play this track now"
                      >
                        <Play size={12} color={colors.amber} fill={colors.amber} style={{ marginLeft: 1 }} />
                      </Pressable>
                    ) : null}

                    {/* Universal Song Like Button */}
                    <Pressable
                      onPress={() => handleToggleLike(item)}
                      style={({ pressed }) => [styles.rowLikeBtn, pressed && styles.pressed]}
                      hitSlop={8}
                      accessibilityLabel={favUris.has(item.track_uri) ? 'Unlike song' : 'Like song'}
                    >
                      <Heart
                        size={15}
                        color={favUris.has(item.track_uri) ? '#ef4444' : colors.text3}
                        fill={favUris.has(item.track_uri) ? '#ef4444' : 'transparent'}
                      />
                    </Pressable>

                    {/* Upvote Pill */}
                    <Pressable
                      onPress={() => {
                        voteTrack(itemId);
                        void hapticLight();
                      }}
                      style={({ pressed }) => [
                        styles.voteBtn,
                        item.has_voted && styles.voteBtnActive,
                        pressed && styles.pressed,
                      ]}
                      hitSlop={8}
                    >
                      <View style={styles.voteBtnContent}>
                        <ArrowBigUp
                          size={14}
                          color={item.has_voted ? colors.amber : colors.text2}
                          fill={item.has_voted ? colors.amber : 'transparent'}
                        />
                        <Text style={[styles.voteText, item.has_voted && styles.voteTextActive]}>
                          {item.votes ?? 0}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Touch Drag Reorder Handle (Replaces chevron arrows) */}
                    {canControl && upNextTracks.length > 1 ? (
                      <QueueRowDragHandle
                        index={index}
                        total={upNextTracks.length}
                        onMoveUp={() => handleNudge(index, 'up')}
                        onMoveDown={() => handleNudge(index, 'down')}
                      />
                    ) : null}

                    {/* Host Remove */}
                    {isHost ? (
                      <Pressable
                        onPress={() => {
                          removeTrack(itemId);
                          void hapticHeavy();
                        }}
                        style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
                        hitSlop={8}
                        accessibilityLabel="Remove track from queue"
                      >
                        <Trash2 size={13} color={colors.red} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      <ImportPlaylistModal
        visible={importModalVisible}
        initialUrl={importUrlToScan}
        mode="queue"
        onClose={() => {
          setImportModalVisible(false);
          setImportUrlToScan('');
        }}
        onAddToQueue={(tracks) => {
          addMultipleTracks(tracks);
          toast(`Added ${tracks.length} tracks to queue!`, 'success');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  discoverySection: {
    marginBottom: 10,
  },
  discoveryChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
  },
  discoveryPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    marginRight: 2,
  },
  discoveryPrefixText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 9.5,
    color: colors.amber,
    letterSpacing: 0.8,
  },
  chipBtn: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipBtnActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderColor: colors.amber,
  },
  chipBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text2,
  },
  chipBtnTextActive: {
    color: colors.amber,
  },
  emptyPromptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  emptyChipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 22, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text1,
    paddingVertical: 0,
    minWidth: 0,
  },
  clearBtn: {
    paddingLeft: 8,
  },
  clearText: {
    fontSize: 14,
    color: colors.text3,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    justifyContent: 'center',
  },
  linkBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#08080a',
  },
  // Searching
  searchingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  searchingText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
  },
  // List Container
  fullListContainer: {
    flex: 1,
  },
  listSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dismissText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.amber,
  },
  saveVaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    gap: 5,
  },
  saveVaultBtnSaved: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10b981',
  },
  saveVaultText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  // Search Result Row
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  artFallback: {
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artGlyph: {
    color: colors.text3,
    fontSize: 16,
    opacity: 0.6,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.text1,
  },
  resultArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
  },
  resultDuration: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    fontVariant: ['tabular-nums'],
    marginRight: 6,
  },
  resultActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playNowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    marginRight: 6,
  },
  playNowPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#08080a',
  },
  queuePlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  noResults: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 10,
  },
  noResultsText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
  },
  backToQueueBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  backToQueueText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  // Queue List
  queueList: {
    flex: 1,
  },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  posIndex: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text3,
    width: 22,
    textAlign: 'center',
  },
  queueArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  queueInfo: {
    flex: 1,
  },
  queueName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.text1,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  queueArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    flexShrink: 1,
  },
  addedByBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  addedByText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 9,
    color: colors.amber,
  },
  voteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  voteBtnActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.18)',
    borderColor: colors.amber,
  },
  voteText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text2,
  },
  voteTextActive: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
  },
  dragHandle: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  rowLikeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlayingLikeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  resultLikeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  removeText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: colors.text1,
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 270,
    marginBottom: spacing.md,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    marginTop: 4,
  },
  emptyActionBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#08080a',
  },
  pressed: {
    opacity: 0.75,
  },
  // Dedicated Now Playing Card inside Queue Tab
  nowPlayingSection: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  nowPlayingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  nowPlayingSectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: colors.amber,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  nowPlayingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.22)',
    borderRadius: 12,
    padding: 8,
    gap: 10,
  },
  nowPlayingArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  nowPlayingInfo: {
    flex: 1,
  },
  nowPlayingTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: colors.text1,
  },
  nowPlayingArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text2,
    marginTop: 2,
  },
  nowPlayingDuration: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    fontVariant: ['tabular-nums'],
    marginRight: 4,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radius.md,
  },
  importBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  emptyActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  emptyImportBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: colors.amber,
  },
});
