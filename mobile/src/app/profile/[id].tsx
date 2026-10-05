/**
 * Public User Profile Screen.
 *
 * Shows public profile info, bio, listening statistics,
 * followers / following counts with Follow/Unfollow action,
 * and user's public playlists.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  UserPlus,
  UserCheck,
  Disc,
  ListMusic,
  Headphones,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import {
  getPublicProfile,
  getProfileSocial,
  getProfileStats,
  toggleFollowUser,
  getStoredSession,
  type PublicProfile,
  type ApiPlaylist,
  type ProfileSocialStats,
  type ProfileStatsData,
} from '../../api';
import { useToast } from '../../components/ToastContext';
import { hapticLight, hapticMedium } from '../../utils/haptics';

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [social, setSocial] = useState<ProfileSocialStats | null>(null);
  const [stats, setStats] = useState<ProfileStatsData | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const session = await getStoredSession();
      if (session.user && session.user.id === userId) {
        setIsSelf(true);
      }

      // Parallel fetch of public profile, social stats, and listening stats
      const [profData, socData, statsData] = await Promise.all([
        getPublicProfile(userId),
        getProfileSocial(userId),
        getProfileStats(userId),
      ]);

      if (profData) {
        setProfile(profData.user);
        setPlaylists(profData.playlists || []);
      }
      if (socData) {
        setSocial(socData);
        setFollowing(socData.is_following);
      }
      if (statsData) {
        setStats(statsData);
      }
    } catch {
      toast('Failed to load user profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleFollow = async () => {
    if (isSelf || !profile) return;
    void hapticMedium();
    const nextState = !following;
    setFollowing(nextState);
    setFollowLoading(true);

    // Optimistically adjust count
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
      // Revert if failed
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
        data={playlists}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Banner glow */}
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

            {/* Social stats & Follow Button */}
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

              {!isSelf && (
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
              )}
            </View>

            {/* Listening Metrics Card */}
            <View style={styles.metricsCard}>
              <View style={styles.metricItem}>
                <Headphones size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {stats?.total_tracks_listened ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Tracks</Text>
              </View>

              <View style={styles.metricItem}>
                <Clock size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {stats?.total_minutes_listened ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Minutes</Text>
              </View>

              <View style={styles.metricItem}>
                <Disc size={16} color={colors.amber} />
                <Text style={styles.metricValue}>
                  {(stats?.rooms_joined ?? 0) + (stats?.rooms_created ?? 0)}
                </Text>
                <Text style={styles.metricLabel}>Rooms</Text>
              </View>
            </View>

            {/* Playlists section header */}
            <View style={styles.sectionHeader}>
              <ListMusic size={15} color={colors.amber} />
              <Text style={styles.sectionTitle}>PUBLIC PLAYLISTS</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
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
                {(item.tracks || []).length} tracks
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No public playlists created yet</Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    marginLeft: 8,
  },
  followBtnText: {
    color: '#08080a',
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
  },
  followingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  followingBtnText: {
    color: '#ffffff',
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
  },
  metricsCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  metricItem: {
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
  },
  metricLabel: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.text2,
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginHorizontal: spacing.md,
    marginVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    gap: 12,
  },
  playlistIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMeta: {
    flex: 1,
  },
  playlistName: {
    color: colors.text1,
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 14,
  },
  playlistSub: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
  },
});
