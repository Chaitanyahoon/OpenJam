/**
 * OpenJam Landing / Home Screen — Section 1 Revamp.
 * - Top Navbar: Left brand logo + typography, Right Discord Auth pill / profile
 * - Discord-First Authentication with WebBrowser OAuth flow
 * - Clean Hero with "Create Room" & "Join with Code"
 * - Live Rooms Search & Genre Filter
 * - Live Community Stations with zero empty state
 * - Cleaned up: Removed trending carousel clutter per user request
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  HardDrive,
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
import { RoomCardSkeletonList } from '../components/RoomCardSkeleton';
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
import { requestFirstLaunchPermissions } from '../permissions';

// Complete WebBrowser session if returning from OAuth
WebBrowser.maybeCompleteAuthSession();

const openjamLogo = require('../../assets/images/openjam-emblem.png');

const GENRES = ['All', 'Lofi & Chill', 'Synthwave', 'Hip Hop', 'Ambient'];
const SLOGANS = ['In Sync.', 'With Friends.', 'In Real-Time.', 'In Harmony.'];

const GENRE_MAP: Record<string, string[]> = {
  'Lofi & Chill': ['lofi', 'chill', 'beats', 'study', 'relax', 'cafe', 'lounge'],
  'Synthwave': ['synthwave', 'retrowave', '80s', 'electronic', 'synth', 'cyberpunk', 'sunset'],
  'Hip Hop': ['hip-hop', 'hiphop', 'rap', 'trap', 'boom-bap', 'beats', 'r&b'],
  'Ambient': ['ambient', 'drone', 'meditation', 'sleep', 'atmosphere', 'peaceful'],
};

/** Memoized ticker prevents full Landing screen re-renders every 2.8s */
const SloganTicker = React.memo(function SloganTicker() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);
  return <Text style={styles.heroTitleAmber}>{SLOGANS[index]}</Text>;
});

