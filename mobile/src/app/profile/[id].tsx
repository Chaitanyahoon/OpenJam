/**
 * User Profile & Library Screen.
 *
 * For other users (!isSelf):
 * - Displays public profile info, bio, listening statistics, followers / following,
 *   follow / unfollow action, and public playlists.
 *
 * For self (isSelf):
 * - Complete personal profile & settings hub:
 *   - Playlists: public and offline playlists
 *   - History: recently played tracks with timestamps
 *   - Saved Rooms: pinned rooms with 1-tap join
 *   - Settings: storage cache management, session sign out
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  Share2,
  UserPlus,
  UserCheck,
  Disc,
  ListMusic,
  Headphones,
  Clock,
  Sparkles,
  Bookmark,
  Trash2,
  Sliders,
  LogOut,
  LogIn,
  Radio,
  Music,
  Play,
  Check,
  DownloadCloud,
  Vibrate,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import {
  getPublicProfile,
  getProfileSocial,
  getProfileStats,
  toggleFollowUser,
  getStoredSession,
  clearSession,
  fetchMe,
  getBackendUrl,
  type PublicProfile,
  type ApiPlaylist,
  type ProfileSocialStats,
  type ProfileStatsData,
} from '../../api';
import {
  getRecentlyPlayed,
  getFavoriteRooms,
  getOfflinePlaylists,
  calculateStorageUsageKb,
  clearRecentlyPlayed,
  saveOfflinePlaylist,
  deleteOfflinePlaylist,
  getAppPreferences,
  updateAppPreferences,
  type OfflinePlaylist,
  type PlayedTrack,
  type FavoriteRoom,
  type AppPreferences,
} from '../../storage/history';
import { useToast } from '../../components/ToastContext';
import { updateHapticsPreference, hapticLight, hapticMedium, hapticHeavy } from '../../utils/haptics';
import { ImportPlaylistModal } from '../../components/ImportPlaylistModal';
import type { TrackInfo } from '../../sync/protocol';

type SelfTabMode = 'playlists' | 'history' | 'saved' | 'settings';

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

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [offlinePlaylists, setOfflinePlaylists] = useState<OfflinePlaylist[]>([]);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [social, setSocial] = useState<ProfileSocialStats | null>(null);
  const [stats, setStats] = useState<ProfileStatsData | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [selfTab, setSelfTab] = useState<SelfTabMode>('playlists');
  const [cacheKb, setCacheKb] = useState(0);
  const [preferences, setPreferences] = useState<AppPreferences>({
    audioQuality: 'high',
    hapticEnabled: true,
  });
  const [isDiscordUser, setIsDiscordUser] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getStoredSession();
      const targetId = rawId === 'me' ? session.user?.id : rawId;
      const isMine = rawId === 'me' || (!!session.user && session.user.id === targetId);
      setIsSelf(isMine);

      if (isMine) {
        // Load local personal data in parallel
        const [recents, favs, offPlists, usage, prefs] = await Promise.all([
          getRecentlyPlayed(),
          getFavoriteRooms(),
          getOfflinePlaylists(),
          calculateStorageUsageKb(),
          getAppPreferences(),
        ]);
        setRecentTracks(recents);
        setFavoriteRooms(favs);
        setOfflinePlaylists(offPlists);
        setCacheKb(usage);
        setPreferences(prefs);
        setIsDiscordUser(!!session.user?.discord_id || !!session.user?.is_registered);
      }

      if (targetId) {
        // Fetch server profile
        const [profData, socData, statsData] = await Promise.all([
          getPublicProfile(targetId).catch(() => null),
          getProfileSocial(targetId).catch(() => null),
          getProfileStats(targetId).catch(() => null),
        ]);

        if (profData) {
          setProfile(profData.user);
          setPlaylists(profData.playlists || []);
        } else if (isMine) {
          // Fallback self profile
          setProfile({
            id: targetId,
            display_name: session.user?.display_name || 'Jammer',
            username: session.user?.discord_username || session.user?.display_name || 'jammer',
            bio: 'OpenJam Music Explorer',
            avatar_url: session.user?.avatar_url || null,
          } as PublicProfile);
        }

        if (socData) {
          setSocial(socData);
          setFollowing(socData.is_following);
        }
        if (statsData) {
          setStats(statsData);
        }
      } else if (isMine) {
        // Guest user self profile
        setProfile({
          id: 'guest',
          display_name: 'Guest Jammer',
          username: 'guest',
          bio: 'Listening anonymously on OpenJam',
          avatar_url: null,
        } as PublicProfile);
      }
    } catch {
      toast('Failed to load user profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [rawId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleFollow = async () => {
    if (isSelf || !profile) return;
    void hapticMedium();
    const nextState = !following;
    setFollowing(nextState);
    setFollowLoading(true);

    setSocial((prev) =>
      prev
        ? {
            ...prev,
            followers_count: prev.followers_count + (nextState ? 1 : -1),
            is_following: nextState,
          }
        : null,
    );

    const ok = await toggleFollowUser(profile.id, nextState);
    setFollowLoading(false);
    if (!ok) {
      setFollowing(!nextState);
      setSocial((prev) =>
        prev
          ? {
              ...prev,
              followers_count: prev.followers_count + (nextState ? -1 : 1),
              is_following: !nextState,
            }
          : null,
      );
      toast('Could not update follow status', 'error');
    } else {
      toast(nextState ? `Following @${profile.username || profile.display_name}` : 'Unfollowed', 'info');
    }
  };

  const handleShare = async () => {
    if (!profile) return;
    try {
      void hapticLight();
      await Share.share({
        message: `Check out ${profile.display_name}'s profile on OpenJam!\nhttps://www.openjam.fun/profile/${profile.username || profile.id}`,
        title: `OpenJam – ${profile.display_name}`,
      });
    } catch {}
  };

  const handleToggleAudioQuality = async (value: boolean) => {
    void hapticLight();
    const updated = await updateAppPreferences({
      audioQuality: value ? 'high' : 'saver',
    });
    setPreferences(updated);
    toast(value ? 'High-Fidelity Audio (320kbps) enabled' : 'Data Saver Audio enabled', 'info');
  };

  const handleToggleHaptics = async (value: boolean) => {
    updateHapticsPreference(value);
    const updated = await updateAppPreferences({
      hapticEnabled: value,
    });
    setPreferences(updated);
    if (value) void hapticMedium();
    toast(value ? 'Haptic feedback enabled' : 'Haptic feedback disabled', 'info');
  };

  const handleClearHistory = async () => {
    void hapticLight();
    await clearRecentlyPlayed();
    setRecentTracks([]);
    setCacheKb(await calculateStorageUsageKb());
    toast('Listening history cleared', 'info');
  };

  const handleOpenAndroidSettings = () => {
    void hapticLight();
    void Linking.openSettings();
  };

  const handleDeleteOfflinePlaylist = async (playlistId: string, name: string) => {
    void hapticMedium();
    await deleteOfflinePlaylist(playlistId);
    setOfflinePlaylists((prev) => prev.filter((p) => p.id !== playlistId));
    setCacheKb(await calculateStorageUsageKb());
    toast(`Deleted playlist "${name}"`, 'info');
  };

  const handleSaveImportedPlaylist = async (name: string, tracks: TrackInfo[]) => {
    try {
      void hapticMedium();
      const created = await saveOfflinePlaylist(name, tracks);
      setOfflinePlaylists((prev) => [created, ...prev]);
      setCacheKb(await calculateStorageUsageKb());
      toast(`Imported playlist "${name}" (${tracks.length} tracks)`, 'success');
    } catch {
      toast('Failed to save imported playlist', 'error');
    }
  };

  const handleDiscordLogin = async () => {
    try {
      void hapticMedium();
      const backendUrl = getBackendUrl();
      const redirectScheme = Linking.createURL('/');
      const authUrl = `${backendUrl}/auth/discord?state=${encodeURIComponent(redirectScheme)}`;
      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectScheme);
      if (res.type === 'success' && res.url) {
        let token = '';
        if (res.url.includes('token=')) {
          const match = res.url.match(/[?&#]token=([a-zA-Z0-9_\-.]+)/);
          if (match) token = match[1];
        }
        if (token) {
          await AsyncStorage.setItem('openjam_token', token);
          const me = await fetchMe();
          if (me) {
            setProfile(me as any);
            setIsDiscordUser(true);
            toast(`Logged in as ${me.display_name}`, 'success');
          }
        }
      }
    } catch {
      toast('Discord authentication failed', 'error');
    }
  };

  const handleSignOut = async () => {
    void hapticHeavy();
    await clearSession();
    toast('Signed out', 'info');
    router.replace('/');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.amber} />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12}>
            <ChevronLeft size={22} color={colors.text1} />
          </Pressable>
        </View>
        <View style={styles.centerLoading}>
          <Text style={styles.errorText}>User profile not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const initials = (profile.display_name || '?').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top Bar */}
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
          {profile.username ? `@${profile.username}` : profile.display_name}
        </Text>

        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={10}
          accessibilityLabel="Share profile"
        >
          <Share2 size={18} color={colors.text2} />
        </Pressable>
      </View>

      <FlatList
        data={
          isSelf
            ? selfTab === 'playlists'
              ? [...playlists, ...offlinePlaylists]
              : selfTab === 'history'
                ? recentTracks
                : selfTab === 'saved'
                  ? favoriteRooms
                  : []
            : playlists
        }
        keyExtractor={(item: any, idx) => item.id || item.track_uri || `item-${idx}`}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            <LinearGradient
              colors={['rgba(255, 159, 28, 0.15)', 'transparent']}
              style={styles.bannerGlow}
            />

            {/* Avatar stage */}
            <View style={styles.avatarWrap}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            {/* Identity info */}
            <Text style={styles.displayName}>{profile.display_name}</Text>
            {profile.username ? (
              <Text style={styles.usernameText}>@{profile.username}</Text>
            ) : null}

            {profile.bio ? <Text style={styles.bioText}>{profile.bio}</Text> : null}

            {/* Social stats & Follow Button (when not self) */}
            <View style={styles.socialRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{social?.followers_count ?? 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{social?.following_count ?? 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>

              {!isSelf ? (
                <Pressable
                  onPress={handleToggleFollow}
                  disabled={followLoading}
                  style={({ pressed }) => [
                    styles.followBtn,
                    following && styles.followingBtn,
                    pressed && styles.pressed,
                  ]}
                >
                  {following ? (
                    <>
                      <UserCheck size={14} color="#ffffff" />
                      <Text style={styles.followingBtnText}>Following</Text>
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} color="#08080a" />
                      <Text style={styles.followBtnText}>Follow</Text>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            {/* Listening Metrics Card */}
            <View style={styles.metricsCard}>
              <View style={styles.metricItem}>
                <Headphones size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {stats?.total_tracks_listened ?? recentTracks.length}
                </Text>
                <Text style={styles.metricLabel}>Tracks</Text>
              </View>

              <View style={styles.metricItem}>
                <Clock size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {stats?.total_minutes_listened ?? Math.round(recentTracks.length * 3.2)}
                </Text>
                <Text style={styles.metricLabel}>Minutes</Text>
              </View>

              <View style={styles.metricItem}>
                <Disc size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {(stats?.rooms_joined ?? 0) + (stats?.rooms_created ?? 0) || favoriteRooms.length}
                </Text>
                <Text style={styles.metricLabel}>Rooms</Text>
              </View>
            </View>

            {/* Self multi-tab selector */}
            {isSelf ? (
              <View style={styles.tabBar}>
                <Pressable
                  onPress={() => setSelfTab('playlists')}
                  style={[styles.tabItem, selfTab === 'playlists' && styles.tabItemActive]}
                >
                  <ListMusic size={13} color={selfTab === 'playlists' ? colors.amber : colors.text3} />
                  <Text style={[styles.tabItemText, selfTab === 'playlists' && styles.tabItemTextActive]}>
                    Playlists
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelfTab('history')}
                  style={[styles.tabItem, selfTab === 'history' && styles.tabItemActive]}
                >
                  <Clock size={13} color={selfTab === 'history' ? colors.amber : colors.text3} />
                  <Text style={[styles.tabItemText, selfTab === 'history' && styles.tabItemTextActive]}>
                    History
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelfTab('saved')}
                  style={[styles.tabItem, selfTab === 'saved' && styles.tabItemActive]}
                >
                  <Bookmark size={13} color={selfTab === 'saved' ? colors.amber : colors.text3} />
                  <Text style={[styles.tabItemText, selfTab === 'saved' && styles.tabItemTextActive]}>
                    Saved
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelfTab('settings')}
                  style={[styles.tabItem, selfTab === 'settings' && styles.tabItemActive]}
                >
                  <Sliders size={13} color={selfTab === 'settings' ? colors.amber : colors.text3} />
                  <Text style={[styles.tabItemText, selfTab === 'settings' && styles.tabItemTextActive]}>
                    Settings
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.sectionHeader}>
                <ListMusic size={15} color={colors.amber} />
                <Text style={styles.sectionTitle}>PUBLIC PLAYLISTS</Text>
              </View>
            )}

            {isSelf && selfTab === 'playlists' ? (
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderTitle}>
                  <ListMusic size={15} color={colors.amber} />
                  <Text style={styles.sectionTitle}>YOUR PLAYLISTS</Text>
                </View>
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    setImportModalVisible(true);
                  }}
                  style={({ pressed }) => [styles.importBtn, pressed && styles.pressed]}
                >
                  <DownloadCloud size={13} color={colors.amber} />
                  <Text style={styles.importBtnText}>Import</Text>
                </Pressable>
              </View>
            ) : null}

            {/* If Settings Tab is active for Self */}
            {isSelf && selfTab === 'settings' ? (
              <View style={styles.settingsContainer}>
                {/* Audio Experience Settings */}
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsCardTitle}>Playback & Audio</Text>

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Headphones size={18} color={colors.amber} style={styles.settingsRowIcon} />
                      <View style={styles.settingsTextCol}>
                        <Text style={styles.settingsRowLabel}>High-Fidelity Audio</Text>
                        <Text style={styles.settingsRowSub}>Stream at 320 kbps when available</Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.audioQuality === 'high'}
                      onValueChange={handleToggleAudioQuality}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.12)', true: colors.amber }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={styles.settingsDivider} />

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Vibrate size={18} color={colors.amber} style={styles.settingsRowIcon} />
                      <View style={styles.settingsTextCol}>
                        <Text style={styles.settingsRowLabel}>Haptic Feedback</Text>
                        <Text style={styles.settingsRowSub}>Tactile vibrations on playback actions</Text>
                      </View>
                    </View>
                    <Switch
                      value={preferences.hapticEnabled}
                      onValueChange={handleToggleHaptics}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.12)', true: colors.amber }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                {/* Android System Settings & Storage */}
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsCardTitle}>System & OS Settings</Text>

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Sliders size={18} color={colors.amber} style={styles.settingsRowIcon} />
                      <View style={styles.settingsTextCol}>
                        <Text style={styles.settingsRowLabel}>Android App Settings</Text>
                        <Text style={styles.settingsRowSub}>
                          Manage system cache, sound access, and notifications in Android
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleOpenAndroidSettings}
                      style={({ pressed }) => [styles.outlineActionBtn, pressed && styles.pressed]}
                    >
                      <ExternalLink size={13} color={colors.amber} />
                      <Text style={styles.outlineActionBtnText}>Open</Text>
                    </Pressable>
                  </View>

                  <View style={styles.settingsDivider} />

                  <View style={styles.settingsRow}>
                    <View style={styles.settingsRowLeft}>
                      <Clock size={18} color={colors.text3} style={styles.settingsRowIcon} />
                      <View style={styles.settingsTextCol}>
                        <Text style={styles.settingsRowLabel}>Clear Listening History</Text>
                        <Text style={styles.settingsRowSub}>Reset recently played tracks list</Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleClearHistory}
                      style={({ pressed }) => [styles.dangerActionBtn, pressed && styles.pressed]}
                    >
                      <Trash2 size={13} color={colors.red} />
                      <Text style={styles.dangerActionBtnText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Account & Session Card */}
                <View style={styles.settingsCard}>
                  <Text style={styles.settingsCardTitle}>Account & Session</Text>

                  {isDiscordUser ? (
                    <View style={styles.accountBadgeRow}>
                      <ShieldCheck size={16} color={colors.green} />
                      <Text style={styles.accountBadgeText}>
                        Linked to Discord (@{profile.username || profile.display_name})
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={handleDiscordLogin}
                      style={({ pressed }) => [styles.discordLoginBtn, pressed && styles.pressed]}
                    >
                      <LogIn size={15} color="#ffffff" />
                      <Text style={styles.discordLoginBtnText}>Connect Discord Account</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={handleSignOut}
                    style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
                  >
                    <LogOut size={15} color="#ffffff" />
                    <Text style={styles.signOutBtnText}>
                      {isDiscordUser ? 'Sign Out & Reset Session' : 'Reset Guest Session'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }: { item: any }) => {
          if (isSelf && selfTab === 'settings') return null;

          // History Row
          if (isSelf && selfTab === 'history') {
            return (
              <View style={styles.historyRow}>
                {item.album_art_url ? (
                  <Image source={{ uri: item.album_art_url }} style={styles.historyArt} contentFit="cover" />
                ) : (
                  <View style={[styles.historyArt, styles.artFallback]}>
                    <Music size={16} color={colors.text3} />
                  </View>
                )}
                <View style={styles.historyMeta}>
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.track_name}
                  </Text>
                  <Text style={styles.historyArtist} numberOfLines={1}>
                    {item.artist}
                  </Text>
                </View>
                {item.played_at ? (
                  <Text style={styles.historyTime}>{formatRelativeTime(item.played_at)}</Text>
                ) : null}
              </View>
            );
          }

          // Saved Rooms Row
          if (isSelf && selfTab === 'saved') {
            return (
              <Pressable
                onPress={() => {
                  void hapticLight();
                  router.push({ pathname: '/room/[id]', params: { id: item.id } });
                }}
                style={({ pressed }) => [styles.savedRoomCard, pressed && styles.pressed]}
              >
                <View style={styles.roomIconWrap}>
                  <Radio size={18} color={colors.amber} />
                </View>
                <View style={styles.roomMeta}>
                  <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.roomHost} numberOfLines={1}>Host: {item.hostName || 'Jammer'}</Text>
                </View>
                <View style={styles.joinPill}>
                  <Text style={styles.joinPillText}>Join</Text>
                </View>
              </Pressable>
            );
          }

          // Playlists Card (default)
          const isOffline = offlinePlaylists.some((p) => p.id === item.id);
          return (
            <Pressable
              onPress={() => {
                void hapticLight();
                router.push({ pathname: '/playlist/[id]', params: { id: item.id } });
              }}
              style={({ pressed }) => [styles.playlistCard, pressed && styles.pressed]}
            >
              <View style={styles.playlistIconWrap}>
                <Disc size={20} color={colors.amber} />
              </View>
              <View style={styles.playlistMeta}>
                <Text style={styles.playlistName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.playlistSub}>
                  {(item.tracks || []).length} tracks{isOffline ? ' • Offline' : ''}
                </Text>
              </View>
              {isSelf && isOffline ? (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    void handleDeleteOfflinePlaylist(item.id, item.name);
                  }}
                  hitSlop={8}
                  style={styles.deletePlaylistBtn}
                  accessibilityLabel="Delete offline playlist"
                >
                  <Trash2 size={15} color={colors.text3} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isSelf && selfTab === 'settings' ? null : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {isSelf && selfTab === 'history'
                  ? 'No listening history recorded yet'
                  : isSelf && selfTab === 'saved'
                    ? 'No saved rooms pinned yet'
                    : 'No playlists created yet'}
              </Text>
            </View>
          )
        }
      />
      <ImportPlaylistModal
        visible={importModalVisible}
        mode="save"
        onClose={() => setImportModalVisible(false)}
        onSaveToPlaylists={handleSaveImportedPlaylist}
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
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
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
  errorText: {
    color: colors.text2,
    fontSize: 15,
    fontFamily: fontFamily.displayBold,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    position: 'relative',
  },
  bannerGlow: {
    ...StyleSheet.absoluteFill,
    height: 140,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.amber,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgSurface,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: '#2a2a3e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#ffffff',
    fontFamily: fontFamily.displayBold,
    fontSize: 28,
  },
  displayName: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    textAlign: 'center',
  },
  usernameText: {
    color: colors.amber,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    marginTop: 2,
  },
  bioText: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.md,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
  statLabel: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    marginLeft: 8,
  },
  followingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  followBtnText: {
    color: '#08080a',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
  },
  followingBtnText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  metricItem: {
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
  metricLabel: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: radius.full,
    padding: 3,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
  },
  tabItemText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text3,
  },
  tabItemTextActive: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.amber,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.amber,
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  playlistIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMeta: {
    flex: 1,
  },
  playlistName: {
    color: colors.text1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
  },
  playlistSub: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    marginBottom: 6,
    gap: 10,
  },
  historyArt: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  artFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMeta: {
    flex: 1,
  },
  historyTitle: {
    color: colors.text1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
  },
  historyArtist: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },
  historyTime: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
  },
  savedRoomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  roomIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomMeta: {
    flex: 1,
  },
  roomName: {
    color: colors.text1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
  },
  roomHost: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },
  joinPill: {
    backgroundColor: colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  joinPillText: {
    color: '#08080a',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  importBtnText: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
  },
  deletePlaylistBtn: {
    padding: 6,
    marginLeft: 6,
  },
  settingsContainer: {
    width: '100%',
    paddingTop: spacing.sm,
    gap: 12,
  },
  settingsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  settingsCardTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  settingsRowIcon: {
    marginRight: 10,
  },
  settingsTextCol: {
    flex: 1,
  },
  settingsRowLabel: {
    color: colors.text1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
  },
  settingsRowSub: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    marginTop: 2,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 8,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  outlineActionBtnText: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  dangerActionBtnText: {
    color: colors.red,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
  },
  accountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  accountBadgeText: {
    color: colors.text1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    flex: 1,
  },
  discordLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5865F2',
    borderRadius: radius.sm,
    paddingVertical: 10,
    marginBottom: spacing.xs,
  },
  discordLoginBtnText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#dc2626',
    borderRadius: radius.sm,
    paddingVertical: 10,
    marginTop: spacing.xs,
  },
  signOutBtnText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
  },
});
