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
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
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
  type OfflinePlaylist,
} from '../../storage/history';
import { usePlayer } from '../../audio/PlayerContext';
import { useToast } from '../../components/ToastContext';
import { hapticLight, hapticMedium } from '../../utils/haptics';

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
  const player = usePlayer();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [isLocal, setIsLocal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string | undefined>();
  const [tracks, setTracks] = useState<UnifiedTrack[]>([]);
  const [playingTrackUri, setPlayingTrackUri] = useState<string | null>(null);

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
          localMatch.tracks.map((t) => ({
            track_uri: t.track_uri,
            track_name: t.track_name,
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url,
            duration_ms: t.duration_ms,
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
          (remote.tracks || []).map((t) => ({
            track_uri: t.track_uri,
            track_name: t.track_name,
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url,
            duration_ms: t.duration_ms,
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

  const handlePreviewTrack = async (track: UnifiedTrack) => {
    void hapticLight();
    if (playingTrackUri === track.track_uri) {
      player.pause();
      setPlayingTrackUri(null);
    } else {
      await player.loadTrack(track.track_uri, {
        title: track.track_name,
        artist: track.artist,
        artworkUrl: track.album_art_url,
      });
      player.play();
      setPlayingTrackUri(track.track_uri);
    }
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
        contentContainerStyle={styles.listContent}
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

            {/* CTA: Start Jam Room */}
            <Pressable
              onPress={handleQueueAllInRoom}
              style={({ pressed }) => [styles.startJamBtn, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#ffb03a', '#ff9f1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.startJamGradient}
              >
                <Radio size={16} color="#08080a" />
                <Text style={styles.startJamText}>Start Room with Playlist</Text>
              </LinearGradient>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => {
          const isPlayingThis = playingTrackUri === item.track_uri;
          return (
            <View style={styles.trackRow}>
              <Text style={styles.trackIndex}>{index + 1}</Text>
              <Pressable
                onPress={() => handlePreviewTrack(item)}
                style={styles.trackThumbWrap}
              >
                {item.album_art_url ? (
                  <Image source={{ uri: item.album_art_url }} style={styles.trackThumb} />
                ) : (
                  <View style={styles.trackThumbFallback}>
                    <Music size={14} color={colors.amber} />
                  </View>
                )}
                <View style={styles.playOverlay}>
                  {isPlayingThis ? (
                    <Pause size={12} color="#ffffff" fill="#ffffff" />
                  ) : (
                    <Play size={12} color="#ffffff" fill="#ffffff" />
                  )}
                </View>
              </Pressable>

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

              {isLocal && (
                <Pressable
                  onPress={() => handleRemoveTrack(item.track_uri)}
                  hitSlop={10}
                  style={styles.removeTrackBtn}
                  accessibilityLabel="Remove track"
                >
                  <Trash2 size={14} color={colors.text3} />
                </Pressable>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Music size={36} color={colors.text3} />
            <Text style={styles.emptyTitle}>No tracks in this playlist</Text>
            <Text style={styles.emptySub}>
              Save songs to this playlist from any room player.
            </Text>
          </View>
        }
      />
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
  removeTrackBtn: {
    padding: spacing.xs,
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
