/**
 * AddSongsModal — Interactive Song Picker & Search for Playlists
 *
 * Allows adding tracks to an offline playlist via:
 * 1. Live debounced search across hybrid database & YouTube
 * 2. Liked Songs (Favorites)
 * 3. Recently Played History
 * 4. Paste Spotify / YouTube Link (Bulk Importer)
 *
 * Features instant 1-tap addition with haptic feedback and real-time state sync.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  X,
  Search,
  Plus,
  Check,
  Heart,
  Clock,
  Link2,
  Music,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { searchHybridTracks, importExternalPlaylist, isPlaylistUrl, type TrackSearchResult } from '../api';
import {
  getFavoriteTracks,
  getRecentlyPlayed,
  addTrackToOfflinePlaylist,
  addTracksBulkToOfflinePlaylist,
} from '../storage/history';
import type { TrackInfo } from '../sync/protocol';
import { useToast } from './ToastContext';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface AddSongsModalProps {
  visible: boolean;
  playlistId: string;
  playlistName: string;
  existingTrackUris?: Set<string>;
  onClose: () => void;
  onTrackAdded: (track: TrackInfo) => void;
  onTracksBulkAdded?: (tracks: TrackInfo[]) => void;
}

type TabType = 'search' | 'favorites' | 'history' | 'link';

export function AddSongsModal({
  visible,
  playlistId,
  playlistName,
  existingTrackUris = new Set(),
  onClose,
  onTrackAdded,
  onTracksBulkAdded,
}: AddSongsModalProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrackSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addedUris, setAddedUris] = useState<Set<string>>(new Set());

  const [favorites, setFavorites] = useState<TrackInfo[]>([]);
  const [history, setHistory] = useState<TrackInfo[]>([]);

  // Link import tab
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setAddedUris(new Set(existingTrackUris));
      setSearchQuery('');
      setSearchResults([]);
      setLinkUrl('');
      setLinkError(null);
      void loadSourceCollections();
    }
  }, [visible]);

  const loadSourceCollections = async () => {
    try {
      const [favs, recents] = await Promise.all([
        getFavoriteTracks(),
        getRecentlyPlayed(),
      ]);
      setFavorites(favs);
      setHistory(recents);
    } catch {}
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    const clean = text.trim();
    if (!clean) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const results = await searchHybridTracks(clean);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  };

  const handleAddSingleTrack = async (item: {
    uri?: string;
    track_uri?: string;
    name?: string;
    track_name?: string;
    artist?: string;
    album_art_url?: string;
    duration_ms?: number;
  }) => {
    const trackUri = item.track_uri || item.uri || '';
    if (!trackUri || addedUris.has(trackUri)) return;

    const track: TrackInfo = {
      track_uri: trackUri,
      track_name: item.track_name || item.name || 'Unknown Track',
      artist: item.artist || 'Unknown Artist',
      album_art_url: item.album_art_url,
      duration_ms: item.duration_ms || 0,
    };

    void hapticMedium();
    setAddedUris((prev) => new Set(prev).add(trackUri));
    await addTrackToOfflinePlaylist(playlistId, track);
    onTrackAdded(track);
    toast(`Added "${track.track_name}"`, 'success');
  };

  const handleImportLink = async () => {
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl) {
      setLinkError('Please enter a Spotify or YouTube playlist URL');
      return;
    }
    if (!isPlaylistUrl(cleanUrl)) {
      setLinkError('URL must be a public Spotify or YouTube playlist link');
      return;
    }

    setLinkLoading(true);
    setLinkError(null);
    try {
      void hapticLight();
      const imported = await importExternalPlaylist(cleanUrl);
      if (!imported || imported.length === 0) {
        setLinkError('No tracks found in playlist. Ensure it is public.');
        setLinkLoading(false);
        return;
      }

      const mapped: TrackInfo[] = imported.map((t) => ({
        track_uri: t.uri,
        track_name: t.name,
        artist: t.artist,
        album_art_url: t.album_art_url,
        duration_ms: t.duration_ms || 0,
      }));

      await addTracksBulkToOfflinePlaylist(playlistId, mapped);
      onTracksBulkAdded?.(mapped);
      mapped.forEach((t) => {
        setAddedUris((prev) => new Set(prev).add(t.track_uri));
      });
      void hapticMedium();
      toast(`Added ${mapped.length} tracks to ${playlistName}`, 'success');
      onClose();
    } catch (err: any) {
      setLinkError(err?.message || 'Failed to import playlist');
    } finally {
      setLinkLoading(false);
    }
  };

  const renderTrackItem = (item: {
    uri?: string;
    track_uri?: string;
    name?: string;
    track_name?: string;
    artist?: string;
    album_art_url?: string;
    duration_ms?: number;
  }) => {
    const trackUri = item.track_uri || item.uri || '';
    const trackName = item.track_name || item.name || 'Unknown Track';
    const artist = item.artist || 'Unknown Artist';
    const artUrl = item.album_art_url;
    const isAdded = addedUris.has(trackUri);

    return (
      <View style={styles.trackRow}>
        {artUrl ? (
          <Image source={{ uri: artUrl }} style={styles.trackArt} contentFit="cover" />
        ) : (
          <View style={[styles.trackArt, styles.artFallback]}>
            <Music size={15} color={colors.text3} />
          </View>
        )}
        <View style={styles.trackMeta}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {trackName}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {artist}
          </Text>
        </View>

        <Pressable
          onPress={() => void handleAddSingleTrack(item)}
          disabled={isAdded}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addBtn,
            isAdded && styles.addBtnDone,
            pressed && !isAdded && styles.pressed,
          ]}
          accessibilityLabel={isAdded ? 'Already added' : `Add ${trackName} to playlist`}
        >
          {isAdded ? (
            <Check size={14} color="#10b981" strokeWidth={2.6} />
          ) : (
            <Plus size={15} color="#08080a" strokeWidth={2.4} />
          )}
        </Pressable>
      </View>
    );
  };

  const bottomPad = Math.max(insets.bottom, 20) + 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheetContainer, { paddingBottom: bottomPad }]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.headerTitle}>Add Songs</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  To {playlistName}
                </Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <X size={18} color={colors.text2} />
              </Pressable>
            </View>

            {/* Source Tabs */}
            <View style={styles.tabRow}>
              <Pressable
                onPress={() => setActiveTab('search')}
                style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
              >
                <Search size={13} color={activeTab === 'search' ? colors.amber : colors.text3} />
                <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                  Search
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('favorites')}
                style={[styles.tabBtn, activeTab === 'favorites' && styles.tabBtnActive]}
              >
                <Heart size={13} color={activeTab === 'favorites' ? colors.amber : colors.text3} />
                <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
                  Liked
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('history')}
                style={[styles.tabBtn, activeTab === 'history' && styles.tabBtnActive]}
              >
                <Clock size={13} color={activeTab === 'history' ? colors.amber : colors.text3} />
                <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                  Recent
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('link')}
                style={[styles.tabBtn, activeTab === 'link' && styles.tabBtnActive]}
              >
                <Link2 size={13} color={activeTab === 'link' ? colors.amber : colors.text3} />
                <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>
                  Link
                </Text>
              </Pressable>
            </View>

            {/* Content Area */}
            {activeTab === 'search' && (
              <View style={styles.contentWrap}>
                <View style={styles.searchBar}>
                  <Search size={16} color={colors.text3} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    placeholder="Search song title or artist…"
                    placeholderTextColor={colors.text3}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectTextOnFocus
                  />
                  {searchLoading ? (
                    <ActivityIndicator size="small" color={colors.amber} />
                  ) : searchQuery.length > 0 ? (
                    <Pressable onPress={() => handleSearchChange('')} hitSlop={8}>
                      <X size={14} color={colors.text3} />
                    </Pressable>
                  ) : null}
                </View>

                <FlatList
                  data={searchResults}
                  keyExtractor={(item, index) => `${item.uri}_${index}`}
                  renderItem={({ item }) => renderTrackItem(item)}
                  style={styles.trackList}
                  showsVerticalScrollIndicator={true}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      {searchQuery.trim().length > 0 && !searchLoading ? (
                        <Text style={styles.emptyText}>No matching tracks found</Text>
                      ) : (
                        <Text style={styles.emptyText}>Type above to search millions of songs</Text>
                      )}
                    </View>
                  }
                />
              </View>
            )}

            {activeTab === 'favorites' && (
              <View style={styles.contentWrap}>
                <FlatList
                  data={favorites}
                  keyExtractor={(item, index) => `${item.track_uri}_${index}`}
                  renderItem={({ item }) => renderTrackItem(item)}
                  style={styles.trackList}
                  showsVerticalScrollIndicator={true}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No liked songs yet</Text>
                    </View>
                  }
                />
              </View>
            )}

            {activeTab === 'history' && (
              <View style={styles.contentWrap}>
                <FlatList
                  data={history}
                  keyExtractor={(item, index) => `${item.track_uri}_${index}`}
                  renderItem={({ item }) => renderTrackItem(item)}
                  style={styles.trackList}
                  showsVerticalScrollIndicator={true}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No listening history recorded yet</Text>
                    </View>
                  }
                />
              </View>
            )}

            {activeTab === 'link' && (
              <View style={styles.linkWrap}>
                <View style={styles.linkInputRow}>
                  <Link2 size={16} color={colors.amber} />
                  <TextInput
                    value={linkUrl}
                    onChangeText={(val) => {
                      setLinkUrl(val);
                      setLinkError(null);
                    }}
                    placeholder="Paste Spotify or YouTube playlist link…"
                    placeholderTextColor={colors.text3}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {linkUrl.length > 0 && (
                    <Pressable onPress={() => setLinkUrl('')} hitSlop={8}>
                      <X size={14} color={colors.text3} />
                    </Pressable>
                  )}
                </View>

                {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}

                <Pressable
                  onPress={handleImportLink}
                  disabled={linkLoading || !linkUrl.trim()}
                  style={({ pressed }) => [
                    styles.importActionBtn,
                    (!linkUrl.trim() || linkLoading) && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {linkLoading ? (
                    <ActivityIndicator size="small" color="#08080a" />
                  ) : (
                    <>
                      <Sparkles size={16} color="#08080a" />
                      <Text style={styles.importActionBtnText}>Import All to Playlist</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
  },
  sheetContainer: {
    backgroundColor: '#121217',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.text1,
  },
  headerSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
  },
  tabText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11.5,
    color: colors.text3,
  },
  tabTextActive: {
    color: colors.amber,
    fontFamily: fontFamily.displayBold,
  },
  contentWrap: {
    minHeight: 280,
    maxHeight: 380,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text1,
    paddingVertical: 0,
  },
  trackList: {
    flex: 1,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackArt: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  artFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackMeta: {
    flex: 1,
  },
  trackTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.text1,
  },
  trackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text2,
    marginTop: 1,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  pressed: {
    opacity: 0.8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: colors.text3,
  },
  linkWrap: {
    paddingVertical: spacing.md,
    gap: 12,
  },
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontFamily: fontFamily.bodyRegular,
  },
  importActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    height: 46,
    marginTop: 6,
  },
  importActionBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#08080a',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
