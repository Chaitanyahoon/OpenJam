/**
 * Profile Suite — Full native profile, listening stats, recently played history,
 * favorite rooms, and local storage cache manager.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import type { ApiUser, RoomSummary } from '../api';
import type { TrackInfo } from '../sync/protocol';
import {
  getRecentlyPlayed,
  getFavoriteRooms,
  getListeningStats,
  getAppPreferences,
  updateAppPreferences,
  calculateStorageUsageKb,
  clearAllLocalCache,
  clearRecentlyPlayed,
  getOfflinePlaylists,
  saveOfflinePlaylist,
  deleteOfflinePlaylist,
  getFavoriteTracks,
  type OfflinePlaylist,
  type PlayedTrack,
  type FavoriteRoom,
  type ListeningStats,
  type AppPreferences,
} from '../storage/history';
import { useToast } from './ToastContext';

interface ProfileModalProps {
  visible: boolean;
  user: ApiUser | null;
  currentName?: string;
  onClose: () => void;
  onUpdateGuestName: (newName: string) => void;
  onDiscordLogin?: () => void;
  onSignOut?: () => void;
  onJoinRoom?: (roomId: string) => void;
  onPlayTrack?: (track: PlayedTrack) => void;
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

  const [activeTab, setActiveTab] = useState<TabMode>('history');
  const [guestName, setGuestName] = useState(currentName || user?.display_name || 'Jammer');
  const [isEditingName, setIsEditingName] = useState(false);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [playlists, setPlaylists] = useState<OfflinePlaylist[]>([]);
  const [favTracks, setFavTracks] = useState<TrackInfo[]>([]);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [stats, setStats] = useState<ListeningStats>({
    totalTracksJammed: 0,
    totalMinutesJammed: 0,
    roomsVisited: [],
  });
  const [preferences, setPreferences] = useState<AppPreferences>({
    audioQuality: 'high',
    hapticEnabled: true,
  });
  const [cacheKb, setCacheKb] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recents, favs, st, prefs, usage, plists, liked] = await Promise.all([
        getRecentlyPlayed(),
        getFavoriteRooms(),
        getListeningStats(),
        getAppPreferences(),
        calculateStorageUsageKb(),
        getOfflinePlaylists(),
        getFavoriteTracks(),
      ]);
      setRecentTracks(recents);
      setFavoriteRooms(favs);
      setStats(st);
      setPreferences(prefs);
      setCacheKb(usage);
      setPlaylists(plists);
      setFavTracks(liked);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadData();
      if (currentName) setGuestName(currentName);
      else if (user?.display_name) setGuestName(user.display_name);
    }
  }, [visible, user, currentName]);

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
    await clearRecentlyPlayed();
    setRecentTracks([]);
    setCacheKb(await calculateStorageUsageKb());
    toast('Listening history cleared', 'info');
  };

  const handleCreatePlaylist = async () => {
    const trimmed = newPlaylistName.trim();
    if (!trimmed) return;
    try {
      const created = await saveOfflinePlaylist(trimmed);
      setPlaylists((prev) => [created, ...prev]);
      setNewPlaylistName('');
      setIsCreatingPlaylist(false);
      setCacheKb(await calculateStorageUsageKb());
      toast(`Created playlist "${trimmed}"`, 'success');
    } catch {
      toast('Could not create playlist', 'error');
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    await deleteOfflinePlaylist(id);
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    setCacheKb(await calculateStorageUsageKb());
    toast(`Deleted playlist "${name}"`, 'info');
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

  const handleClearAllStorage = async () => {
    await clearAllLocalCache();
    setRecentTracks([]);
    setFavoriteRooms([]);
    setCacheKb(await calculateStorageUsageKb());
    toast('App local cache cleared', 'success');
  };

  const handleToggleQuality = async (value: boolean) => {
    const updated = await updateAppPreferences({
      audioQuality: value ? 'high' : 'saver',
    });
    setPreferences(updated);
    toast(value ? 'High Fidelity Audio enabled' : 'Data Saver mode enabled', 'info');
  };

  // Avatar colors
  let hue = 0;
  const nameToHash = user?.display_name || guestName || 'Jammer';
  for (let i = 0; i < nameToHash.length; i++) {
    hue = nameToHash.charCodeAt(i) + ((hue << 5) - hue);
  }
  const avatarBg = `hsl(${Math.abs(hue) % 360}, 65%, 48%)`;
  const initials = (nameToHash.trim() || '?').slice(0, 2).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
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
            </View>

            {/* Borderless Listening Stats Strip */}
            <View style={styles.statsStrip}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber} numberOfLines={1}>
                  {stats.totalTracksJammed}
                </Text>
                <Text style={styles.statLabel}>TRACKS</Text>
              </View>

              <View style={styles.statSeparator} />

              <View style={styles.statItem}>
                <Text style={styles.statNumber} numberOfLines={1}>
                  {stats.totalMinutesJammed > 999
                    ? `${(stats.totalMinutesJammed / 1000).toFixed(1)}k`
                    : `${stats.totalMinutesJammed}m`}
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
                    <Pressable onPress={handleClearHistory} hitSlop={6} style={styles.clearLink}>
                      <Trash2 size={12} color={colors.red} />
                      <Text style={styles.clearLinkText}>Clear</Text>
                    </Pressable>
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
                    <View key={`${item.track_uri}-${idx}`} style={styles.historyRow}>
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

                      {onPlayTrack ? (
                        <Pressable
                          onPress={() => {
                            onPlayTrack(item);
                            onClose();
                          }}
                          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.pressed]}
                          hitSlop={6}
                        >
                          <Play size={12} color={colors.amber} fill={colors.amber} />
                        </Pressable>
                      ) : null}
                    </View>
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
                    <Pressable
                      onPress={() => setIsCreatingPlaylist(true)}
                      hitSlop={6}
                      style={styles.newPlaylistBtn}
                    >
                      <Plus size={12} color={colors.amber} />
                      <Text style={styles.newPlaylistBtnText}>New</Text>
                    </Pressable>
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
                  playlists.map((pl) => (
                    <View key={pl.id} style={styles.playlistCard}>
                      <View style={styles.playlistCardHeader}>
                        <View style={styles.playlistIconBox}>
                          <ListMusic size={16} color={colors.amber} />
                        </View>
                        <View style={styles.playlistMeta}>
                          <Text style={styles.playlistName} numberOfLines={1}>
                            {pl.name}
                          </Text>
                          <Text style={styles.playlistSub}>
                            {pl.tracks.length} tracks · Saved locally
                          </Text>
                        </View>
                        <View style={styles.playlistActions}>
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
                    </View>
                  ))
                )}

                {/* Liked Tracks Section */}
                <View style={[styles.contentHeaderRow, { marginTop: spacing.md }]}>
                  <Text style={styles.contentSectionTitle}>
                    FAVORITE TRACKS ({favTracks.length})
                  </Text>
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
                    <View key={`${t.track_uri}-${idx}`} style={styles.historyRow}>
                      <View style={[styles.historyArt, styles.artFallback]}>
                        <Music size={16} color={colors.amber} />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTrackName} numberOfLines={1}>
                          {t.track_name}
                        </Text>
                        <Text style={styles.historyArtist} numberOfLines={1}>
                          {t.artist || 'Unknown Artist'}
                        </Text>
                      </View>
                      {onPlayTrack ? (
                        <Pressable
                          onPress={() => {
                            onPlayTrack({
                              ...t,
                              playedAt: Date.now(),
                            });
                            onClose();
                          }}
                          style={({ pressed }) => [styles.quickActionBtn, pressed && styles.pressed]}
                          hitSlop={6}
                        >
                          <Play size={12} color={colors.amber} fill={colors.amber} />
                        </Pressable>
                      ) : null}
                    </View>
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

            {/* 3. Settings & Cache */}
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
                      Stream full quality WebM audio. Turn off for Data Saver mode.
                    </Text>
                  </View>
                  <Switch
                    value={preferences.audioQuality === 'high'}
                    onValueChange={handleToggleQuality}
                    trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
                    thumbColor={colors.white}
                  />
                </View>

                {/* Local Storage usage */}
                <View style={styles.settingCard}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingTitle}>Local Device Cache</Text>
                    <Text style={styles.settingSub}>
                      Using {cacheKb} KB of offline storage for tracks and room sessions.
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearAllStorage}
                    style={({ pressed }) => [styles.clearCacheBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.clearCacheText}>Clear Cache</Text>
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
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0d0d14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
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
  },
  clearLinkText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.red,
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
  clearCacheBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  clearCacheText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text2,
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
});
