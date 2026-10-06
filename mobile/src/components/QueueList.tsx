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
  ChevronUp,
  ChevronDown,
  Music,
  ListMusic,
  ArrowBigUp,
  Trash2,
  Sparkles,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';
import { searchTracks, type TrackSearchResult } from '../api';
import { useToast } from './ToastContext';
import { hapticLight, hapticMedium, hapticHeavy } from '../utils/haptics';

const DISCOVERY_CHIPS = ['Lofi Beats', 'Synthwave', 'Chillhop', 'Anime OST', 'Jazz Hop', 'Gaming Chill'];

const CURATED_RECOMMENDATIONS = [
  {
    track_uri: 'jfKfPfyJRdk',
    track_name: 'Lofi Hip Hop Chill Beats',
    artist: 'Lofi Girl',
    album_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
    duration_ms: 180000,
    tag: 'Lofi',
  },
  {
    track_uri: '4xDzrJKXOOY',
    track_name: 'Synthwave Night Drive',
    artist: 'Retro Dreamer',
    album_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    duration_ms: 210000,
    tag: 'Synthwave',
  },
  {
    track_uri: '5qap5aO4i9A',
    track_name: 'Coffee Shop Acoustic Chill',
    artist: 'Acoustic Jam',
    album_art_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    duration_ms: 195000,
    tag: 'Acoustic',
  },
  {
    track_uri: 'DWcJFNfaw9c',
    track_name: 'Midnight City Dreams',
    artist: 'Neon Sunset',
    album_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80',
    duration_ms: 240000,
    tag: 'Electronic',
  },
];

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

export function QueueList() {
  const {
    queue,
    nowPlaying,
    isHost,
    canControl,
    addTrack,
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
      const res = await searchTracks(q);
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
        const res = await searchTracks(q);
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

  const handleNudge = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= queue.length) return;
    const newQueue = [...queue];
    const temp = newQueue[index];
    newQueue[index] = newQueue[targetIndex];
    newQueue[targetIndex] = temp;
    const orderedIds = newQueue.map((item) => item.queue_item_id || item.id || '');
    reorderQueue(orderedIds);
    void hapticLight();
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
        ) : null}
      </View>

      {/* Quick Discovery Chips */}
      {!showResults ? (
        <View style={styles.discoverySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.discoveryChipsRow}
          >
            <View style={styles.discoveryPrefix}>
              <Sparkles size={11} color={colors.amber} />
              <Text style={styles.discoveryPrefixText}>VIBES</Text>
            </View>
            {DISCOVERY_CHIPS.map((chip) => (
              <Pressable
                key={chip}
                onPress={() => {
                  setQuery(chip);
                  void executeSearch(chip);
                  void hapticLight();
                }}
                style={({ pressed }) => [
                  styles.chipBtn,
                  query === chip && styles.chipBtnActive,
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
              >
                <Text
                  style={[
                    styles.chipBtnText,
                    query === chip && styles.chipBtnTextActive,
                  ]}
                >
                  {chip}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

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
              data={queue}
              keyExtractor={(i, index) => i.queue_item_id || i.id || `q-${index}`}
              showsVerticalScrollIndicator={false}
              style={styles.queueList}
              ListHeaderComponent={
                queue.length > 0 ? (
                  <View style={styles.listSectionHeader}>
                    <Text style={styles.sectionTitle}>
                      UP NEXT ({queue.length})
                    </Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <ListMusic size={36} color={colors.text3} opacity={0.4} style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyTitle}>
                    {nowPlaying ? 'No songs up next' : 'Queue is empty'}
                  </Text>
                  <Text style={styles.emptySub}>
                    {nowPlaying
                      ? 'Add more tracks to keep the music flowing seamlessly:'
                      : 'Search above or tap + on a recommended track to kick off the session:'}
                  </Text>
                  <View style={styles.emptyPromptRow}>
                    {DISCOVERY_CHIPS.map((chip) => (
                      <Pressable
                        key={chip}
                        onPress={() => {
                          setQuery(chip);
                          void executeSearch(chip);
                          void hapticLight();
                        }}
                        style={({ pressed }) => [styles.emptyChip, pressed && styles.pressed]}
                      >
                        <Sparkles size={11} color={colors.amber} />
                        <Text style={styles.emptyChipText}>{chip}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Recommended Starter Tracks Cards */}
                  <View style={styles.recSection}>
                    <View style={styles.recHeaderRow}>
                      <Text style={styles.recSectionTitle}>RECOMMENDED TRACKS</Text>
                      <Text style={styles.recSectionSub}>1-Tap Quick Add</Text>
                    </View>
                    {CURATED_RECOMMENDATIONS.map((track) => (
                      <View key={track.track_uri} style={styles.recRow}>
                        <Image source={{ uri: track.album_art_url }} style={styles.recArt} contentFit="cover" />
                        <View style={styles.recInfo}>
                          <Text style={styles.recName} numberOfLines={1}>{track.track_name}</Text>
                          <View style={styles.recMetaRow}>
                            <Text style={styles.recArtist} numberOfLines={1}>{track.artist}</Text>
                            <View style={styles.recTagBadge}>
                              <Text style={styles.recTagText}>{track.tag}</Text>
                            </View>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => {
                            addTrack(track);
                            toast(`Added "${track.track_name}" to queue`, 'success');
                            void hapticMedium();
                          }}
                          style={({ pressed }) => [styles.recAddBtn, pressed && styles.pressed]}
                          hitSlop={8}
                          accessibilityLabel={`Add ${track.track_name} to queue`}
                        >
                          <Plus size={16} color={colors.amber} />
                        </Pressable>
                      </View>
                    ))}
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

                    {/* Host Reorder / Nudge buttons */}
                    {canControl && queue.length > 1 ? (
                      <View style={styles.nudgeCol}>
                        <Pressable
                          onPress={() => handleNudge(index, 'up')}
                          disabled={index === 0}
                          style={({ pressed }) => [
                            styles.nudgeBtn,
                            index === 0 && styles.nudgeBtnDisabled,
                            pressed && styles.pressed,
                          ]}
                          hitSlop={6}
                          accessibilityLabel="Move track up"
                        >
                          <ChevronUp size={11} color={index === 0 ? colors.text3 : colors.text2} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleNudge(index, 'down')}
                          disabled={index === queue.length - 1}
                          style={({ pressed }) => [
                            styles.nudgeBtn,
                            index === queue.length - 1 && styles.nudgeBtnDisabled,
                            pressed && styles.pressed,
                          ]}
                          hitSlop={6}
                          accessibilityLabel="Move track down"
                        >
                          <ChevronDown
                            size={11}
                            color={index === queue.length - 1 ? colors.text3 : colors.text2}
                          />
                        </Pressable>
                      </View>
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
  nudgeCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginRight: 4,
  },
  nudgeBtn: {
    width: 24,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  nudgeBtnDisabled: {
    opacity: 0.25,
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
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
    opacity: 0.5,
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
    maxWidth: 260,
  },
  pressed: {
    opacity: 0.75,
  },
  recSection: {
    width: '100%',
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  recHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  recSectionTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11.5,
    color: colors.amber,
    letterSpacing: 0.8,
  },
  recSectionSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
    gap: 10,
  },
  recArt: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  recInfo: {
    flex: 1,
  },
  recName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.text1,
  },
  recMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  recArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    flexShrink: 1,
  },
  recTagBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
  },
  recTagText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 9,
    color: colors.amber,
  },
  recAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
