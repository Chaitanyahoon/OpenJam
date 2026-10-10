/**
 * Playlist Detail Screen.
 *
 * Supports both remote community playlists (GET /playlists/:id)
 * and sandboxed local offline playlists (getOfflinePlaylists).
 *
 * Features:
 * - High-contrast hero with cover artwork & playlist stats
 * - "Queue All in Room" / "Instant Room with Playlist"
 * - Preview playback of individual tracks
 * - Remove tracks / Delete playlist (for local playlists)
 * - Native sharing
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  Share2,
  Play,
  Pause,
  Trash2,
  Music,
  Radio,
  Plus,
  Disc,
  Shuffle,
  Sparkles,
  ListPlus,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import { MiniPlayer } from '../../components/MiniPlayer';
import {
  getPlaylist,
  createRoom,
  getRooms,
  type ApiPlaylist,
  type ApiPlaylistTrack,
  type RoomSummary,
} from '../../api';
import {
  getOfflinePlaylists,
  deleteOfflinePlaylist,
  removeTrackFromOfflinePlaylist,
  addTracksBulkToOfflinePlaylist,
  shuffleTracks,
  type OfflinePlaylist,
} from '../../storage/history';
import { usePlayer } from '../../audio/PlayerContext';
import { useToast } from '../../components/ToastContext';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { AddSongsModal } from '../../components/AddSongsModal';
import { ImportPlaylistModal } from '../../components/ImportPlaylistModal';
import type { TrackInfo } from '../../sync/protocol';

interface UnifiedTrack {
  track_uri: string;
  track_name: string;
  artist: string;
  album_art_url?: string;
  duration_ms?: number;
}

export default function PlaylistDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const playlistId = Array.isArray(params.id) ? params.id[0] : params.id;
  const insets = useSafeAreaInsets();
  const player = usePlayer();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | undefined>();
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!playlistId) return;
    setLoading(true);
    try {
      // 1. Check local offline playlists first
      const offline = await getOfflinePlaylists();
      const localMatch = offline.find((p) => p.id === playlistId);
      if (localMatch) {
        setIsLocal(true);
        setTitle(localMatch.name);
        setTracks(
          (localMatch.tracks || []).map((t: any) => ({
            track_uri: t.track_uri || t.uri || '',
            track_name: t.track_name || t.name || t.title || 'Unknown Track',
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url || t.thumbnail || t.cover_art_url,
            duration_ms: typeof t.duration_ms === 'number' ? t.duration_ms : 0,
          })),
        );
        setLoading(false);
        return;
      }

      // 2. Try fetching from backend API
      const remote = await getPlaylist(playlistId);
      if (remote) {
        setIsLocal(false);
        setTitle(remote.name);
        setDescription(remote.description);
        setTracks(
          (remote.tracks || []).map((t: any) => ({
            track_uri: t.track_uri || t.uri || '',
            track_name: t.track_name || t.name || t.title || 'Unknown Track',
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url || t.thumbnail || t.cover_art_url,
            duration_ms: typeof t.duration_ms === 'number' ? t.duration_ms : 0,
          })),
        );
      } else {
        toast('Playlist not found', 'error');
      }
    } catch {
      toast('Failed to load playlist', 'error');
    } finally {
      setLoading(false);
    }
  }, [playlistId, toast]);

  const handleTrackAdded = useCallback((newTrack: TrackInfo) => {
    setTracks((prev) => {
      const exists = prev.some((t) => t.track_uri === newTrack.track_uri);
      if (exists) return prev;
      return [
        ...prev,
        {
          track_uri: newTrack.track_uri,
          track_name: newTrack.track_name,
          artist: newTrack.artist,
          album_art_url: newTrack.album_art_url,
          duration_ms: newTrack.duration_ms,
        },
      ];
    });
  }, []);

  const handleTracksBulkAdded = useCallback((newTracks: TrackInfo[]) => {
    setTracks((prev) => {
      const existingUris = new Set(prev.map((t) => t.track_uri));
      const fresh = newTracks
        .filter((t) => !existingUris.has(t.track_uri))
        .map((t) => ({
          track_uri: t.track_uri,
          track_name: t.track_name,
          artist: t.artist,
          album_art_url: t.album_art_url,
          duration_ms: t.duration_ms,
        }));
      return [...prev, ...fresh];
    });
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleShare = async () => {
    try {
      void hapticLight();
      await Share.share({
        message: `Listen to "${title}" on OpenJam!\nhttps://www.openjam.fun/playlist/${playlistId}`,
        title: `OpenJam – ${title}`,
      });
    } catch {}
  };

  const handleDeletePlaylist = () => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            void hapticMedium();
            if (isLocal) {
              await deleteOfflinePlaylist(playlistId);
            }
            toast(`Deleted "${title}"`, 'info');
            router.back();
          },
        },
      ],
    );
  };

  const handleRemoveTrack = async (trackUri: string) => {
    if (!isLocal) return;
    void hapticLight();
    await removeTrackFromOfflinePlaylist(playlistId, trackUri);
    setTracks((prev) => prev.filter((t) => t.track_uri !== trackUri));
    toast('Track removed from playlist', 'info');
  };

  const handlePlayPlaylist = () => {
    if (tracks.length === 0) return;
    void hapticMedium();
    player.setPlayerModalOpen(true);
    void player.playTrack(tracks[0], tracks, { sourceTitle: title });
  };

  const handleShufflePlaylist = () => {
    if (tracks.length === 0) return;
    void hapticMedium();
    const shuffled = shuffleTracks(tracks);
    player.setPlayerModalOpen(true);
    void player.playTrack(shuffled[0], shuffled, { sourceTitle: `${title} (Shuffle)` });
  };

  const handleEnqueueAll = () => {
    if (tracks.length === 0) return;
    void hapticLight();
    tracks.forEach((t) => {
      player.addToQueue({
        track_uri: t.track_uri,
        track_name: t.track_name,
        artist: t.artist,
        album_art_url: t.album_art_url,
        duration_ms: t.duration_ms,
      });
    });
    toast(`Added ${tracks.length} tracks to Up Next`, 'success');
  };

  const handleTrackPress = (track: UnifiedTrack) => {
    void hapticLight();
    player.setPlayerModalOpen(true);
    void player.playTrack(track, tracks, { sourceTitle: title });
  };

  const handlePreviewTrack = (track: UnifiedTrack) => {
    handleTrackPress(track);
  };

  const handleQueueAllInRoom = async () => {
    if (tracks.length === 0) {
      toast('Playlist has no tracks to play', 'info');
      return;
    }
    void hapticMedium();

    // Create a new room with this playlist or launch into one
    Alert.alert(
      'Start Jam Room',
      `Create a new synchronized room with the ${tracks.length} tracks from "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Room',
          onPress: async () => {
            try {
              const newRoom = await createRoom({
                name: `${title} Jam`,
                description: `Listening to ${title}`,
                genre_tags: ['playlist', 'jam'],
                allow_guest_controls: true,
              });
              toast(`Room "${newRoom.name}" created!`, 'success');
              router.push({
                pathname: '/room/[id]/player',
                params: { id: newRoom.id, name: newRoom.name },
              });
            } catch {
              toast('Could not create room', 'error');
            }
          },
        },
      ],
    );
  };

  const totalDurationMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
  const totalMinutes = Math.round(totalDurationMs / 60000);
  const coverArt = tracks.find((t) => !!t.album_art_url)?.album_art_url;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={styles.loadingText}>Loading playlist…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Header bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={12}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={colors.text1} />
        </Pressable>

        <Text style={styles.barTitle} numberOfLines={1}>
          {title || 'Playlist'}
        </Text>

        <View style={styles.barRight}>
          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={10}
            accessibilityLabel="Share playlist"
          >
            <Share2 size={18} color={colors.text2} />
          </Pressable>
          {isLocal && (
            <Pressable
              onPress={handleDeletePlaylist}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              hitSlop={10}
              accessibilityLabel="Delete playlist"
            >
              <Trash2 size={18} color="#ef4444" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={tracks}
        keyExtractor={(item, index) => `${item.track_uri}_${index}`}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.heroSection}>
            {/* Playlist Artwork Banner */}
            <View style={styles.coverWrap}>
              {coverArt ? (
                <Image source={{ uri: coverArt }} style={styles.coverArt} contentFit="cover" />
              ) : (
                <LinearGradient
                  colors={['#242436', '#14141e']}
                  style={styles.coverPlaceholder}
                >
                  <Disc size={64} color={colors.amber} />
                </LinearGradient>
              )}
            </View>

            <Text style={styles.heroTitle}>{title}</Text>
            {description ? <Text style={styles.heroDesc}>{description}</Text> : null}

            <View style={styles.metaRow}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{isLocal ? 'OFFLINE' : 'COMMUNITY'}</Text>
              </View>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaText}>{tracks.length} tracks</Text>
              {totalMinutes > 0 ? (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>{totalMinutes} mins</Text>
                </>
              ) : null}
            </View>

            {/* Play, Shuffle, Add Songs & Jam Actions */}
            <View style={styles.playlistActionsRow}>
              <Pressable
                onPress={handlePlayPlaylist}
                disabled={tracks.length === 0}
                style={({ pressed }) => [
                  styles.playPlaylistBtn,
                  tracks.length === 0 && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Play playlist"
              >
                <LinearGradient
                  colors={['#ffb03a', '#ff9f1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playGradient}
                >
                  <Play size={16} color="#08080a" fill="#08080a" style={{ marginLeft: 2 }} />
                  <Text style={styles.playPlaylistText}>Play</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleShufflePlaylist}
                disabled={tracks.length === 0}
                style={({ pressed }) => [
                  styles.shufflePlaylistBtn,
                  tracks.length === 0 && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Shuffle playlist"
              >
                <Shuffle size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.shufflePlaylistText}>Shuffle</Text>
              </Pressable>

              <Pressable
                onPress={handleEnqueueAll}
                disabled={tracks.length === 0}
                style={({ pressed }) => [
                  styles.queuePlaylistBtn,
                  tracks.length === 0 && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel="Add playlist to queue"
              >
                <ListPlus size={16} color="#ffffff" strokeWidth={2.2} />
                <Text style={styles.queuePlaylistText}>Queue</Text>
              </Pressable>

              {isLocal && (
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    setShowAddSongsModal(true);
                  }}
                  style={({ pressed }) => [styles.addSongsIconBtn, pressed && styles.pressed]}
                  accessibilityLabel="Add songs to playlist"
                >
                  <Plus size={18} color={colors.amber} strokeWidth={2.4} />
                </Pressable>
              )}

              <Pressable
                onPress={handleQueueAllInRoom}
                style={({ pressed }) => [styles.jamRoomIconBtn, pressed && styles.pressed]}
                accessibilityLabel="Start Jam Room with friends"
              >
                <Radio size={16} color={colors.amber} />
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isPlayingThis = player.currentTrack?.track_uri === item.track_uri;
          return (
            <Pressable
              onPress={() => handleTrackPress(item)}
              style={({ pressed }) => [
                styles.trackRow,
                pressed && styles.trackRowPressed,
                isPlayingThis && styles.trackRowPlaying,
              ]}
              accessibilityLabel={`Play ${item.track_name} by ${item.artist}`}
            >
              <Text style={[styles.trackIndex, isPlayingThis && styles.trackIndexActive]}>
                {index + 1}
              </Text>
              <View style={styles.trackThumbWrap}>
                {item.album_art_url ? (
                  <Image source={{ uri: item.album_art_url }} style={styles.trackThumb} />
                ) : (
                  <View style={styles.trackThumbFallback}>
                    <Music size={14} color={colors.amber} />
                  </View>
                )}
                <View style={[styles.playOverlay, isPlayingThis && styles.playOverlayActive]}>
                  {isPlayingThis ? (
                    <Radio size={12} color={colors.amber} />
                  ) : (
                    <Play size={12} color="#ffffff" fill="#ffffff" />
                  )}
                </View>
              </View>

              <View style={styles.trackMeta}>
                <Text
                  style={[styles.trackTitle, isPlayingThis && styles.trackTitleActive]}
                  numberOfLines={1}
                >
                  {item.track_name}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>

              <View style={styles.trackRowActions}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    void hapticLight();
                    player.addToQueue({
                      track_uri: item.track_uri,
                      track_name: item.track_name,
                      artist: item.artist,
                      album_art_url: item.album_art_url,
                      duration_ms: item.duration_ms,
                    });
                    toast(`Added "${item.track_name}" to queue`, 'success');
                  }}
                  hitSlop={10}
                  style={styles.addTrackQueueBtn}
                  accessibilityLabel={`Add ${item.track_name} to queue`}
                >
                  <Plus size={16} color={colors.text2} />
                </Pressable>

                {isLocal && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      void handleRemoveTrack(item.track_uri);
                    }}
                    hitSlop={12}
                    style={styles.removeTrackBtn}
                    accessibilityLabel="Remove track"
                  >
                    <Trash2 size={15} color={colors.text3} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Music size={32} color={colors.amber} />
            </View>
            <Text style={styles.emptyTitle}>This playlist is empty</Text>
            <Text style={styles.emptySub}>
              Add songs from search, liked tracks, or import from Spotify/YouTube.
            </Text>

            {isLocal ? (
              <View style={styles.emptyActionsRow}>
                <Pressable
                  onPress={() => {
                    void hapticMedium();
                    setShowAddSongsModal(true);
                  }}
                  style={({ pressed }) => [styles.emptyAddBtn, pressed && styles.pressed]}
                >
                  <Plus size={15} color="#08080a" strokeWidth={2.4} />
                  <Text style={styles.emptyAddBtnText}>Add Songs</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void hapticLight();
                    setShowImportModal(true);
                  }}
                  style={({ pressed }) => [styles.emptyImportBtn, pressed && styles.pressed]}
                >
                  <Sparkles size={14} color={colors.amber} />
                  <Text style={styles.emptyImportBtnText}>Import Link</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
      />
      <MiniPlayer bottomOffset={insets.bottom} />

      {isLocal && (
        <>
          <AddSongsModal
            visible={showAddSongsModal}
            playlistId={playlistId}
            playlistName={title}
            existingTrackUris={new Set(tracks.map((t) => t.track_uri))}
            onClose={() => setShowAddSongsModal(false)}
            onTrackAdded={handleTrackAdded}
            onTracksBulkAdded={handleTracksBulkAdded}
          />
          <ImportPlaylistModal
            visible={showImportModal}
            mode="save"
            onClose={() => setShowImportModal(false)}
            onSaveToPlaylists={(_name, importedTracks) => {
              void addTracksBulkToOfflinePlaylist(playlistId, importedTracks);
              handleTracksBulkAdded(importedTracks);
            }}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: '#0c0c12',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  barTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    textAlign: 'center',
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.text2,
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
  },
  listContent: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  coverWrap: {
    width: 160,
    height: 160,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.bgSurface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 4,
  },
  heroDesc: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  badgePill: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: {
    color: colors.amber,
    fontSize: 10,
    fontFamily: fontFamily.displayBold,
    letterSpacing: 0.5,
  },
  metaDot: {
    color: colors.text3,
    fontSize: 12,
  },
  metaText: {
    color: colors.text2,
    fontSize: 12,
    fontFamily: fontFamily.bodyMedium,
  },
  playlistActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  playPlaylistBtn: {
    flex: 2,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  playGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  playPlaylistText: {
    color: '#08080a',
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
  },
  shufflePlaylistBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  shufflePlaylistText: {
    color: '#ffffff',
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
  },
  queuePlaylistBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  queuePlaylistText: {
    color: '#ffffff',
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
  },
  jamRoomIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startJamBtn: {
    width: '100%',
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: 6,
  },
  startJamGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  startJamText: {
    color: '#08080a',
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  trackIndex: {
    width: 24,
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    textAlign: 'center',
  },
  trackThumbWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing.sm,
    position: 'relative',
  },
  trackThumb: {
    width: '100%',
    height: '100%',
  },
  trackThumbFallback: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    color: colors.text1,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 14,
  },
  trackTitleActive: {
    color: colors.amber,
  },
  trackArtist: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  trackRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addTrackQueueBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTrackBtn: {
    padding: spacing.xs,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  addSongsIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackRowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackRowPlaying: {
    backgroundColor: 'rgba(255, 159, 28, 0.07)',
  },
  trackIndexActive: {
    color: colors.amber,
    fontFamily: fontFamily.displayBold,
  },
  playOverlayActive: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  emptyAddBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#08080a',
  },
  emptyImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  emptyImportBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#ffffff',
  },
  emptyWrap: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
  emptySub: {
    color: colors.text3,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
