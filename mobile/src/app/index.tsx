/**
 * OpenJam Landing / Home Screen — Section 1 Revamp.
 * - Top Navbar: Left brand logo + typography, Right Discord Auth pill / profile
 * - Discord-First Authentication with WebBrowser OAuth flow
 * - Clean Hero with "Create Room" & "Join with Code"
 * - Live Rooms Search & Genre Filter
 * - Live Community Stations with zero empty state
 * - Cleaned up: Removed trending carousel clutter per user request
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import {
  LogIn,
  Sparkles,
  KeyRound,
  Search,
  X,
  Play,
  Plus,
  Bookmark,
  Radio,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import {
  createRoom,
  clearSession,
  fetchMe,
  getBackendUrl,
  getRooms,
  getStoredSession,
  joinAsGuest,
  saveAuthToken,
  type ApiUser,
  type RoomSummary,
} from '../api';
import { useSocket } from '../state/SocketContext';
import { RoomCard } from '../components/RoomCard';
import {
  CreateRoomModal,
  IdentityModal,
  JoinWithCodeModal,
  RoomPasswordModal,
} from '../components/Modals';
import { ProfileModal } from '../components/ProfileModal';
import { getFavoriteRooms, type FavoriteRoom, type PlayedTrack } from '../storage/history';
import { hapticMedium } from '../utils/haptics';
import { useToast } from '../components/ToastContext';
import { registerPushToken } from '../notifications';
import { PermissionBanner } from '../components/PermissionBanner';

// Complete WebBrowser session if returning from OAuth
WebBrowser.maybeCompleteAuthSession();

const openjamLogo = require('../../assets/images/openjam-logo.png');

const GENRES = ['All', 'Lofi & Chill', 'Synthwave', 'Hip Hop', 'Ambient'];
const SLOGANS = ['In Sync.', 'With Friends.', 'In Real-Time.', 'In Harmony.'];

export default function Landing() {
  const { connect, disconnect } = useSocket();
  const toast = useToast();

  const [user, setUser] = useState<ApiUser | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinWithCode, setShowJoinWithCode] = useState(false);
  const [pwRoom, setPwRoom] = useState<RoomSummary | null>(null);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [ready, setReady] = useState(false);
  const [sloganIndex, setSloganIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Rotating PWA slogan ticker every 2.8s
  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await getFavoriteRooms();
      setFavoriteRooms(favs);
    } catch {}
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch {
      // Handled in api.ts fallback
    }
    await loadFavorites();
  }, [loadFavorites]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites]),
  );

  // Initial session & rooms load (first-launch onboarding)
  useEffect(() => {
    (async () => {
      const session = await getStoredSession();
      if (session.token) {
        // Refresh full user from backend
        const latestUser = await fetchMe();
        setUser(latestUser || session.user);
        await connect();
        registerPushToken().catch(() => {});
      } else {
        // Show onboarding / sign in sheet on initial launch if unauthenticated
        setShowIdentity(true);
      }
      await loadRooms();
      setReady(true);
    })();
  }, [connect, loadRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  }, [loadRooms]);

  // Process incoming OAuth callback URL
  const processAuthUrl = useCallback(
    async (url: string) => {
      let token = '';
      if (url.includes('token=')) {
        const match = url.match(/[?&#]token=([a-zA-Z0-9_\-.]+)/);
        if (match) token = match[1];
      }

      if (token) {
        disconnect();
        const profile = await saveAuthToken(token);
        if (profile) {
          setUser(profile);
          setAuthError(null);
          setShowIdentity(false);
          toast(
            `Welcome, ${profile.discord_username ? '@' + profile.discord_username : profile.display_name}!`,
            'success',
          );
          await connect();
          registerPushToken().catch(() => {});
        } else {
          toast('Signed in via Discord', 'success');
          setShowIdentity(false);
          await connect();
        }
        return true;
      } else if (url.includes('error=')) {
        const errMatch = url.match(/[?&#]error=([a-zA-Z0-9_]+)/);
        const reason = errMatch ? errMatch[1].replace(/_/g, ' ') : 'authorization denied';
        setAuthError(`Discord sign-in was interrupted (${reason}). You can retry or join as a guest.`);
        setShowIdentity(true);
        return false;
      }
      return false;
    },
    [connect, disconnect, toast],
  );

  // Listen for incoming deep links from OAuth redirect
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url && (event.url.includes('token=') || event.url.includes('error='))) {
        void processAuthUrl(event.url);
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    void Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl && (initialUrl.includes('token=') || initialUrl.includes('error='))) {
        void processAuthUrl(initialUrl);
      }
    });
    return () => {
      sub.remove();
    };
  }, [processAuthUrl]);

  // Discord OAuth sign in
  const handleDiscordLogin = async () => {
    try {
      setAuthError(null);
      const backendUrl = getBackendUrl();
      const redirectScheme = Linking.createURL('/');
      const authUrl = `${backendUrl}/auth/discord?state=${encodeURIComponent(redirectScheme)}`;

      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectScheme);

      if (res.type === 'success' && res.url) {
        await processAuthUrl(res.url);
      } else if (res.type === 'cancel' || res.type === 'dismiss') {
        setAuthError('The Discord sign-in window was closed. You can retry or continue as a guest.');
        setShowIdentity(true);
      }
    } catch (err) {
      setAuthError('Could not reach Discord authentication server. Check your connection or continue as a guest.');
      setShowIdentity(true);
    }
  };

  // Guest sign in fallback
  const handleIdentity = async (displayName: string) => {
    try {
      disconnect();
      const { user: u } = await joinAsGuest(displayName);
      setUser(u);
      setShowIdentity(false);
      toast(`Welcome, ${u.display_name}!`, 'success');
      await connect();
      registerPushToken().catch(() => {});
    } catch {
      toast('Could not create guest session', 'error');
    }
  };

  // Sign out
  const handleSignOut = async () => {
    disconnect();
    await clearSession();
    setUser(null);
    toast('Signed out', 'info');
  };

  // Guest sign in / update name from ProfileModal
  const handleUpdateGuestName = async (displayName: string) => {
    try {
      disconnect();
      const { user: u } = await joinAsGuest(displayName);
      setUser(u);
      toast(`Name updated to "${u.display_name}"`, 'success');
      await connect();
      registerPushToken().catch(() => {});
    } catch {
      toast('Could not update guest profile', 'error');
    }
  };

  const handleProfileJoinRoom = (roomId: string) => {
    setShowProfile(false);
    openRoom({ id: roomId });
  };

  const handleProfilePlayTrack = (track: PlayedTrack) => {
    setShowProfile(false);
    if (track.roomId) {
      openRoom({ id: track.roomId });
    } else {
      openRoom({ id: 'openjam-lounge' });
    }
  };

  const openRoom = (room: RoomSummary | { id: string; name?: string }, password = '') => {
    router.push({
      pathname: '/room/[id]',
      params: {
        id: room.id,
        name: 'name' in room && room.name ? room.name : '',
        ...(password ? { password } : {}),
      },
    });
  };

  const handleRoomPress = (room: RoomSummary) => {
    if (room.is_private) setPwRoom(room);
    else openRoom(room);
  };

  const handleJoinWithCode = (rawCode: string) => {
    let clean = rawCode.trim();
    if (!clean) return;
    if (clean.includes('/room/')) {
      const parts = clean.split('/room/');
      clean = parts[1].split('?')[0].split('#')[0];
    }
    setShowJoinWithCode(false);
    openRoom({ id: clean });
  };

  const filteredRooms = useMemo(() => {
    let list = rooms;
    if (selectedGenre !== 'All') {
      const g = selectedGenre.toLowerCase();
      list = list.filter((r) =>
        (r.genre_tags || []).some((tag) => tag.toLowerCase().includes(g)),
      );
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.host_name.toLowerCase().includes(q) ||
        r.now_playing?.track_name?.toLowerCase().includes(q) ||
        r.now_playing?.artist?.toLowerCase().includes(q),
    );
  }, [rooms, searchQuery, selectedGenre]);

  const initials = user ? (user.display_name || '?').slice(0, 2).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Ambient background bloom gradient */}
      <View style={styles.ambientBloom} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255, 159, 28, 0.12)', 'rgba(88, 101, 242, 0.05)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <FlatList
        data={filteredRooms}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Bar Navigation: Left Logo + Wordmark, Right Discord Auth */}
            <View style={styles.navBar}>
              <View style={styles.navLeft}>
                <Image
                  source={openjamLogo}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
                <Text style={styles.brandName}>
                  Open<Text style={styles.brandNameAmber}>Jam</Text>
                </Text>
              </View>

              {user ? (
                <Pressable
                  onPress={() => setShowProfile(true)}
                  style={({ pressed }) => [
                    styles.discordUserChip,
                    !user.discord_id && styles.guestUserChip,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="View profile"
                >
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.discordAvatarMini} />
                  ) : (
                    <View
                      style={[
                        styles.discordAvatarFallback,
                        !user.discord_id && styles.guestAvatarFallback,
                      ]}
                    >
                      <Text
                        style={[
                          styles.userInitialsMini,
                          !user.discord_id && styles.guestInitialsMini,
                        ]}
                      >
                        {initials}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.userName} numberOfLines={1}>
                    {user.discord_username ? `@${user.discord_username}` : user.display_name}
                  </Text>
                  <View
                    style={[
                      styles.discordOnlineDot,
                      !user.discord_id && styles.guestOnlineDot,
                    ]}
                  />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowProfile(true)}
                  style={({ pressed }) => [styles.discordLoginPill, pressed && styles.pressed]}
                  accessibilityLabel="Sign in or join as guest"
                >
                  <LogIn size={15} color="#ffffff" strokeWidth={2.4} />
                  <Text style={styles.discordPillText}>Sign In</Text>
                </Pressable>
              )}
            </View>

            {/* Permission & Sandboxed Storage Onboarding Banner */}
            <PermissionBanner />

            {/* Streamlined Hero Stage */}
            <LinearGradient
              colors={['rgba(24, 24, 34, 0.85)', 'rgba(10, 10, 14, 0.95)']}
              style={styles.heroGlassCard}
            >
              {/* Badge */}
              <View style={styles.versionBadge}>
                <Sparkles size={12} color={colors.amber} />
                <Text style={styles.versionText}>OPEN JAM V2</Text>
              </View>

              {/* Main Title with Animated Slogan Ticker */}
              <Text style={styles.heroTitle}>
                Listen Together.{'\n'}
                <Text style={styles.heroTitleAmber}>{SLOGANS[sloganIndex]}</Text>
              </Text>

              <Text style={styles.heroSubtitle}>
                Create a room or jump into any community jam. High-fidelity audio, synchronized with zero latency.
              </Text>

              {/* Action Buttons: Create Room & Join with Code */}
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => (user ? setShowCreate(true) : setShowProfile(true))}
                  style={({ pressed }) => [styles.instantBtnWrap, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={['#ffb03a', '#ff9f1c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.instantBtn}
                  >
                    <Sparkles size={16} color="#08080a" />
                    <Text style={styles.instantBtnText}>Instant Jam</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => setShowJoinWithCode(true)}
                  style={({ pressed }) => [styles.joinCodeBtn, pressed && styles.pressed]}
                >
                  <KeyRound size={15} color="#ffffff" />
                  <Text style={styles.joinCodeBtnText}>Join with Code</Text>
                </Pressable>
              </View>

              {/* Trust Sub-banner */}
              <View style={styles.trustBanner}>
                <Text style={styles.trustText}>Discord Sync</Text>
                <Text style={styles.trustDot}>•</Text>
                <Text style={styles.trustText}>Free Forever</Text>
                <Text style={styles.trustDot}>•</Text>
                <Text style={styles.trustText}>Zero Latency</Text>
              </View>
            </LinearGradient>

            {/* Pinned Stations Carousel (1-Tap Re-entry) */}
            {favoriteRooms.length > 0 && (
              <View style={styles.pinnedSection}>
                <View style={styles.pinnedHeader}>
                  <View style={styles.pinnedTitleWrap}>
                    <Bookmark size={13} color={colors.amber} fill={colors.amber} />
                    <Text style={styles.pinnedTitle}>PINNED STATIONS</Text>
                    <View style={styles.pinnedCountBadge}>
                      <Text style={styles.pinnedCountText}>{favoriteRooms.length}</Text>
                    </View>
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pinnedScroll}
                >
                  {favoriteRooms.map((fav) => (
                    <Pressable
                      key={fav.id}
                      onPress={() => {
                        void hapticMedium();
                        openRoom({ id: fav.id, name: fav.name });
                      }}
                      style={({ pressed }) => [styles.pinnedCard, pressed && styles.pressed]}
                    >
                      <View style={styles.pinnedCardTop}>
                        <View style={styles.pinnedRadioIconWrap}>
                          <Radio size={13} color={colors.amber} />
                        </View>
                        <View style={styles.pinnedLivePill}>
                          <View style={styles.livePulseDot} />
                          <Text style={styles.pinnedLiveText}>SAVED</Text>
                        </View>
                      </View>

                      <Text style={styles.pinnedCardName} numberOfLines={1}>
                        {fav.name}
                      </Text>

                      <Text style={styles.pinnedCardHost} numberOfLines={1}>
                        {fav.hostName ? `DJ ${fav.hostName}` : 'Community Room'}
                      </Text>

                      <View style={styles.pinnedCardFooter}>
                        <View style={styles.pinnedTuneChip}>
                          <Play size={10} color="#08080a" fill="#08080a" />
                          <Text style={styles.pinnedTuneText}>Tune In</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Live Rooms Section Toolbar & Genre Filter */}
            <View style={styles.roomsToolbar}>
              <View style={styles.toolbarHeader}>
                <View style={styles.liveIndicator}>
                  <View style={styles.livePulseDot} />
                  <Text style={styles.liveHeaderText}>
                    LIVE ROOMS ({filteredRooms.length})
                  </Text>
                </View>
              </View>

              {/* Search Field */}
              <View style={styles.searchWrap}>
                <Search size={16} color={colors.text3} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search rooms, DJs, genres..."
                  placeholderTextColor={colors.text3}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery ? (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                    <X size={15} color={colors.text3} />
                  </Pressable>
                ) : null}
              </View>

              {/* Genre Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genreScroll}
              >
                {GENRES.map((g) => {
                  const active = selectedGenre === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => setSelectedGenre(g)}
                      style={[styles.genreChip, active && styles.genreChipActive]}
                    >
                      {active ? <View style={styles.genreActiveDot} /> : null}
                      <Text style={[styles.genreText, active && styles.genreTextActive]}>
                        {g}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.roomCardWrap}>
            <RoomCard
              room={item}
              onPress={() => handleRoomPress(item)}
              onFavoriteToggle={loadFavorites}
            />
          </View>
        )}
        ListEmptyComponent={
          ready ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.loungeCard}>
              <View style={styles.loungeBadge}>
                <View style={styles.loungeDot} />
                <Text style={styles.loungeBadgeText}>24/7 COMMUNITY STATION</Text>
              </View>
              <Text style={styles.loungeTitle}>OpenJam Live Lounge</Text>
              <Text style={styles.loungeDesc}>
                The official community radio is broadcasting synchronized chill beats right now. Jump straight in or spin up your own live room!
              </Text>
              <View style={styles.loungeActions}>
                <Pressable
                  onPress={() => openRoom({ id: 'openjam-lounge' })}
                  style={({ pressed }) => [styles.loungeTuneBtn, pressed && styles.pressed]}
                >
                  <Play size={13} color="#08080a" fill="#08080a" />
                  <Text style={styles.loungeTuneText}>Tune In (Live Lounge)</Text>
                </Pressable>
                <Pressable
                  onPress={() => (user ? setShowCreate(true) : setShowProfile(true))}
                  style={({ pressed }) => [styles.loungeInstantBtn, pressed && styles.pressed]}
                >
                  <Plus size={14} color="#ffffff" strokeWidth={2.4} />
                  <Text style={styles.loungeInstantText}>Create Room</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : null
        }
      />

      <ProfileModal
        visible={showProfile}
        user={user}
        currentName={user?.display_name}
        onClose={() => setShowProfile(false)}
        onUpdateGuestName={handleUpdateGuestName}
        onDiscordLogin={handleDiscordLogin}
        onSignOut={handleSignOut}
        onJoinRoom={handleProfileJoinRoom}
        onPlayTrack={handleProfilePlayTrack}
      />
      <IdentityModal
        visible={showIdentity}
        user={user}
        currentName={user?.display_name}
        authError={authError}
        onClearError={() => setAuthError(null)}
        onDone={handleIdentity}
        onDiscordLogin={handleDiscordLogin}
        onSignOut={handleSignOut}
        onClose={() => {
          setShowIdentity(false);
          setAuthError(null);
        }}
      />
      <CreateRoomModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(roomId) => {
          setShowCreate(false);
          openRoom({ id: roomId });
        }}
      />
      <JoinWithCodeModal
        visible={showJoinWithCode}
        onClose={() => setShowJoinWithCode(false)}
        onJoin={handleJoinWithCode}
      />
      <RoomPasswordModal
        visible={!!pwRoom}
        roomName={pwRoom?.name ?? ''}
        onClose={() => setPwRoom(null)}
        onSubmit={(password) => {
          const room = pwRoom;
          setPwRoom(null);
          if (room) openRoom(room, password);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08080a',
  },
  ambientBloom: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    zIndex: 0,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl * 1.5,
  },
  headerContainer: {
    paddingBottom: spacing.md,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandNameAmber: {
    color: colors.amber,
  },
  discordLoginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    gap: 6,
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  discordPillIcon: {
    fontSize: 14,
  },
  discordPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  discordUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 7,
    maxWidth: 160,
  },
  discordAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  discordAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  guestUserChip: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  guestAvatarFallback: {
    backgroundColor: colors.amber,
  },
  guestInitialsMini: {
    color: '#08080a',
  },
  guestOnlineDot: {
    backgroundColor: colors.amber,
  },
  userInitialsMini: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#ffffff',
  },
  userName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text1,
  },
  heroGlassCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 8,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
    marginBottom: spacing.sm,
  },
  versionPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  versionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: 2,
    textAlign: 'center',
  },
  heroTitleAmber: {
    color: colors.amber,
  },
  heroSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginTop: 8,
    marginBottom: spacing.lg,
  },
  heroActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantBtnWrap: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  instantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.full,
  },
  instantBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 15,
    color: '#08080a',
    letterSpacing: 0.2,
  },
  joinCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  joinCodeBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ffffff',
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.md,
  },
  trustText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  trustDot: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.25)',
  },
  pinnedSection: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  pinnedTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  pinnedCountBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  pinnedCountText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  pinnedScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  pinnedCard: {
    width: 156,
    backgroundColor: 'rgba(22, 22, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.md,
    padding: 12,
  },
  pinnedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pinnedRadioIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pinnedLiveText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 8,
    color: '#22c55e',
    letterSpacing: 0.5,
  },
  pinnedCardName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#ffffff',
    marginBottom: 2,
  },
  pinnedCardHost: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginBottom: 10,
  },
  pinnedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedTuneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinnedTuneText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#08080a',
  },
  roomsToolbar: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveHeaderText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: spacing.sm,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: '#ffffff',
    paddingVertical: 0,
  },
  clearSearch: {
    fontSize: 12,
    color: colors.text3,
    padding: 4,
  },
  genreScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genreChipActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderColor: colors.amber,
  },
  genreActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
    marginRight: 6,
  },
  genreText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text3,
  },
  genreTextActive: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
  },
  roomCardWrap: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  loungeCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  loungeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  loungeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  loungeBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1,
  },
  loungeTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
  },
  loungeDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  loungeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  loungeTuneBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.amber,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loungeTuneText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#08080a',
  },
  loungeInstantBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  loungeInstantText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});
