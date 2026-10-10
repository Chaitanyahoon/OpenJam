/**
 * OpenJam Landing / Discover Screen — Decomposed Architecture.
 * Modular domain components organized under src/components/home/.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { useNetworkStatus } from '../utils/network';
import { colors, spacing } from '../theme';
import { clearSession, fetchMe, getBackendUrl, getCachedRooms, getRooms, getStoredSession, joinAsGuest, saveAuthToken, type ApiUser, type RoomSummary } from '../api';
import { useAppHeartbeat } from '../utils/heartbeat';
import { useSocket } from '../state/SocketContext';
import { RoomCardSkeletonList } from '../components/RoomCardSkeleton';
import { CreateRoomModal, IdentityModal, JoinWithCodeModal, RoomPasswordModal } from '../components/Modals';
import { ProfileModal } from '../components/ProfileModal';
import { getFavoriteRooms, type FavoriteRoom, type PlayedTrack, getRecentlyPlayed } from '../storage/history';
import type { TrackInfo } from '../sync/protocol';
import { hapticMedium } from '../utils/haptics';
import { useToast } from '../components/ToastContext';
import { registerPushToken } from '../notifications';
import { requestFirstLaunchPermissions } from '../permissions';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';
import { SoloSearchModal } from '../components/SoloSearchModal';
import { MiniPlayer } from '../components/MiniPlayer';

import {
  HomeTopNav,
  NetworkStatusPill,
  HeroHeader,
  StationCarousel,
  GenreFilterBar,
  RoomGridItem,
  RoomGridEmptyState,
  HomeFooter,
} from '../components/home';

// Complete WebBrowser session if returning from OAuth
WebBrowser.maybeCompleteAuthSession();

const GENRES = ['All', 'Lofi & Chill', 'Synthwave', 'Hip Hop', 'Ambient'] as const;

const GENRE_MAP: Record<string, string[]> = {
  'Lofi & Chill': ['lofi', 'chill', 'beats', 'study', 'relax', 'cafe', 'lounge'],
  'Synthwave': ['synthwave', 'retrowave', '80s', 'electronic', 'synth', 'cyberpunk', 'sunset'],
  'Hip Hop': ['hip-hop', 'hiphop', 'rap', 'trap', 'boom-bap', 'beats', 'r&b'],
  'Ambient': ['ambient', 'drone', 'meditation', 'focus', 'atmosphere', 'peaceful'],
};

export default function Landing() {
  const { connect, disconnect } = useSocket();
  const toast = useToast();
  const { playTrack, setPlayerModalOpen, currentTrack } = usePlayer();
  const playerStatus = usePlayerStatus();

  // Top-Level State Variables
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
  const [showSoloSearch, setShowSoloSearch] = useState(false);
  const [pwRoom, setPwRoom] = useState<RoomSummary | null>(null);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [ready, setReady] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showReconnectedPill, setShowReconnectedPill] = useState(false);
  const [scrollOffsetY, setScrollOffsetY] = useState(0);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput>(null);
  const handledTokensRef = useRef<Set<string>>(new Set());
  const authSuccessRef = useRef(false);
  const isOnline = useNetworkStatus();
  const prevOnlineRef = useRef(isOnline);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      setShowReconnectedPill(true);
      const timer = setTimeout(() => setShowReconnectedPill(false), 2800);
      return () => clearTimeout(timer);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  useAppHeartbeat();

  const promptFirstLaunchPermissions = useCallback(() => {
    void requestFirstLaunchPermissions();
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await getFavoriteRooms();
      setFavoriteRooms(favs);
    } catch {}
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const recents = await getRecentlyPlayed();
      setRecentTracks(recents);
    } catch {}
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch {}
    await loadFavorites();
    await loadHistory();
  }, [loadFavorites, loadHistory]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
      void loadHistory();
    }, [loadFavorites, loadHistory]),
  );

  // 0ms Optimistic cache hydration + background revalidation
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const [cachedRooms, session] = await Promise.all([
        getCachedRooms().catch(() => []),
        getStoredSession().catch(() => ({ token: null, user: null, displayName: null })),
      ]);
      if (!isMounted) return;
      if (cachedRooms && cachedRooms.length > 0) setRooms(cachedRooms);
      if (session?.user) setUser(session.user);
      setReady(true);
      void loadFavorites();

      if (session?.token) {
        fetchMe().then((latest) => { if (isMounted && latest) setUser(latest); }).catch(() => {});
        connect().catch(() => {});
        registerPushToken().catch(() => {});
        promptFirstLaunchPermissions();
      } else {
        setShowIdentity(true);
      }

      const syncTimer = setTimeout(() => { if (isMounted) setIsSyncingCloud(true); }, 2200);
      try {
        const liveRooms = await getRooms();
        if (isMounted) setRooms(liveRooms);
      } catch {} finally {
        clearTimeout(syncTimer);
        if (isMounted) setIsSyncingCloud(false);
      }
    })();
    return () => { isMounted = false; };
  }, [connect, promptFirstLaunchPermissions, loadFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  }, [loadRooms]);

  // Deep Link OAuth
  const processAuthUrl = useCallback(
    async (url: string) => {
      let token = '';
      if (url.includes('token=')) {
        const match = url.match(/[?&#]token=([^&#]+)/);
        if (match) token = decodeURIComponent(match[1]).replace(/\/+$/, '').trim();
      }
      if (token) {
        authSuccessRef.current = true;
        if (handledTokensRef.current.has(token)) return true;
        handledTokensRef.current.add(token);
        disconnect();
        const profile = await saveAuthToken(token);
        if (profile) {
          setUser(profile);
          setAuthError(null);
          setShowIdentity(false);
          toast(`Welcome, ${profile.discord_username ? '@' + profile.discord_username : profile.display_name}!`, 'success');
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
    return () => { sub.remove(); };
  }, [processAuthUrl]);

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
            if (currentSession.token) { authSuccessRef.current = true; return; }
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

  const handleSignOut = async () => {
    disconnect();
    await clearSession();
    setUser(null);
    toast('Signed out', 'info');
  };

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

  const openRoom = (room: RoomSummary | { id: string; name?: string }, password = '') => {
    router.push({
      pathname: '/room/[id]',
      params: { id: room.id, name: 'name' in room && room.name ? room.name : '', ...(password ? { password } : {}) },
    });
  };

  const handleProfileJoinRoom = (roomId: string) => {
    setShowProfile(false);
    openRoom({ id: roomId });
  };

  const handleStartSoloJam = () => {
    void hapticMedium();
    if (currentTrack && playerStatus.playing) {
      setPlayerModalOpen(true);
    } else {
      setShowSoloSearch(true);
    }
  };

  const handleProfilePlayTrack = (
    track: PlayedTrack,
    queue?: TrackInfo[],
    options?: { sourceTitle?: string },
  ) => {
    setShowProfile(false);
    void playTrack(track, queue || recentTracks, {
      sourceTitle: options?.sourceTitle || 'Recently Played',
    });
    setPlayerModalOpen(true);
  };

  const handleRoomPress = (room: RoomSummary) => {
    if (!isOnline) {
      void hapticMedium();
      toast('Live rooms require internet. Tap Solo Jam for music.', 'info');
      return;
    }
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
        return targetKeywords.some((kw) => roomTags.some((tag) => tag.includes(kw) || kw.includes(tag)) || roomName.includes(kw));
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.host_name.toLowerCase().includes(q) ||
      r.now_playing?.track_name?.toLowerCase().includes(q) ||
      r.now_playing?.artist?.toLowerCase().includes(q),
    );
  }, [rooms, searchQuery, selectedGenre]);

  const initials = user ? (user.display_name || user.discord_username || '?').slice(0, 2).toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.ambientBloom} pointerEvents="none">
        <LinearGradient colors={['rgba(255, 159, 28, 0.12)', 'rgba(88, 101, 242, 0.05)', 'transparent']} style={StyleSheet.absoluteFill} />
      </View>

      <FlatList
        ref={flatListRef}
        data={!isOnline ? [] : filteredRooms}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
        onScroll={(e) => setScrollOffsetY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <HomeTopNav
              user={user}
              initials={initials}
              onOpenVault={() => { void hapticMedium(); router.push('/offline'); }}
              onOpenProfile={() => setShowProfile(true)}
              onOpenSignIn={() => setShowIdentity(true)}
              bgOpacity={Math.max(0, Math.min(1, (scrollOffsetY - 25) / 50))}
            />
            <NetworkStatusPill isOnline={isOnline} showReconnected={showReconnectedPill} />
            <HeroHeader
              onStartSoloJam={handleStartSoloJam}
              onCreateLiveRoom={() => { void hapticMedium(); if (user) setShowCreate(true); else setShowIdentity(true); }}
              onJoinWithCode={() => { void hapticMedium(); setShowJoinWithCode(true); }}
            />
            {favoriteRooms.length > 0 && (
              <StationCarousel favoriteRooms={favoriteRooms} onOpenRoom={openRoom} />
            )}
            {isOnline && (
              <GenreFilterBar
                roomCount={filteredRooms.length}
                isSyncingCloud={isSyncingCloud}
                searchQuery={searchQuery}
                searchFocused={searchFocused}
                selectedGenre={selectedGenre}
                genres={GENRES}
                searchInputRef={searchInputRef}
                onSearchChange={setSearchQuery}
                onSearchFocus={setSearchFocused}
                onClearSearch={() => setSearchQuery('')}
                onSelectGenre={setSelectedGenre}
                onOpenOfflineVault={() => router.push('/offline')}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <RoomGridItem room={item} onPress={handleRoomPress} onFavoriteToggle={loadFavorites} />
        )}
        ListEmptyComponent={
          !isOnline ? null : ready ? (
            <RoomGridEmptyState
              isSearching={searchQuery.trim().length > 0}
              searchQuery={searchQuery}
              onClearSearchAndFilters={() => { void hapticMedium(); setSearchQuery(''); setSelectedGenre('All'); }}
              onCreateRoom={() => { void hapticMedium(); if (user) setShowCreate(true); else setShowIdentity(true); }}
              onOpenOfflineVault={() => { void hapticMedium(); router.push('/offline'); }}
            />
          ) : (
            <RoomCardSkeletonList count={2} />
          )
        }
        ListFooterComponent={
          <HomeFooter
            bottomInset={insets.bottom}
            onPressPrivacy={() => router.push('/legal/privacy')}
            onPressTerms={() => router.push('/legal/terms')}
          />
        }
      />

      <MiniPlayer bottomOffset={Math.max(insets.bottom, 12)} />

      <SoloSearchModal
        visible={showSoloSearch}
        onClose={() => setShowSoloSearch(false)}
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
        onClose={() => { setShowIdentity(false); setAuthError(null); promptFirstLaunchPermissions(); }}
      />
      <CreateRoomModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(roomId) => { setShowCreate(false); openRoom({ id: roomId }); }}
      />
      <JoinWithCodeModal visible={showJoinWithCode} onClose={() => setShowJoinWithCode(false)} onJoin={handleJoinWithCode} />
      <RoomPasswordModal
        visible={!!pwRoom}
        roomName={pwRoom?.name ?? ''}
        onClose={() => setPwRoom(null)}
        onSubmit={(password) => { const room = pwRoom; setPwRoom(null); if (room) openRoom(room, password); }}
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
});