export default function Landing() {
  const { connect, disconnect } = useSocket();
  const toast = useToast();

  const [user, setUser] = useState<ApiUser | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinWithCode, setShowJoinWithCode] = useState(false);
  const [pwRoom, setPwRoom] = useState<RoomSummary | null>(null);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const handledTokensRef = useRef<Set<string>>(new Set());
  const authSuccessRef = useRef(false);
  const insets = useSafeAreaInsets();

  const promptFirstLaunchPermissions = useCallback(() => {
    void requestFirstLaunchPermissions();
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
        promptFirstLaunchPermissions();
      } else {
        // Show onboarding / sign in sheet on initial launch if unauthenticated
        setShowIdentity(true);
      }
      await loadRooms();
      setReady(true);
    })();
  }, [connect, loadRooms, promptFirstLaunchPermissions]);

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
        const match = url.match(/[?&#]token=([^&#]+)/);
        if (match) {
          token = decodeURIComponent(match[1]).replace(/\/+$/, '').trim();
        }
      }

      if (token) {
        authSuccessRef.current = true;
        if (handledTokensRef.current.has(token)) {
          return true;
        }
        handledTokensRef.current.add(token);
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
          promptFirstLaunchPermissions();
        } else {
          toast('Signed in via Discord', 'success');
          setShowIdentity(false);
          await connect();
          promptFirstLaunchPermissions();
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
    [connect, disconnect, toast, promptFirstLaunchPermissions],
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
      authSuccessRef.current = false;
      const backendUrl = getBackendUrl();
      const redirectScheme = Linking.createURL('/');
      const authUrl = `${backendUrl}/auth/discord?state=${encodeURIComponent(redirectScheme)}`;

      const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectScheme);

      if (res.type === 'success' && res.url) {
        await processAuthUrl(res.url);
      } else if (!authSuccessRef.current && (res.type === 'cancel' || res.type === 'dismiss')) {
        setTimeout(async () => {
          if (!authSuccessRef.current) {
            const currentSession = await getStoredSession();
            if (currentSession.token) {
              authSuccessRef.current = true;
              return;
            }
            setAuthError('The Discord sign-in window was closed. You can retry or continue as a guest.');
            setShowIdentity(true);
          }
        }, 500);
      }
    } catch {
      if (!authSuccessRef.current) {
        setAuthError('Could not reach Discord authentication server. Check your connection or continue as a guest.');
        setShowIdentity(true);
      }
    }
  };

  // Guest sign in fallback
  const handleIdentity = async (displayName: string) => {
    try {
      disconnect();
      const { user: u } = await joinAsGuest(displayName);
      setUser(u);
      setShowIdentity(false);
      setAuthError(null);
      toast(`Welcome, ${u.display_name}!`, 'success');
      await connect();
      registerPushToken().catch(() => {});
      promptFirstLaunchPermissions();
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
      toast('Select or start a live room to play this song', 'info');
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
      const targetKeywords = GENRE_MAP[selectedGenre] || [selectedGenre.toLowerCase()];
      list = list.filter((r) => {
        const roomTags = (r.genre_tags || []).map((t) => t.toLowerCase().trim());
        const roomName = (r.name || '').toLowerCase();
        return targetKeywords.some(
          (kw) =>
            roomTags.some((tag) => tag.includes(kw) || kw.includes(tag)) ||
            roomName.includes(kw),
        );
      });
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

  const initials = user
    ? (user.display_name || user.discord_username || '?').slice(0, 2).toUpperCase()
    : '?';

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
        style={styles.flatList}
        contentContainerStyle={[
          styles.scrollContent,
          { flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 20 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
        }
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Top Bar Navigation: Left Logo + Wordmark, Right Vault & Profile */}
            <View style={styles.navBar}>
              <View style={styles.navLeft}>
                <View style={styles.brandLogoWrap}>
                  <Image
                    source={openjamLogo}
                    style={styles.brandLogo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.brandName} maxFontSizeMultiplier={1.2}>
                  Open<Text style={styles.brandNameAmber}>Jam</Text>
                </Text>
              </View>

              <View style={styles.navRight}>
                <Pressable
                  onPress={() => {
                    void hapticMedium();
                    router.push('/offline');
                  }}
                  style={({ pressed }) => [styles.navVaultBtn, pressed && styles.pressed]}
                  hitSlop={8}
                  accessibilityLabel="Open Offline Audio Vault"
                >
                  <HardDrive size={16} color={colors.amber} />
                </Pressable>

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
                          maxFontSizeMultiplier={1.0}
                        >
                          {initials}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={styles.userName}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      maxFontSizeMultiplier={1.2}
                    >
                      {user.discord_username ? `@${user.discord_username}` : (user.display_name || 'Jammer')}
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
                    onPress={() => setShowIdentity(true)}
                    style={({ pressed }) => [styles.discordLoginPill, pressed && styles.pressed]}
                    accessibilityLabel="Sign in or join as guest"
                  >
                    <LogIn size={15} color="#ffffff" strokeWidth={2.4} />
                    <Text style={styles.discordPillText} maxFontSizeMultiplier={1.2}>Sign In</Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* Streamlined Music Action Deck */}
            <View style={styles.heroGlassCard}>
              <LinearGradient
                colors={['rgba(24, 24, 34, 0.90)', 'rgba(12, 12, 18, 0.96)']}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              {/* Main Title with Animated Slogan Ticker */}
              <Text style={styles.heroTitle}>
                Listen Together.{' '}
                <SloganTicker />
              </Text>

              <Text style={styles.heroSubtitle}>
                Synchronized music listening with zero audio latency.
              </Text>

              {/* Action Buttons: Create Room & Join with Code */}
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => {
                    void hapticMedium();
                    if (user) setShowCreate(true);
                    else setShowIdentity(true);
                  }}
                  style={({ pressed }) => [styles.instantBtn, pressed && styles.pressed]}
                  accessibilityLabel="Create Instant Jam"
                >
                  <LinearGradient
                    colors={['#ffb03a', '#ff9f1c']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <Sparkles size={16} color="#08080a" strokeWidth={2.4} />
                  <Text style={styles.instantBtnText}>Instant Jam</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void hapticMedium();
                    setShowJoinWithCode(true);
                  }}
                  style={({ pressed }) => [
                    styles.joinCodeBtn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityLabel="Join with Code"
                >
                  <KeyRound size={15} color="#ffffff" strokeWidth={2.2} />
                  <Text style={styles.joinCodeBtnText}>Join with Code</Text>
                </Pressable>
              </View>
            </View>

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
                  style={styles.pinnedScrollView}
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

                <Pressable
                  onPress={() => router.push('/offline')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.offlineVaultBtn, pressed && styles.pressed]}
                  accessibilityLabel="Open Offline Audio Vault"
                >
                  <HardDrive size={12} color={colors.amber} />
                  <Text style={styles.offlineVaultBtnText}>Offline Vault</Text>
                </Pressable>
              </View>

              {/* Search Field */}
              <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
                <Search size={16} color={searchFocused ? colors.amber : colors.text3} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search rooms, DJs, genres..."
                  placeholderTextColor={colors.text3}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => {
                      void hapticMedium();
                      setSearchQuery('');
                    }}
                    hitSlop={12}
                    style={styles.clearSearchBtn}
                    accessibilityLabel="Clear search"
                  >
                    <X size={15} color={colors.amber} strokeWidth={2.4} />
                  </Pressable>
                ) : null}
              </View>

              {/* Genre Filter Chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.genreScroll}
                style={styles.genreScrollView}
              >
                {GENRES.map((g) => {
                  const active = selectedGenre === g;
                  return (
                    <Pressable
                      key={g}
                      onPress={() => {
                        void hapticMedium();
                        setSelectedGenre(g);
                      }}
                      style={({ pressed }) => [
                        styles.genreChip,
                        active && styles.genreChipActive,
                        pressed && styles.pressed,
                      ]}
                      accessibilityLabel={`Filter by ${g}`}
                    >
                      {active ? <View style={styles.genreActiveDot} /> : null}
                      <Text
                        style={[styles.genreText, active && styles.genreTextActive]}
                        maxFontSizeMultiplier={1.2}
                      >
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
            searchQuery.trim().length > 0 ? (
              <Animated.View entering={FadeInDown.duration(250)} style={styles.searchEmptyCard}>
                <View style={styles.searchEmptyIconWrap}>
                  <Search size={22} color={colors.amber} strokeWidth={2.2} />
                </View>
                <Text style={styles.searchEmptyTitle}>No Rooms Found</Text>
                <Text style={styles.searchEmptyDesc}>
                  No live rooms match "{searchQuery.trim()}". Try checking another vibe keyword or clear your filter.
                </Text>
                <Pressable
                  onPress={() => {
                    void hapticMedium();
                    setSearchQuery('');
                    setSelectedGenre('All');
                  }}
                  style={({ pressed }) => [styles.clearSearchFilterBtn, pressed && styles.pressed]}
                  accessibilityLabel="Clear search and filters"
                >
                  <Text style={styles.clearSearchFilterText}>Clear Search & Filters</Text>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.feedEmptyCard}>
                <View style={styles.feedEmptyIconWrap}>
                  <Radio size={24} color={colors.amber} strokeWidth={2.2} />
                </View>
                <Text style={styles.feedEmptyTitle}>No Active Jam Rooms</Text>
                <Text style={styles.feedEmptyDesc}>
                  No one is broadcasting right now. Be the first DJ to spin up a live session, or explore music saved in your Offline Vault!
                </Text>
                <View style={styles.feedEmptyActions}>
                  <Pressable
                    onPress={() => {
                      void hapticMedium();
                      if (user) setShowCreate(true);
                      else setShowIdentity(true);
                    }}
                    style={({ pressed }) => [styles.feedEmptyCreateBtn, pressed && styles.pressed]}
                    accessibilityLabel="Start a Live Jam Room"
                  >
                    <LinearGradient
                      colors={['#ffb03a', '#ff9f1c']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.feedEmptyCreateGradient}
                    >
                      <Sparkles size={15} color="#08080a" strokeWidth={2.4} />
                      <Text style={styles.feedEmptyCreateText}>Start a Jam Room</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void hapticMedium();
                      router.push('/offline');
                    }}
                    style={({ pressed }) => [styles.feedEmptyVaultBtn, pressed && styles.pressed]}
                    accessibilityLabel="Open Offline Audio Vault"
                  >
                    <HardDrive size={14} color={colors.amber} />
                    <Text style={styles.feedEmptyVaultText}>Offline Vault</Text>
                  </Pressable>
                </View>
              </Animated.View>
            )
          ) : (
            <RoomCardSkeletonList count={2} />
          )
        }
        ListFooterComponent={
          <View style={[styles.footerSection, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={styles.footerLinksRow}>
              <Pressable
                onPress={() => router.push('/legal/privacy')}
                hitSlop={8}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <Text style={styles.footerLinkText}>Privacy</Text>
              </Pressable>
              <Text style={styles.footerDot}>•</Text>
              <Pressable
                onPress={() => router.push('/legal/terms')}
                hitSlop={8}
                style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
              >
                <Text style={styles.footerLinkText}>Terms</Text>
              </Pressable>
            </View>
            <Text style={styles.footerCopy}>OpenJam • Free & Open-Source Audio Sync</Text>
          </View>
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
          promptFirstLaunchPermissions();
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
    overflow: 'hidden',
  },
  flatList: {
    flex: 1,
    overflow: 'hidden',
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
    paddingVertical: 10,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  brandLogoWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 30,
    height: 30,
  },
  brandName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 21,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandNameAmber: {
    color: colors.amber,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  navVaultBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordLoginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 6,
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 0,
  },
  discordPillIcon: {
    fontSize: 13,
  },
  discordPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
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
    gap: 6,
    maxWidth: 190,
    flexShrink: 1,
  },
  discordAvatarMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    flexShrink: 0,
  },
  discordAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  discordOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    flexShrink: 0,
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
    flexShrink: 0,
  },
  userInitialsMini: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    color: '#ffffff',
  },
  userName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text1,
    flexShrink: 1,
    minWidth: 0,
  },
  heroGlassCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
    gap: 5,
    marginBottom: 8,
  },
  versionPulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.amber,
  },
  versionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1.1,
  },
  heroTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 2,
    textAlign: 'center',
  },
  heroTitleAmber: {
    color: colors.amber,
  },
  heroSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13.5,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
    marginTop: 4,
    marginBottom: 16,
  },
  heroActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instantBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  instantBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#08080a',
    letterSpacing: 0.2,
  },
  joinCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  joinCodeBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#ffffff',
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
  pinnedScrollView: {
    marginHorizontal: -spacing.md,
  },
  pinnedScroll: {
    gap: 10,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
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
    marginTop: 6,
    marginBottom: 4,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveHeaderText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 1.1,
    color: colors.text2,
  },
  offlineVaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.22)',
  },
  offlineVaultBtnText: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 10.5,
    color: colors.amber,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    gap: 8,
  },
  searchWrapFocused: {
    borderColor: 'rgba(255, 159, 28, 0.45)',
    backgroundColor: 'rgba(255, 159, 28, 0.05)',
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13.5,
    color: '#ffffff',
    paddingVertical: 0,
    minWidth: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearch: {
    fontSize: 11,
    color: colors.text3,
    padding: 2,
  },
  genreScrollView: {
    marginHorizontal: -spacing.md,
  },
  genreScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6.5,
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.amber,
    marginRight: 5,
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
  searchEmptyCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  searchEmptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  searchEmptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
  },
  searchEmptyDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: spacing.md,
  },
  clearSearchFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.4)',
  },
  clearSearchFilterText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
  },
  feedEmptyCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  feedEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  feedEmptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  feedEmptyDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 300,
  },
  feedEmptyActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  feedEmptyCreateBtn: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  feedEmptyCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
  },
  feedEmptyCreateText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#08080a',
  },
  feedEmptyVaultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  feedEmptyVaultText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
  },
  pressed: {
    opacity: 0.8,
  },
  footerSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: 20,
    gap: 6,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerLinkText: {
    color: colors.text3,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
  footerDot: {
    color: colors.text3,
    fontSize: 12,
  },
  footerCopy: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    opacity: 0.6,
  },
});
