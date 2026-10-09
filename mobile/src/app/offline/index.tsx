/**
 * OpenJam Dedicated Offline Audio Vault Screen.
 *
 * - Sandboxed offline music playback with zero network dependency.
 * - Storage usage gauge (e.g. "42.5 MB / 1.0 GB").
 * - 1-Tap "Download All Liked Songs" batch downloader with live progress.
 * - Offline playlist management and track playback via native expo-audio.
 * - 1-Tap "Broadcast to Live Room" to spin up a synchronized room with friends.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CloudDownload,
  Disc,
  Download,
  HardDrive,
  Heart,
  Music2,
  Play,
  Pause,
  Radio,
  Share2,
  Trash2,
  WifiOff,
  CheckCircle2,
  Sparkles,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import { usePlayer, usePlayerStatus } from '../../audio/PlayerContext';
import { useToast } from '../../components/ToastContext';
import {
  VaultTrack,
  VaultStats,
  getVaultTracks,
  getVaultStats,
  deleteTrackFromVault,
  clearVault,
  downloadTrackToVault,
  formatBytesPure,
  subscribeDownloadProgress,
  type TrackDownloadProgress,
} from '../../storage/vault';
import {
  getFavoriteTracks,
  getOfflinePlaylists,
  toggleFavoriteTrack,
  type OfflinePlaylist,
} from '../../storage/history';
import { subscribeNetworkState, isDeviceOnline } from '../../utils/network';
import { hapticLight } from '../../utils/haptics';
import { createRoom } from '../../api';
import type { TrackInfo } from '../../sync/protocol';
import { MiniPlayer } from '../../components/MiniPlayer';

export default function OfflineVaultScreen() {
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isCompact = winHeight < 720 || winWidth < 380;
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const { loadTrack, play, pause, playTrack, setPlayerModalOpen } = usePlayer();
  const { playing: isPlaying } = usePlayerStatus();

  const [activeTab, setActiveTab] = useState<'all' | 'liked' | 'playlists'>('all');
  const [vaultTracks, setVaultTracks] = useState<VaultTrack[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<TrackInfo[]>([]);
  const [playlists, setPlaylists] = useState<OfflinePlaylist[]>([]);
  const [stats, setStats] = useState<VaultStats>({
    totalTracks: 0,
    totalBytes: 0,
    formattedSize: '0.0 MB',
    storageBudgetBytes: 1024 * 1024 * 1024,
    percentUsed: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activePlayingUri, setActivePlayingUri] = useState<string | null>(null);

  // Network Connectivity Status
  const [isOnline, setIsOnline] = useState(isDeviceOnline());
  useEffect(() => {
    return subscribeNetworkState((online) => {
      setIsOnline(online);
    });
  }, []);

  // Download Progress Mapping
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, TrackDownloadProgress>>({});
  useEffect(() => {
    return subscribeDownloadProgress((progressMap) => {
      setDownloadProgressMap({ ...progressMap });
    });
  }, []);

  // Batch downloading status
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [downloadingTrackUris, setDownloadingTrackUris] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [vTracks, fTracks, pLists, vStats] = await Promise.all([
        getVaultTracks(),
        getFavoriteTracks(),
        getOfflinePlaylists(),
        getVaultStats(),
      ]);
      setVaultTracks(vTracks);
      setFavoriteTracks(fTracks);
      setPlaylists(pLists);
      setStats(vStats);
    } catch (err) {
      console.warn('Failed to load vault data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  // Play an offline track via local file URI
  const handlePlayOfflineTrack = async (track: VaultTrack | TrackInfo) => {
    try {
      void hapticLight();
      setActivePlayingUri(track.track_uri);
      await playTrack(track, vaultTracks, { sourceTitle: 'Offline Vault' });
      setPlayerModalOpen(true);
      toast(`Playing "${track.track_name}" offline`, 'success');
    } catch {
      toast('Failed to play offline track', 'error');
    }
  };

  // Delete a downloaded track
  const handleDeleteTrack = async (trackUri: string, trackName: string) => {
    Alert.alert(
      'Remove from Vault',
      `Delete "${trackName}" from your device? This frees up local storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const ok = await deleteTrackFromVault(trackUri);
            if (ok) {
              if (activePlayingUri === trackUri) {
                pause();
                setActivePlayingUri(null);
              }
              toast(`Removed "${trackName}"`, 'info');
              void loadData();
            } else {
              toast('Could not delete track', 'error');
            }
          },
        },
      ],
    );
  };

  // 1-Tap Download a single track to the vault
  const handleDownloadSingle = async (track: TrackInfo) => {
    if (downloadingTrackUris.has(track.track_uri)) return;

    setDownloadingTrackUris((prev) => new Set(prev).add(track.track_uri));
    toast(`Downloading "${track.track_name}"...`, 'info');
    try {
      const isFav = favoriteTracks.some((ft) => ft.track_uri === track.track_uri);
      await downloadTrackToVault(track, isFav);
      toast(`Downloaded "${track.track_name}"! Ready offline.`, 'success');
      await loadData();
    } catch {
      toast(`Failed to download "${track.track_name}"`, 'error');
    } finally {
      setDownloadingTrackUris((prev) => {
        const next = new Set(prev);
        next.delete(track.track_uri);
        return next;
      });
    }
  };

  // 1-Tap Batch Download Liked Songs
  const handleDownloadAllLiked = async () => {
    const unDownloaded = favoriteTracks.filter(
      (ft) => !vaultTracks.some((vt) => vt.track_uri === ft.track_uri),
    );

    if (unDownloaded.length === 0) {
      toast('All Liked Songs are already saved offline!', 'info');
      return;
    }

    setIsBatchDownloading(true);
    setBatchProgress({ done: 0, total: unDownloaded.length });
    toast(`Starting download of ${unDownloaded.length} tracks...`, 'info');

    let successCount = 0;
    for (let i = 0; i < unDownloaded.length; i++) {
      const track = unDownloaded[i];
      try {
        await downloadTrackToVault(track, true);
        successCount++;
      } catch (err) {
        console.warn('Batch download item error:', err);
      }
      setBatchProgress({ done: i + 1, total: unDownloaded.length });
    }

    setIsBatchDownloading(false);
    toast(`Saved ${successCount} tracks to offline vault!`, 'success');
    await loadData();
  };

  // Clear entire vault
  const handleClearAll = () => {
    Alert.alert(
      'Clear Offline Vault',
      'This will delete all downloaded audio files from your device. You can re-download anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            pause();
            setActivePlayingUri(null);
            await clearVault();
            toast('Offline vault cleared', 'info');
            void loadData();
          },
        },
      ],
    );
  };

  // 1-Tap Broadcast to Live Room
  const handleBroadcastToLiveRoom = async (playlistTracks: TrackInfo[], roomName: string) => {
    if (playlistTracks.length === 0) {
      toast('No tracks to broadcast', 'error');
      return;
    }
    try {
      toast('Spinning up live room...', 'info');
      const newRoom = await createRoom({
        name: roomName || 'My Offline Jam',
        is_private: false,
      });
      toast(`Room "${newRoom.name}" created! Broadcasting...`, 'success');
      router.push(`/room/${newRoom.id}`);
    } catch {
      toast('Could not create live room. Check connection.', 'error');
    }
  };

  // Filtered tracks based on active tab
  const displayedTracks = useMemo(() => {
    if (activeTab === 'all') return vaultTracks;
    if (activeTab === 'liked') {
      return favoriteTracks.map((ft) => {
        const v = vaultTracks.find((vt) => vt.track_uri === ft.track_uri);
        return v || { ...ft, local_file_uri: '', file_size_bytes: 0, downloaded_at: 0, is_liked: true, last_played_at: 0, play_count: 0 };
      });
    }
    return vaultTracks;
  }, [activeTab, vaultTracks, favoriteTracks]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      {/* Top Header */}
      <View style={[styles.header, isCompact && styles.headerCompact]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={18} color="#ffffff" />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, isCompact && styles.headerTitleCompact]}>
            Offline Audio Vault
          </Text>
          <View style={styles.offlineStatusChip}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.statusChipText}>Ready Offline</Text>
          </View>
        </View>

        <Pressable
          onPress={handleClearAll}
          hitSlop={10}
          style={({ pressed }) => [styles.clearBtn, pressed && styles.pressed]}
          accessibilityLabel="Clear storage"
        >
          <Trash2 size={16} color={colors.text3} />
        </Pressable>
      </View>

      {/* Network Connectivity Status Strip */}
      {!isOnline ? (
        <View style={styles.offlineNoticeBanner}>
          <WifiOff size={13} color="#f59e0b" />
          <Text style={styles.offlineNoticeText}>
            No internet connection • Playing from local vault storage
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.onlineReturnBanner, pressed && styles.pressed]}
        >
          <Radio size={13} color="#10b981" />
          <Text style={styles.onlineReturnText}>
            Connection restored • Tap to return to Home
          </Text>
        </Pressable>
      )}

      {/* Storage Gauge Card */}
      <View style={[styles.storageCard, isCompact && styles.storageCardCompact]}>
        <View style={styles.storageCardHeader}>
          <View style={styles.storageIconWrap}>
            <HardDrive size={16} color={colors.amber} />
          </View>
          <View style={styles.storageTextWrap}>
            <Text style={styles.storageTitle}>SANDBOXED STORAGE</Text>
            <Text style={styles.storageSubtitle}>
              {stats.formattedSize} used • {stats.totalTracks} tracks stored
            </Text>
          </View>
          <View style={styles.percentBadge}>
            <Text style={styles.percentText}>{stats.percentUsed}%</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressBarTrack}>
          <LinearGradient
            colors={[colors.amber, '#ff6b35']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${Math.max(4, Math.min(100, stats.percentUsed))}%` }]}
          />
        </View>

        {/* Batch Action Row */}
        <View style={styles.actionRow}>
          <Pressable
            disabled={isBatchDownloading}
            onPress={handleDownloadAllLiked}
            style={({ pressed }) => [
              styles.downloadAllBtn,
              isCompact && styles.downloadAllBtnCompact,
              pressed && styles.pressed,
              isBatchDownloading && styles.btnDisabled,
            ]}
          >
            {isBatchDownloading ? (
              <>
                <ActivityIndicator size="small" color="#08080a" />
                <Text style={styles.downloadAllBtnText}>
                  Saving ({batchProgress.done}/{batchProgress.total})...
                </Text>
              </>
            ) : (
              <>
                <CloudDownload size={14} color="#08080a" />
                <Text style={styles.downloadAllBtnText}>
                  Download Liked ({favoriteTracks.length})
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => handleBroadcastToLiveRoom(vaultTracks, 'Offline Mixtape')}
            disabled={vaultTracks.length === 0}
            style={({ pressed }) => [
              styles.broadcastBtn,
              isCompact && styles.broadcastBtnCompact,
              pressed && styles.pressed,
              vaultTracks.length === 0 && styles.btnDisabled,
            ]}
          >
            <Sparkles size={13} color="#ffffff" />
            <Text style={styles.broadcastBtnText}>Broadcast to Room</Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs Filter Bar */}
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setActiveTab('all')}
          style={[styles.tabChip, activeTab === 'all' && styles.tabChipActive]}
        >
          <Text style={[styles.tabChipText, activeTab === 'all' && styles.tabChipTextActive]}>
            All Vault ({vaultTracks.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('liked')}
          style={[styles.tabChip, activeTab === 'liked' && styles.tabChipActive]}
        >
          <Text style={[styles.tabChipText, activeTab === 'liked' && styles.tabChipTextActive]}>
            Liked Songs ({favoriteTracks.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('playlists')}
          style={[styles.tabChip, activeTab === 'playlists' && styles.tabChipActive]}
        >
          <Text style={[styles.tabChipText, activeTab === 'playlists' && styles.tabChipTextActive]}>
            Playlists ({playlists.length})
          </Text>
        </Pressable>
      </View>

      {/* Track List Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={styles.loadingText}>Loading audio vault...</Text>
        </View>
      ) : activeTab === 'playlists' ? (
        /* Playlists Tab */
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 40 },
          ]}
        >
          {playlists.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Music2 size={36} color={colors.text3} />
              <Text style={styles.emptyTitle}>No offline playlists yet</Text>
              <Text style={styles.emptySubtitle}>
                Create and save playlists in OpenJam to access them offline anytime.
              </Text>
            </View>
          ) : (
            playlists.map((pl) => (
              <View key={pl.id} style={styles.playlistCard}>
                <View style={styles.playlistInfo}>
                  <Text style={styles.playlistName}>{pl.name}</Text>
                  <Text style={styles.playlistCount}>{pl.tracks.length} tracks</Text>
                </View>
                <Pressable
                  onPress={() => handleBroadcastToLiveRoom(pl.tracks, pl.name)}
                  style={({ pressed }) => [styles.playlistBroadcastBtn, pressed && styles.pressed]}
                >
                  <Radio size={13} color={colors.amber} />
                  <Text style={styles.playlistBroadcastText}>Live Jam</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      ) : displayedTracks.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Disc size={42} color={colors.amber} />
          <Text style={styles.emptyTitle}>Your Audio Pocket is Empty</Text>
          <Text style={styles.emptySubtitle}>
            Download songs or liked tracks to play offline with zero internet and zero latency.
          </Text>
        </View>
      ) : (
        /* Tracks List */
        <FlatList
          data={displayedTracks}
          keyExtractor={(item) => item.track_uri}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 50 },
          ]}
          renderItem={({ item }) => {
            const isDownloaded = vaultTracks.some((vt) => vt.track_uri === item.track_uri);
            const prog = downloadProgressMap[item.track_uri];
            const isDownloading = downloadingTrackUris.has(item.track_uri) || prog?.state === 'downloading';
            const isCurrentPlaying = activePlayingUri === item.track_uri && isPlaying;
            const fileSize = (item as VaultTrack).file_size_bytes;

            return (
              <View style={[styles.trackCard, isCurrentPlaying && styles.trackCardActive]}>
                <Pressable
                  onPress={() => void handlePlayOfflineTrack(item)}
                  style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]}
                  hitSlop={8}
                >
                  {isCurrentPlaying ? (
                    <Pause size={16} color={colors.amber} />
                  ) : (
                    <Play size={16} color="#ffffff" />
                  )}
                </Pressable>

                <View style={styles.trackDetails}>
                  <Text
                    style={[styles.trackTitle, isCurrentPlaying && styles.trackTitleActive]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.track_name}
                  </Text>
                  <View style={styles.trackMetaRow}>
                    <Text style={styles.trackArtist} numberOfLines={1} ellipsizeMode="tail">
                      {item.artist || 'Unknown Artist'}
                    </Text>
                    {isDownloaded && fileSize ? (
                      <>
                        <Text style={styles.dotSeparator}>•</Text>
                        <Text style={styles.fileSizeBadge}>{formatBytesPure(fileSize)}</Text>
                      </>
                    ) : null}
                  </View>
                </View>

                {/* Status & Actions */}
                <View style={styles.trackActions}>
                  {isDownloading ? (
                    <View style={styles.downloadProgressPill}>
                      <ActivityIndicator size="small" color={colors.amber} />
                      <Text style={styles.downloadProgressText}>
                        {prog?.percent ? `${prog.percent}%` : 'Saving…'}
                      </Text>
                    </View>
                  ) : isDownloaded ? (
                    <>
                      <View style={styles.downloadedPill}>
                        <CheckCircle2 size={12} color="#10b981" />
                        <Text style={styles.downloadedPillText}>Ready Offline</Text>
                      </View>
                      <Pressable
                        onPress={() => void handleDeleteTrack(item.track_uri, item.track_name)}
                        hitSlop={10}
                        style={({ pressed }) => [styles.trashBtn, pressed && styles.pressed]}
                      >
                        <Trash2 size={13} color={colors.text3} />
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={() => void handleDownloadSingle(item)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.actionDownloadBtn, pressed && styles.pressed]}
                    >
                      <Download size={14} color={colors.amber} />
                      <Text style={styles.actionDownloadText}>Save</Text>
                    </Pressable>
                  )}
                </View>

                {/* Progress bar line for downloading tracks */}
                {isDownloading && (
                  <View style={styles.downloadBarTrack}>
                    <View style={[styles.downloadBarFill, { width: `${Math.max(5, prog?.percent || 5)}%` }]} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
      <MiniPlayer bottomOffset={insets.bottom} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#07070a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerCompact: {
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  headerTitleCompact: {
    fontSize: 15,
  },
  offlineStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  statusDotGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusChipText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.text3,
  },
  clearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storageCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: 'rgba(18, 18, 24, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  storageCardCompact: {
    padding: 12,
  },
  storageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  storageIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  storageTextWrap: {
    flex: 1,
  },
  storageTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 0.8,
  },
  storageSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text2,
    marginTop: 1,
  },
  percentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  percentText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 11,
    color: '#ffffff',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  downloadAllBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    paddingVertical: 9,
    borderRadius: 10,
  },
  downloadAllBtnCompact: {
    paddingVertical: 7,
  },
  downloadAllBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    color: '#08080a',
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  broadcastBtnCompact: {
    paddingVertical: 7,
  },
  broadcastBtnText: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 11,
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabChipActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  tabChipText: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 11,
    color: colors.text3,
  },
  tabChipTextActive: {
    color: colors.amber,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 6,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 6,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(18, 18, 24, 0.7)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  downloadBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  downloadBarFill: {
    height: 3,
    backgroundColor: colors.amber,
    borderRadius: 1.5,
  },
  trackCardActive: {
    borderColor: 'rgba(255, 159, 28, 0.4)',
    backgroundColor: 'rgba(255, 159, 28, 0.05)',
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  trackDetails: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  trackTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  trackTitleActive: {
    color: colors.amber,
  },
  trackMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  trackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    flexShrink: 1,
  },
  dotSeparator: {
    fontSize: 10,
    color: colors.text3,
  },
  fileSizeBadge: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.amber,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  downloadedPillText: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 9,
    color: '#10b981',
  },
  trashBtn: {
    padding: 6,
  },
  actionDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
  },
  actionDownloadText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(18, 18, 24, 0.8)',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  playlistCount: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
  },
  playlistBroadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
  },
  playlistBroadcastText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.75,
  },
  offlineNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  offlineNoticeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: '#f59e0b',
    flex: 1,
  },
  onlineReturnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: radius.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  onlineReturnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#10b981',
    flex: 1,
  },
  downloadProgressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  downloadProgressText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
});
