/**
 * Solo Jam Search & Music Discovery Modal.
 *
 * Allows users to search any song/artist or paste YouTube/Spotify links,
 * explore instant starter vibes, and 1-tap play directly into Solo Jam mode.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Headphones,
  Music,
  Play,
  Search,
  Sparkles,
  X,
  Radio,
  Clock,
  Plus,
  Check,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { usePlayer } from '../audio/PlayerContext';
import { searchHybridTracks, type TrackSearchResult } from '../api';
import { useToast } from './ToastContext';
import { hapticLight, hapticMedium } from '../utils/haptics';
import {
  getRecentlyPlayed,
  getRecentSearches,
  saveRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  type PlayedTrack,
} from '../storage/history';
import type { TrackInfo } from '../sync/protocol';

interface SoloSearchModalProps {
  visible: boolean;
  onClose: () => void;
  mode?: 'play' | 'queue';
}

const STARTER_VIBES = [
  { id: 'lofi', label: 'Lofi Chill', query: 'lofi hip hop study beats' },
  { id: 'synthwave', label: 'Synthwave', query: 'synthwave retro night drive' },
  { id: 'ambient', label: 'Ambient Drift', query: 'ambient meditation atmosphere' },
  { id: 'pop', label: 'Trending Hits', query: 'popular hits music 2026' },
  { id: 'acoustic', label: 'Acoustic', query: 'coffee shop acoustic guitar' },
  { id: 'electronic', label: 'Electronic', query: 'electronic melodic beats' },
];

function fmtDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

export function SoloSearchModal({ visible, onClose, mode = 'play' }: SoloSearchModalProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { playTrack, addToQueue, playNextInQueue, setPlayerModalOpen } = usePlayer();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeVibe, setActiveVibe] = useState<string | null>(null);
  const [addedUris, setAddedUris] = useState<Set<string>>(new Set());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const searchRequestId = useRef(0);

  useEffect(() => {
    if (visible) {
      void getRecentlyPlayed().then(setRecentTracks).catch(() => {});
      void getRecentSearches().then(setRecentSearches).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setQuery('');
      setResults([]);
      setActiveVibe(null);
      setAddedUris(new Set());
    }
  }, [visible]);

  const executeSearch = useCallback(
    async (searchTerm: string) => {
      const q = searchTerm.trim();
      if (!q) {
        setResults([]);
        setSearching(false);
        return;
      }
      if (q.length >= 2) {
        void saveRecentSearch(q).then(setRecentSearches).catch(() => {});
      }
      const reqId = ++searchRequestId.current;
      setSearching(true);
      try {
        const found = await searchHybridTracks(
          q,
          (localMatches: TrackSearchResult[]) => {
            if (searchRequestId.current === reqId && localMatches.length > 0) {
              setResults(localMatches);
            }
          },
        );
        if (searchRequestId.current === reqId) {
          setResults(found);
        }
      } catch {
        if (searchRequestId.current === reqId) {
          toast('Search failed. Check connection.', 'error');
        }
      } finally {
        if (searchRequestId.current === reqId) {
          setSearching(false);
        }
      }
    },
    [toast],
  );

  const handleQueryChange = (text: string) => {
    setQuery(text);
    setActiveVibe(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      void executeSearch(text);
    }, 350);
  };

  const handleSelectRecentSearch = (searchTerm: string) => {
    void hapticLight();
    setQuery(searchTerm);
    setActiveVibe(null);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    void executeSearch(searchTerm);
  };

  const handleRemoveRecentSearch = async (searchTerm: string) => {
    void hapticLight();
    const updated = await removeRecentSearch(searchTerm);
    setRecentSearches(updated);
  };

  const handleClearAllRecentSearches = async () => {
    void hapticMedium();
    await clearRecentSearches();
    setRecentSearches([]);
  };

  const handleSelectVibe = (vibe: typeof STARTER_VIBES[0]) => {
    void hapticLight();
    setActiveVibe(vibe.id);
    setQuery(vibe.label);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    void executeSearch(vibe.query);
  };

  const handlePlaySelected = (item: TrackSearchResult) => {
    if (mode === 'queue') {
      handleAddToQueue(item);
      return;
    }
    void hapticMedium();
    const trackInfo: TrackInfo = {
      track_uri: item.uri,
      track_name: item.name,
      artist: item.artist,
      album_art_url: item.album_art_url,
      duration_ms: item.duration_ms,
    };

    // Close search & expand player immediately with zero network UI freeze
    onClose();
    setPlayerModalOpen(true);
    toast(`Playing "${item.name}"`, 'success');

    // Play track solo: ONLY this track in queue (user adds more songs explicitly)
    void playTrack(trackInfo, [trackInfo], { sourceTitle: 'Solo Jam' });
  };

  const handleAddToQueue = (item: TrackSearchResult) => {
    if (addedUris.has(item.uri)) return;
    void hapticLight();
    setAddedUris((prev) => new Set(prev).add(item.uri));

    const trackInfo: TrackInfo = {
      track_uri: item.uri,
      track_name: item.name,
      artist: item.artist,
      album_art_url: item.album_art_url,
      duration_ms: item.duration_ms,
    };
    addToQueue(trackInfo);
    toast(`Added "${item.name}" to queue`, 'success');
  };

  const handlePlayRecent = (track: PlayedTrack) => {
    if (mode === 'queue') {
      if (addedUris.has(track.track_uri)) return;
      void hapticLight();
      setAddedUris((prev) => new Set(prev).add(track.track_uri));
      const trackInfo: TrackInfo = {
        track_uri: track.track_uri,
        track_name: track.track_name,
        artist: track.artist,
        album_art_url: track.album_art_url,
        duration_ms: track.duration_ms,
      };
      addToQueue(trackInfo);
      toast(`Added "${track.track_name}" to queue`, 'success');
      return;
    }
    void hapticMedium();
    const trackInfo: TrackInfo = {
      track_uri: track.track_uri,
      track_name: track.track_name,
      artist: track.artist,
      album_art_url: track.album_art_url,
      duration_ms: track.duration_ms,
    };
    onClose();
    setPlayerModalOpen(true);
    toast(`Playing "${track.track_name}"`, 'success');
    void playTrack(trackInfo, [trackInfo], { sourceTitle: 'Recently Played' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              void hapticLight();
              onClose();
            }}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityLabel="Close search"
          >
            <ArrowLeft size={24} color="#ffffff" />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>
              {mode === 'queue' ? 'Add to Queue' : 'Solo Jam'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {mode === 'queue' ? 'Tap songs or + to add to Up Next' : 'Search & play any music instantly'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        {/* Search Input Bar */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Search size={18} color="#777788" style={{ marginRight: 8 }} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={handleQueryChange}
              placeholder="Search songs, artists, or paste link…"
              placeholderTextColor="#666677"
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => void executeSearch(query)}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setActiveVibe(null);
                }}
                hitSlop={8}
                style={styles.clearBtn}
              >
                <X size={16} color="#9999aa" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Quick Starter Vibes Horizontal Chips */}
        <View style={styles.vibesContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={STARTER_VIBES}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.vibesList}
            renderItem={({ item }) => {
              const isSelected = activeVibe === item.id;
              return (
                <Pressable
                  onPress={() => handleSelectVibe(item)}
                  style={[styles.vibeChip, isSelected && styles.vibeChipActive]}
                >
                  <Sparkles size={11} color={isSelected ? colors.amber : '#888899'} style={{ marginRight: 4 }} />
                  <Text style={[styles.vibeChipText, isSelected && styles.vibeChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Main Content: Results or Recent / Starter Picks */}
        {searching ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.amber} />
            <Text style={styles.loadingText}>Searching music catalog…</Text>
          </View>
        ) : results.length > 0 ? (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.uri}_${index}`}
            contentContainerStyle={styles.resultsList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handlePlaySelected(item)}
                style={({ pressed }) => [styles.trackRow, pressed && styles.trackRowPressed]}
              >
                <Image
                  source={{ uri: item.album_art_url || 'https://openjam.fun/default_art.png' }}
                  style={styles.trackArt}
                  contentFit="cover"
                />
                <View style={styles.trackInfo}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>

                <View style={styles.trackActionsRow}>
                  {item.duration_ms ? (
                    <Text style={styles.trackDuration}>{fmtDuration(item.duration_ms)}</Text>
                  ) : null}

                  {/* 1-Tap Add to Queue Button */}
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddToQueue(item);
                    }}
                    hitSlop={8}
                    style={[
                      styles.addQueueBtn,
                      addedUris.has(item.uri) && styles.addQueueBtnSuccess,
                    ]}
                    accessibilityLabel={`Add ${item.name} to queue`}
                  >
                    {addedUris.has(item.uri) ? (
                      <Check size={14} color="#10b981" strokeWidth={2.5} />
                    ) : (
                      <Plus size={16} color={colors.amber} />
                    )}
                  </Pressable>

                  {/* 1-Tap Play Now Button */}
                  <View style={styles.playBtn}>
                    <Play size={13} color="#08080a" fill="#08080a" style={{ marginLeft: 2 }} />
                  </View>
                </View>
              </Pressable>
            )}
          />
        ) : query.trim().length > 0 ? (
          <View style={styles.emptyWrap}>
            <Music size={40} color="#333344" />
            <Text style={styles.emptyTitle}>No songs found for "{query}"</Text>
            <Text style={styles.emptySubtitle}>Try searching an artist name, song title, or genre vibe</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.emptyStateScrollView}
            contentContainerStyle={styles.emptyStateContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Recent Searches Pills */}
            {recentSearches.length > 0 && (
              <View style={styles.recentSearchesSection}>
                <View style={styles.sectionHeaderBetween}>
                  <View style={styles.sectionHeaderLeft}>
                    <Clock size={13} color={colors.amber} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionTitle}>RECENT SEARCHES</Text>
                  </View>
                  <Pressable onPress={handleClearAllRecentSearches} hitSlop={8}>
                    <Text style={styles.clearAllText}>Clear All</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.recentSearchesScroll}
                >
                  {recentSearches.map((s) => (
                    <View key={s} style={styles.recentSearchChip}>
                      <Pressable
                        onPress={() => handleSelectRecentSearch(s)}
                        style={styles.recentSearchChipMain}
                        accessibilityLabel={`Search for ${s}`}
                      >
                        <Text style={styles.recentSearchChipText} numberOfLines={1}>
                          {s}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void handleRemoveRecentSearch(s)}
                        hitSlop={8}
                        style={styles.recentSearchChipRemove}
                        accessibilityLabel={`Remove search ${s}`}
                      >
                        <X size={12} color="#888899" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {recentTracks.length > 0 ? (
              <View style={styles.sectionWrap}>
                <View style={styles.sectionHeader}>
                  <Clock size={14} color={colors.amber} style={{ marginRight: 6 }} />
                  <Text style={styles.sectionTitle}>RECENTLY PLAYED</Text>
                </View>
                {recentTracks.slice(0, 5).map((item, i) => (
                  <Pressable
                    key={`${item.track_uri}_${i}`}
                    onPress={() => void handlePlayRecent(item)}
                    style={styles.recentRow}
                  >
                    <Image
                      source={{ uri: item.album_art_url || 'https://openjam.fun/default_art.png' }}
                      style={styles.recentArt}
                      contentFit="cover"
                    />
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTitle} numberOfLines={1}>
                        {item.track_name}
                      </Text>
                      <Text style={styles.recentArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </View>
                    <Play size={16} color={colors.amber} />
                  </Pressable>
                ))}
              </View>
            ) : recentSearches.length === 0 ? (
              <View style={styles.introBox}>
                <Headphones size={44} color={colors.amber} style={{ marginBottom: 12 }} />
                <Text style={styles.introTitle}>Ready to Listen Solo?</Text>
                <Text style={styles.introSubtitle}>
                  Search for any song, artist, or pick one of the vibes above to start streaming immediately.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
  },
  headerSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: '#888899',
    marginTop: 1,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: '#ffffff',
    height: '100%',
  },
  clearBtn: {
    padding: 4,
  },
  vibesContainer: {
    paddingVertical: 8,
  },
  vibesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  vibeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  vibeChipActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderColor: 'rgba(255, 159, 28, 0.4)',
  },
  vibeChipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#9999aa',
  },
  vibeChipTextActive: {
    color: colors.amber,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: '#888899',
  },
  resultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    gap: 12,
  },
  trackRowPressed: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#181824',
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14.5,
    color: '#ffffff',
  },
  trackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#888899',
    marginTop: 2,
  },
  trackDuration: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: '#666677',
    marginRight: 6,
  },
  trackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addQueueBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addQueueBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: '#777788',
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyStateScrollView: {
    flex: 1,
  },
  emptyStateContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  recentSearchesSection: {
    marginBottom: 16,
  },
  sectionHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearAllText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: '#888899',
  },
  recentSearchesScroll: {
    gap: 8,
    paddingRight: 16,
  },
  recentSearchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  recentSearchChipMain: {
    marginRight: 6,
  },
  recentSearchChipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12.5,
    color: '#ddddf0',
    maxWidth: 160,
  },
  recentSearchChipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  sectionWrap: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#888899',
    letterSpacing: 0.8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 6,
    gap: 10,
  },
  recentArt: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#181822',
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  recentArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: '#777788',
    marginTop: 1,
  },
  introBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  introTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
  },
  introSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: '#888899',
    textAlign: 'center',
    lineHeight: 18,
  },
});
