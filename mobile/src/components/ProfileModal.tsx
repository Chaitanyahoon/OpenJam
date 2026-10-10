/**
 * Profile Suite — Full native profile, listening stats, recently played history,
 * favorite rooms, and local storage cache manager.
 */
import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  LogIn,
  LogOut,
  Shuffle,
  Music,
  Radio,
  Clock,
  Sparkles,
  Trash2,
  Bookmark,
  Sliders,
  ChevronRight,
  Play,
  Plus,
  Check,
  Pencil,
  ListMusic,
  Share2,
  Heart,
  ExternalLink,
  DownloadCloud,
  Headphones,
  Vibrate,
  Bell,
  HardDrive,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { getPlaylist, type ApiUser, RoomSummary } from '../api';
import { usePlayer } from '../audio/PlayerContext';
import type { TrackInfo } from '../sync/protocol';
import { useUserProfile } from '../domain/useUserProfile';
import {
  shuffleTracks,
  type OfflinePlaylist,
  type PlayedTrack,
  type FavoriteRoom,
  type ListeningStats,
  type AppPreferences,
} from '../storage/history';
import { useToast } from './ToastContext';
import { updateHapticsPreference, hapticMedium, hapticLight } from '../utils/haptics';
import { ImportPlaylistModal } from './ImportPlaylistModal';

interface ProfileModalProps {
  visible: boolean;
  user: ApiUser | null;
  currentName?: string;
  onClose: () => void;
  onUpdateGuestName: (newName: string) => void;
  onDiscordLogin?: () => void;
  onSignOut?: () => void;
  onJoinRoom?: (roomId: string) => void;
  onPlayTrack?: (track: PlayedTrack, queue?: TrackInfo[], options?: { sourceTitle?: string }) => void;
}

type TabMode = 'history' | 'playlists' | 'favorites' | 'settings';

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const COOL_NAMES = [
  'SonicWave', 'VelvetGroove', 'LofiAstronaut', 'VinylVibe', 'NeonEcho',
  'MidnightRhythm', 'CosmicJammer', 'RetroPulse', 'Subwoofer', 'SynthRider',
  'BasslineHero', 'ChillHopGuru', 'AnalogDreamer', 'SolarCadence', 'AuraBeat',
];

function getRandomName() {
  const base = COOL_NAMES[Math.floor(Math.random() * COOL_NAMES.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${base}${num}`;
}

export function ProfileModal({
  visible,
  user,
  currentName,
  onClose,
  onUpdateGuestName,
  onDiscordLogin,
  onSignOut,
  onJoinRoom,
  onPlayTrack,
}: ProfileModalProps) {
  const toast = useToast();
  const player = usePlayer();

  const profileDomain = useUserProfile({
    targetId: 'me',
    initialUser: user,
    initialGuestName: currentName || user?.display_name,
  });

  const {
    playlists,
    recentTracks,
    favoriteRooms,
    likedTracks: favTracks,
    localStats: stats,
    preferences,
    cacheKb,
    loading,
    guestName,
    setGuestName,
    createPlaylist,
    deletePlaylist,
    clearRecent,
    updatePreferences,
    saveImportedPlaylist,
    refresh,
  } = profileDomain;

  const [activeTab, setActiveTab] = useState<TabMode>('history');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [importModalVisible, setImportModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      void refresh();
      if (currentName) setGuestName(currentName);
      else if (user?.display_name) setGuestName(user.display_name);
    }
  }, [visible, user, currentName, refresh, setGuestName]);

  const isDiscord = !!user?.discord_id || !!user?.is_registered;

  const handleRollName = () => {
    const rolled = getRandomName();
    setGuestName(rolled);
  };

  const handleSaveGuestName = () => {
    const clean = guestName.trim();
    if (!clean) return;
    onUpdateGuestName(clean);
    toast(`Name updated to "${clean}"`, 'success');
  };

  const handleClearHistory = async () => {
    await clearRecent();
  };

  const handleCreatePlaylist = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    const created = await createPlaylist(trimmed);
    if (created) {
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    await deletePlaylist(id);
  };

  const handlePlayPlaylistDirect = async (pl: any) => {
    void hapticMedium();
    if (Array.isArray(pl.tracks) && pl.tracks.length > 0) {
      const mapped = pl.tracks.map((t: any) => ({
        track_uri: t.track_uri || t.uri,
        track_name: t.track_name || t.name,
        artist: t.artist || 'Unknown Artist',
        album_art_url: t.album_art_url,
        duration_ms: t.duration_ms,
      }));
      player.setPlayerModalOpen(true);
      void player.playTrack(mapped[0], mapped, { sourceTitle: pl.name });
      toast(`Playing "${pl.name}"`, 'success');
      onClose();
      return;
    }

    toast(`Opening "${pl.name}"…`, 'info');
    player.setPlayerModalOpen(true);
    onClose();
    try {
      const detail = await getPlaylist(pl.id);
      if (detail && detail.tracks && detail.tracks.length > 0) {
        const mapped = detail.tracks.map((t) => ({
          track_uri: t.track_uri,
          track_name: t.track_name,
          artist: t.artist || 'Unknown Artist',
          album_art_url: t.album_art_url,
          duration_ms: t.duration_ms,
        }));
        void player.playTrack(mapped[0], mapped, { sourceTitle: pl.name });
      } else {
        toast('Playlist is empty or has no playable tracks', 'info');
      }
    } catch {
      toast('Could not start playlist playback', 'error');
    }
  };

  const handlePlayFavTrack = (track: TrackInfo) => {
    void hapticLight();
    if (onPlayTrack) {
      onPlayTrack({ ...track, playedAt: Date.now() }, favTracks, { sourceTitle: 'Liked Songs' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(track, favTracks, { sourceTitle: 'Liked Songs' });
    }
    toast(`Playing "${track.track_name}"`, 'success');
    onClose();
  };

  const handlePlayAllFavTracks = () => {
    if (favTracks.length === 0) return;
    void hapticMedium();
    if (onPlayTrack) {
      onPlayTrack({ ...favTracks[0], playedAt: Date.now() }, favTracks, { sourceTitle: 'Liked Songs' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(favTracks[0], favTracks, { sourceTitle: 'Liked Songs' });
    }
    toast('Playing Liked Songs', 'success');
    onClose();
  };

  const handleShuffleFavTracks = () => {
    if (favTracks.length === 0) return;
    void hapticMedium();
    const shuffled = shuffleTracks(favTracks);
    if (onPlayTrack) {
      onPlayTrack({ ...shuffled[0], playedAt: Date.now() }, shuffled, { sourceTitle: 'Liked Songs (Shuffle)' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(shuffled[0], shuffled, { sourceTitle: 'Liked Songs (Shuffle)' });
    }
    toast('Shuffling Liked Songs', 'success');
    onClose();
  };

  const handlePlayRecentTrack = (track: PlayedTrack) => {
    void hapticLight();
    if (onPlayTrack) {
      onPlayTrack(track, recentTracks, { sourceTitle: 'Recently Played' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(track, recentTracks, { sourceTitle: 'Recently Played' });
    }
    toast(`Playing "${track.track_name}"`, 'success');
    onClose();
  };

  const handlePlayAllRecentTracks = () => {
    if (recentTracks.length === 0) return;
    void hapticMedium();
    if (onPlayTrack) {
      onPlayTrack(recentTracks[0], recentTracks, { sourceTitle: 'Recently Played' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(recentTracks[0], recentTracks, { sourceTitle: 'Recently Played' });
    }
    toast('Playing Recently Played', 'success');
    onClose();
  };

  const handleShuffleRecentTracks = () => {
    if (recentTracks.length === 0) return;
    void hapticMedium();
    const shuffled = shuffleTracks(recentTracks);
    if (onPlayTrack) {
      onPlayTrack(shuffled[0], shuffled, { sourceTitle: 'Recently Played (Shuffle)' });
    } else {
      player.setPlayerModalOpen(true);
      void player.playTrack(shuffled[0], shuffled, { sourceTitle: 'Recently Played (Shuffle)' });
    }
    toast('Shuffling Recently Played', 'success');
    onClose();
  };

  const handleSharePlaylist = async (p: OfflinePlaylist) => {
    try {
      const summary =
        p.tracks.length > 0
          ? p.tracks.map((t, idx) => `${idx + 1}. ${t.track_name} – ${t.artist}`).join('\n')
          : 'Empty playlist';
      await Share.share({
        title: `OpenJam Playlist: ${p.name}`,
        message: `🎶 OpenJam Playlist: ${p.name} (${p.tracks.length} tracks)\n\n${summary}\n\nListen together on https://www.openjam.fun`,
      });
    } catch {}
  };

  const handleToggleHaptics = async (value: boolean) => {
    await updatePreferences({ hapticEnabled: value });
    if (value) void hapticMedium();
  };

  const handleOpenAndroidSettings = () => {
    void Linking.openSettings();
  };

  const handleConfirmClearHistory = () => {
    Alert.alert(
      'Clear Listening History',
      'Are you sure you want to clear your recently played tracks? Your saved playlists and pinned stations will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            await clearRecent();
          },
        },
      ],
    );
  };

  const handleImportPlaylistSuccess = async (name: string, tracks: TrackInfo[]) => {
    await saveImportedPlaylist(name, tracks);
  };

  const handleToggleQuality = async (value: boolean) => {
    await updatePreferences({
      audioQuality: value ? 'high' : 'saver',
    });
  };

  // Avatar colors
  let hue = 0;
  const nameToHash = user?.display_name || guestName || 'Jammer';
  for (let i = 0; i < nameToHash.length; i++) {
    hue = nameToHash.charCodeAt(i) + ((hue << 5) - hue);
  }
  const avatarBg = `hsl(${Math.abs(hue) % 360}, 65%, 48%)`;
  const initials = (nameToHash.trim() || '?').slice(0, 2).toUpperCase();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 20) + 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheetContainer, { paddingBottom: bottomPad }]}>
          {/* Top Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <Text style={styles.sheetTitle}>Profile & Storage</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <X size={18} color={colors.text2} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* User Identity Card */}
            <View style={styles.identityCard}>
              <View style={styles.avatarRow}>
                {user?.avatar_url ? (
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
                    <View style={styles.onlineDot} />
                  </View>
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: avatarBg }]}>
                    <Text style={styles.avatarInitials}>{initials}</Text>
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: isDiscord ? colors.green : colors.amber },
                      ]}
                    />
                  </View>
                )}

                <View style={styles.identityDetails}>
                  {!isEditingName ? (
                    <View style={styles.nameHeaderRow}>
                      <Text style={styles.displayNameText} numberOfLines={1}>
                        {user?.display_name || guestName}
                      </Text>
                      {!isDiscord ? (
                        <Pressable
                          onPress={() => setIsEditingName(true)}
                          style={styles.editPencilBtn}
                          hitSlop={8}
                          accessibilityLabel="Edit display name"
                        >
                          <Pencil size={13} color={colors.text2} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.inlineEditRow}>
                      <TextInput
                        value={guestName}
                        onChangeText={setGuestName}
                        placeholder="Enter name"
                        placeholderTextColor={colors.text3}
                        style={styles.inlineEditInput}
                        maxLength={24}
                        autoFocus
                      />
                      <Pressable onPress={handleRollName} style={styles.inlineRollBtn} hitSlop={6}>
                        <Shuffle size={13} color={colors.amber} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          handleSaveGuestName();
                          setIsEditingName(false);
                        }}
                        style={({ pressed }) => [styles.inlineSaveBtn, pressed && styles.pressed]}
                        hitSlop={6}
                      >
                        <Check size={13} color="#08080a" strokeWidth={3} />
                      </Pressable>
                    </View>
                  )}

                  {isDiscord && user?.discord_username ? (
                    <Text style={styles.discordHandle}>@{user.discord_username}</Text>
                  ) : null}

                  <View style={styles.badgeRow}>
                    {isDiscord ? (
                      <View style={styles.verifiedBadge}>
                        <Sparkles size={11} color="#5865F2" />
                        <Text style={styles.verifiedBadgeText}>Discord Verified</Text>
                      </View>
                    ) : (
                      <View style={styles.guestBadge}>
                        <Radio size={11} color={colors.amber} />
                        <Text style={styles.guestBadgeText}>Guest Session</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Elevated Discord Connect for Guests */}
              {!isDiscord && onDiscordLogin ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    onDiscordLogin();
                  }}
                  style={({ pressed }) => [styles.heroDiscordCta, pressed && styles.pressed]}
                  accessibilityLabel="Sign in with Discord"
                >
                  <LogIn size={15} color="#ffffff" strokeWidth={2.4} />
                  <Text style={styles.heroDiscordCtaText}>Connect Discord Account</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/profile/[id]', params: { id: user?.id || 'me' } });
                }}
                style={({ pressed }) => [styles.viewPublicProfileBtn, pressed && styles.pressed]}
              >
                <Text style={styles.viewPublicProfileText}>Open Full Profile & Library</Text>
                <ChevronRight size={14} color={colors.amber} />
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  router.push('/offline');
                }}
                style={({ pressed }) => [styles.offlineVaultCtaBtn, pressed && styles.pressed]}
                accessibilityLabel="Open Offline Audio Vault"
              >
                <View style={styles.offlineVaultCtaLeft}>
                  <HardDrive size={14} color={colors.amber} />
                  <Text style={styles.offlineVaultCtaText}>Offline Audio Vault</Text>
                </View>
                <View style={styles.offlineVaultCtaRight}>
                  <Text style={styles.offlineVaultCtaBadge}>Ready Offline</Text>
                  <ChevronRight size={13} color={colors.text3} />
                </View>
              </Pressable>
            </View>

            {/* Borderless Listening Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber} numberOfLines={1}>
                  {Math.max(stats.totalTracksJammed, recentTracks.length)}
                </Text>
                <Text style={styles.statLabel}>TRACKS</Text>
              </View>

              <View style={styles.statSeparator} />

              <View style={styles.statItem}>
                <Text style={styles.statNumber} numberOfLines={1}>
                  {(() => {
                    const effectiveMinutes =
                      stats.totalMinutesJammed > 0
                        ? stats.totalMinutesJammed
                        : Math.round(recentTracks.length * 3.5);
                    return effectiveMinutes > 999
                      ? `${(effectiveMinutes / 1000).toFixed(1)}k`
                      : `${effectiveMinutes}m`;
                  })()}
                </Text>
                <Text style={styles.statLabel}>LISTENED</Text>
              </View>

              <View style={styles.statSeparator} />

              <View style={styles.statItem}>
                <Text style={styles.statNumber} numberOfLines={1}>
                  {stats.roomsVisited.length}
                </Text>
                <Text style={styles.statLabel}>ROOMS</Text>
              </View>
            </View>

            {/* Segmented Tab Navigation */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => setActiveTab('history')}
                style={[styles.tabItem, activeTab === 'history' && styles.tabItemActive]}
              >
                <Clock size={12} color={activeTab === 'history' ? colors.amber : colors.text3} />
                <Text style={[styles.tabItemText, activeTab === 'history' && styles.tabItemTextActive]}>
                  Recent
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('playlists')}
                style={[styles.tabItem, activeTab === 'playlists' && styles.tabItemActive]}
              >
                <ListMusic size={12} color={activeTab === 'playlists' ? colors.amber : colors.text3} />
                <Text style={[styles.tabItemText, activeTab === 'playlists' && styles.tabItemTextActive]}>
                  Playlists ({playlists.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('favorites')}
                style={[styles.tabItem, activeTab === 'favorites' && styles.tabItemActive]}
              >
                <Bookmark size={12} color={activeTab === 'favorites' ? colors.amber : colors.text3} />
                <Text style={[styles.tabItemText, activeTab === 'favorites' && styles.tabItemTextActive]}>
                  Stations
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('settings')}
                style={[styles.tabItem, activeTab === 'settings' && styles.tabItemActive]}
              >
                <Sliders size={12} color={activeTab === 'settings' ? colors.amber : colors.text3} />
                <Text style={[styles.tabItemText, activeTab === 'settings' && styles.tabItemTextActive]}>
                  Settings
                </Text>
              </Pressable>
            </View>

            {/* TAB CONTENT */}

            {/* 1. Recently Played */}
            {activeTab === 'history' ? (
              <View style={styles.tabContentSection}>
                <View style={styles.contentHeaderRow}>
                  <Text style={styles.contentSectionTitle}>RECENTLY PLAYED TRACKS</Text>
                  {recentTracks.length > 0 ? (
                    <View style={styles.headerPillsRow}>
                      <Pressable
                        onPress={handlePlayAllRecentTracks}
                        style={({ pressed }) => [styles.headerPillBtn, pressed && styles.pressed]}
                        hitSlop={6}
                        accessibilityLabel="Play all recently played tracks"
                      >
                        <Play size={10} color="#08080a" fill="#08080a" />
                        <Text style={styles.headerPillBtnText}>Play All</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleShuffleRecentTracks}
                        style={({ pressed }) => [styles.headerPillOutlineBtn, pressed && styles.pressed]}
                        hitSlop={6}
                        accessibilityLabel="Shuffle recently played tracks"
                      >
                        <Shuffle size={10} color={colors.amber} />
                        <Text style={styles.headerPillOutlineText}>Shuffle</Text>
                      </Pressable>
                      <Pressable onPress={handleClearHistory} hitSlop={6} style={styles.clearLink}>
                        <Trash2 size={12} color={colors.red} />
                        <Text style={styles.clearLinkText}>Clear</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {recentTracks.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Music size={32} color={colors.text3} opacity={0.4} />
                    <Text style={styles.emptyTitle}>No songs played yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Tracks you jam to in community rooms are remembered here.
                    </Text>
                  </View>
                ) : (
                  recentTracks.map((item, idx) => (
                    <Pressable
                      key={`${item.track_uri}-${idx}`}
                      onPress={() => handlePlayRecentTrack(item)}
                      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                      accessibilityLabel={`Play ${item.track_name} by ${item.artist}`}
                    >
                      {item.album_art_url ? (
                        <Image source={{ uri: item.album_art_url }} style={styles.historyArt} />
                      ) : (
                        <View style={[styles.historyArt, styles.artFallback]}>
                          <Music size={14} color={colors.amber} />
                        </View>
                      )}

                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTrackName} numberOfLines={1}>
                          {item.track_name}
                        </Text>
                        <Text style={styles.historyArtist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {item.roomName ? `${item.roomName} • ` : ''}
                          {formatRelativeTime(item.playedAt)}
                        </Text>
                      </View>

                      <View style={styles.quickActionBtn}>
                        <Play size={12} color={colors.amber} fill={colors.amber} />
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {/* 2. Playlists & Library */}
            {activeTab === 'playlists' ? (
              <View style={styles.tabContentSection}>
                <View style={styles.contentHeaderRow}>
                  <Text style={styles.contentSectionTitle}>OFFLINE PLAYLISTS & LIBRARY</Text>
                  {!isCreatingPlaylist ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Pressable
                        onPress={() => setImportModalVisible(true)}
                        hitSlop={6}
                        style={styles.newPlaylistBtn}
                        accessibilityLabel="Import playlist from Spotify or YouTube"
                      >
                        <DownloadCloud size={12} color={colors.amber} />
                        <Text style={styles.newPlaylistBtnText}>Import</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setIsCreatingPlaylist(true)}
                        hitSlop={6}
                        style={styles.newPlaylistBtn}
                        accessibilityLabel="Create new offline playlist"
                      >
                        <Plus size={12} color={colors.amber} />
                        <Text style={styles.newPlaylistBtnText}>New</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {/* Offline Awareness Banner */}
                <View style={styles.offlineBanner}>
                  <Sparkles size={14} color={colors.amber} />
                  <Text style={styles.offlineBannerText}>
                    Playlists and favorite tracks are saved locally in phone storage. Live music streams seamlessly whenever connected to the internet.
                  </Text>
                </View>

                {/* Inline New Playlist Form */}
                {isCreatingPlaylist ? (
                  <View style={styles.newPlaylistForm}>
                    <TextInput
                      value={newPlaylistName}
                      onChangeText={setNewPlaylistName}
                      placeholder="Playlist name (e.g. Chill Beats)"
                      placeholderTextColor={colors.text3}
                      style={styles.newPlaylistInput}
                      maxLength={32}
                      autoFocus
                    />
                    <Pressable
                      onPress={handleCreatePlaylist}
                      style={({ pressed }) => [styles.createPlaylistBtn, pressed && styles.pressed]}
                    >
                      <Check size={14} color="#08080a" strokeWidth={3} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setIsCreatingPlaylist(false);
                        setNewPlaylistName('');
                      }}
                      style={styles.cancelPlaylistBtn}
                    >
                      <X size={14} color={colors.text2} />
                    </Pressable>
                  </View>
                ) : null}

                {/* Playlists List */}
                {playlists.length === 0 ? (
                  <View style={styles.emptyState}>
                    <ListMusic size={32} color={colors.text3} opacity={0.4} />
                    <Text style={styles.emptyTitle}>No saved playlists yet</Text>
                    <Text style={styles.emptySubtitle}>
                      Create custom playlists to save your favorite jams for quick listening.
                    </Text>
                  </View>
                ) : (
                  playlists.map((pl) => {
                    const trackCount = (pl as any).track_count ?? (pl as any).tracks_count ?? (pl.tracks || []).length;
                    return (
                      <Pressable
                        key={pl.id}
                        onPress={() => {
                          onClose();
                          router.push({ pathname: '/playlist/[id]', params: { id: pl.id } });
                        }}
                        style={({ pressed }) => [styles.playlistCard, pressed && styles.pressed]}
                      >
                        <View style={styles.playlistCardHeader}>
                          <View style={styles.playlistIconBox}>
                            <ListMusic size={16} color={colors.amber} />
                          </View>
                          <View style={styles.playlistMeta}>
                            <Text style={styles.playlistName} numberOfLines={1}>
                              {pl.name}
                            </Text>
                            <Text style={styles.playlistSub}>
                              {trackCount} track{trackCount === 1 ? '' : 's'} · Tap to open
                            </Text>
                          </View>
                          <View style={styles.playlistActions}>
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                void handlePlayPlaylistDirect(pl);
                              }}
                              hitSlop={8}
                              style={styles.playlistPlayBtn}
                              accessibilityLabel={`Play playlist ${pl.name}`}
                            >
                              <Play size={12} color="#08080a" fill="#08080a" />
                            </Pressable>
                            <Pressable
                              onPress={() => handleSharePlaylist(pl)}
                              hitSlop={8}
                              style={styles.playlistActionBtn}
                              accessibilityLabel="Share playlist"
                            >
                              <Share2 size={13} color={colors.text2} />
                            </Pressable>
                            <Pressable
                              onPress={() => handleDeletePlaylist(pl.id, pl.name)}
                              hitSlop={8}
                              style={styles.playlistActionBtn}
                              accessibilityLabel="Delete playlist"
                            >
                              <Trash2 size={13} color={colors.red} />
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })
                )}

                {/* Liked Tracks Section */}
                <View style={[styles.contentHeaderRow, { marginTop: spacing.md }]}>
                  <Text style={styles.contentSectionTitle}>
                    FAVORITE TRACKS ({favTracks.length})
                  </Text>
                  {favTracks.length > 0 ? (
                    <View style={styles.headerPillsRow}>
                      <Pressable
                        onPress={handlePlayAllFavTracks}
                        style={({ pressed }) => [styles.headerPillBtn, pressed && styles.pressed]}
                        hitSlop={6}
                        accessibilityLabel="Play all favorite tracks"
                      >
                        <Play size={10} color="#08080a" fill="#08080a" />
                        <Text style={styles.headerPillBtnText}>Play All</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleShuffleFavTracks}
                        style={({ pressed }) => [styles.headerPillOutlineBtn, pressed && styles.pressed]}
                        hitSlop={6}
                        accessibilityLabel="Shuffle favorite tracks"
                      >
                        <Shuffle size={10} color={colors.amber} />
                        <Text style={styles.headerPillOutlineText}>Shuffle</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                {favTracks.length === 0 ? (
                  <View style={[styles.emptyState, { paddingVertical: 18 }]}>
                    <Heart size={24} color={colors.text3} opacity={0.4} />
                    <Text style={styles.emptySubtitle}>
                      Tap heart on any song to save it to your library.
                    </Text>
                  </View>
                ) : (
                  favTracks.map((t, idx) => (
                    <Pressable
                      key={`${t.track_uri}-${idx}`}
                      onPress={() => handlePlayFavTrack(t)}
                      style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                      accessibilityLabel={`Play ${t.track_name} by ${t.artist || 'Unknown Artist'}`}
                    >
                      {t.album_art_url ? (
                        <Image source={{ uri: t.album_art_url }} style={styles.historyArt} />
                      ) : (
                        <View style={[styles.historyArt, styles.artFallback]}>
                          <Music size={16} color={colors.amber} />
                        </View>
                      )}
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTrackName} numberOfLines={1}>
                          {t.track_name}
                        </Text>
                        <Text style={styles.historyArtist} numberOfLines={1}>
                          {t.artist || 'Unknown Artist'}
                        </Text>
                      </View>
                      <View style={styles.quickActionBtn}>
                        <Play size={12} color={colors.amber} fill={colors.amber} />
                      </View>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {/* 3. Saved / Favorite Rooms */}
            {activeTab === 'favorites' ? (
              <View style={styles.tabContentSection}>
                <View style={styles.contentHeaderRow}>
                  <Text style={styles.contentSectionTitle}>PINNED STATIONS</Text>
                </View>

                {favoriteRooms.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Bookmark size={32} color={colors.text3} opacity={0.4} />
                    <Text style={styles.emptyTitle}>No saved rooms</Text>
                    <Text style={styles.emptySubtitle}>
                      Pin your favorite rooms from the room screen to jump back in anytime!
                    </Text>
                  </View>
                ) : (
                  favoriteRooms.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => {
                        onJoinRoom?.(r.id);
                        onClose();
                      }}
                      style={({ pressed }) => [styles.favRoomRow, pressed && styles.pressed]}
                    >
                      <View style={styles.favRoomLeft}>
                        <View style={styles.favIconBox}>
                          <Radio size={16} color={colors.amber} />
                        </View>
                        <View style={styles.favRoomMeta}>
                          <Text style={styles.favRoomName} numberOfLines={1}>
                            {r.name}
                          </Text>
                          <Text style={styles.favRoomHost} numberOfLines={1}>
                            Host: {r.hostName || 'Community'}
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={16} color={colors.text3} />
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}

            {/* 3. Settings & Preferences */}
            {activeTab === 'settings' ? (
              <View style={styles.tabContentSection}>
                <View style={styles.contentHeaderRow}>
                  <Text style={styles.contentSectionTitle}>APP & PLAYBACK PREFERENCES</Text>
                </View>

                {/* Audio Quality */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>High-Fidelity Audio</Text>
                    <Text style={styles.settingSub}>
                      Stream full 320kbps WebM audio. Disable for Data Saver mode.
                    </Text>
                  </View>
                  <Switch
                    value={preferences.audioQuality === 'high'}
                    onValueChange={handleToggleQuality}
                    trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
                    thumbColor={colors.white}
                  />
                </View>

                {/* Haptic Feedback */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Haptic Touch Feedback</Text>
                    <Text style={styles.settingSub}>
                      Tactile vibrations when scrubbing, reacting, and reordering.
                    </Text>
                  </View>
                  <Switch
                    value={preferences.hapticEnabled ?? true}
                    onValueChange={handleToggleHaptics}
                    trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
                    thumbColor={colors.white}
                  />
                </View>

                {/* Background Service Status */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Background Audio Service</Text>
                    <Text style={styles.settingSub}>
                      Android foreground service keeps music playing when screen is locked.
                    </Text>
                  </View>
                  <View style={styles.settingBadge}>
                    <Headphones size={11} color={colors.amber} />
                    <Text style={styles.settingBadgeText}>Active</Text>
                  </View>
                </View>

                {/* Android System Section */}
                <View style={[styles.contentHeaderRow, { marginTop: spacing.md }]}>
                  <Text style={styles.contentSectionTitle}>ANDROID SYSTEM & STORAGE</Text>
                </View>

                {/* Android OS App Settings */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Android App Settings</Text>
                    <Text style={styles.settingSub}>
                      Manage OS storage, clear system cache, and toggle permissions.
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleOpenAndroidSettings}
                    style={({ pressed }) => [styles.androidSettingsBtn, pressed && styles.pressed]}
                    accessibilityLabel="Open Android system settings for OpenJam"
                  >
                    <Text style={styles.androidSettingsText}>Settings</Text>
                    <ExternalLink size={12} color={colors.amber} />
                  </Pressable>
                </View>

                {/* Listening History Clear */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Listening History</Text>
                    <Text style={styles.settingSub}>
                      {recentTracks.length} tracks recorded. Saved playlists are preserved.
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleConfirmClearHistory}
                    disabled={recentTracks.length === 0}
                    style={({ pressed }) => [
                      styles.clearHistoryBtn,
                      recentTracks.length === 0 && styles.btnDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.clearHistoryText}>Clear</Text>
                  </Pressable>
                </View>

                {/* Account Actions */}
                <View style={styles.authActionBlock}>
                  {isDiscord ? (
                    <Pressable
                      onPress={() => {
                        onSignOut?.();
                        onClose();
                      }}
                      style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
                    >
                      <LogOut size={16} color={colors.red} />
                      <Text style={styles.signOutText}>Sign Out of Discord</Text>
                    </Pressable>
                  ) : onDiscordLogin ? (
                    <Pressable
                      onPress={() => {
                        onClose();
                        onDiscordLogin();
                      }}
                      style={({ pressed }) => [styles.discordLoginCta, pressed && styles.pressed]}
                    >
                      <LogIn size={16} color="#ffffff" />
                      <Text style={styles.discordLoginCtaText}>Sign in with Discord</Text>
                    </Pressable>
                  ) : null}
                </View>

                {/* Legal & Compliance Links */}
                <View style={styles.legalLinksBlock}>
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push('/legal/privacy');
                    }}
                    style={({ pressed }) => [styles.legalLinkRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.legalLinkText}>Privacy Policy</Text>
                    <ChevronRight size={14} color={colors.text3} />
                  </Pressable>
                  <View style={styles.legalDivider} />
                  <Pressable
                    onPress={() => {
                      onClose();
                      router.push('/legal/terms');
                    }}
                    style={({ pressed }) => [styles.legalLinkRow, pressed && styles.pressed]}
                  >
                    <Text style={styles.legalLinkText}>Terms of Service</Text>
                    <ChevronRight size={14} color={colors.text3} />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <ImportPlaylistModal
        visible={importModalVisible}
        mode="save"
        onClose={() => setImportModalVisible(false)}
        onSaveToPlaylists={handleImportPlaylistSuccess}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0c0c12',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.text1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  scrollBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  // User Identity Card
  identityCard: {
    backgroundColor: 'rgba(24, 24, 34, 0.85)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.md,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImg: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: '#0d0d14',
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    color: '#ffffff',
  },
  identityDetails: {
    flex: 1,
  },
  displayNameText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.text1,
  },
  discordHandle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(88, 101, 242, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.35)',
  },
  verifiedBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#5865F2',
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
  },
  guestBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  nameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editPencilBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  inlineEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  inlineEditInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text1,
    minWidth: 0,
  },
  inlineRollBtn: {
    padding: 7,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderRadius: radius.md,
  },
  inlineSaveBtn: {
    padding: 7,
    backgroundColor: colors.amber,
    borderRadius: radius.md,
  },
  heroDiscordCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5865F2',
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: 14,
  },
  heroDiscordCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  // Borderless Stats Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    color: colors.text1,
  },
  statLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: colors.text3,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  statSeparator: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
  },
  tabItemText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text3,
  },
  tabItemTextActive: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
  },
  // Tab content
  tabContentSection: {
    marginBottom: spacing.lg,
  },
  contentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  contentSectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 0.8,
  },
  clearLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  clearLinkText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.red,
  },
  headerPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  headerPillBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#08080a',
  },
  headerPillOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  headerPillOutlineText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: colors.text2,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  // History Row
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 8,
    marginBottom: 6,
  },
  historyArt: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 10,
  },
  artFallback: {
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
  },
  historyTrackName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.text1,
  },
  historyArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  historyMeta: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.text3,
    opacity: 0.7,
    marginTop: 2,
  },
  quickActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  // Favorite Room Row
  favRoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  favRoomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  favIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favRoomMeta: {
    flex: 1,
  },
  favRoomName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.text1,
  },
  favRoomHost: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  // Settings
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  settingInfo: {
    flex: 1,
    marginRight: 10,
  },
  settingTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.text1,
  },
  settingSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
  },
  settingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  settingBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: colors.amber,
  },
  androidSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  androidSettingsText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  clearHistoryBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  clearHistoryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.red,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  // Auth action
  authActionBlock: {
    marginTop: spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  signOutText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.red,
  },
  discordLoginCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#5865F2',
    borderRadius: radius.md,
  },
  discordLoginCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
  },
  newPlaylistBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.2)',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: spacing.sm,
  },
  offlineBannerText: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text2,
    lineHeight: 15,
  },
  newPlaylistForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  newPlaylistInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text1,
    minWidth: 0,
  },
  createPlaylistBtn: {
    padding: 8,
    backgroundColor: colors.amber,
    borderRadius: radius.md,
  },
  cancelPlaylistBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
  },
  playlistCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  playlistCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playlistIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMeta: {
    flex: 1,
  },
  playlistName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.text1,
  },
  playlistSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  playlistActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playlistActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  playlistPlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewPublicProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.2)',
  },
  viewPublicProfileText: {
    color: colors.amber,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 12,
  },
  offlineVaultCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  offlineVaultCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineVaultCtaText: {
    color: '#ffffff',
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 12,
  },
  offlineVaultCtaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineVaultCtaBadge: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
  },
  legalLinksBlock: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  legalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  legalLinkText: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
  },
  legalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
