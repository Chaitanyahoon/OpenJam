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
import { HardDrive, Headphones, Heart, KeyRound, Music, Plus, Radio, Sparkles } from 'lucide-react-native';

import { getVaultTracks, getVaultStats, type VaultTrack, type VaultStats, subscribeDownloadProgress } from '../storage/vault';
import { useNetworkStatus } from '../utils/network';
import { colors, spacing } from '../theme';
import { clearSession, fetchMe, getBackendUrl, getCachedRooms, getRooms, getStoredSession, joinAsGuest, saveAuthToken, type ApiUser, type RoomSummary } from '../api';
import { useAppHeartbeat } from '../utils/heartbeat';
import { useSocket } from '../state/SocketContext';
import { RoomCardSkeletonList } from '../components/RoomCardSkeleton';
import { CreateRoomModal, IdentityModal, JoinWithCodeModal, RoomPasswordModal } from '../components/Modals';
import { ProfileModal } from '../components/ProfileModal';
import { getFavoriteRooms, type FavoriteRoom, type PlayedTrack, getFavoriteTracks, subscribeFavoriteTracks, getRecentlyPlayed, clearRecentlyPlayed } from '../storage/history';
import type { TrackInfo } from '../sync/protocol';
import { hapticMedium, hapticLight } from '../utils/haptics';
import { useToast } from '../components/ToastContext';
import { registerPushToken } from '../notifications';
import { requestFirstLaunchPermissions } from '../permissions';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';

import {
  HomeTopNav,
  NetworkStatusPill,
  CategoryFilterChips,
  type HomeCategory,
  QuickAccessGrid,
  HeroHeader,
  MusicShelves,
  StationCarousel,
  PersonalStatsCard,
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

const STARTER_TRACKS: TrackInfo[] = [
  { track_uri: 'jfKfPfyJRdk', track_name: 'Lofi Hip Hop Chill Beats', artist: 'Lofi Girl', album_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80', duration_ms: 180000 },
  { track_uri: '4xDzrJKXOOY', track_name: 'Synthwave Night Drive', artist: 'Retro Dreamer', album_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80', duration_ms: 210000 },
];

const PRESET_TRACKS: Record<string, { title: string; tracks: TrackInfo[] }> = {
  lofi: {
    title: 'Lofi & Chill',
    tracks: [
      { track_uri: 'jfKfPfyJRdk', track_name: 'Lofi Hip Hop Chill Beats', artist: 'Lofi Girl', album_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80', duration_ms: 180000 },
      { track_uri: '5qap5aO4i9A', track_name: 'Lofi Beats to Relax', artist: 'ChilledCow', album_art_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80', duration_ms: 200000 },
    ],
  },
  synthwave: {
    title: 'Synthwave Beats',
    tracks: [
      { track_uri: '4xDzrJKXOOY', track_name: 'Synthwave Night Drive', artist: 'Retro Dreamer', album_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80', duration_ms: 210000 },
      { track_uri: 'MVPTGNGiI-4', track_name: 'Neon Horizon', artist: 'Kavinsky Mix', album_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&q=80', duration_ms: 225000 },
    ],
  },
  ambient: {
    title: 'Ambient Drift',
    tracks: [
      { track_uri: 'DWcJFNfaw90', track_name: 'Weightless Deep Ambient', artist: 'Marconi Union', album_art_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&q=80', duration_ms: 300000 },
      { track_uri: 'S4mC7N3U6Bw', track_name: 'Celestial Meditation', artist: 'Zen Atmosphere', album_art_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80', duration_ms: 280000 },
    ],
  },
};

export default function Landing() {
  const { connect, disconnect } = useSocket();
  const toast = useToast();
  const { currentTrack, playTrack, play, setPlayerModalOpen } = usePlayer();
  const { playing } = usePlayerStatus();

  // 21 Top-Level State Variables
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
  const [favoriteTracks, setFavoriteTracks] = useState<TrackInfo[]>([]);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [downloadedUris, setDownloadedUris] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showReconnectedPill, setShowReconnectedPill] = useState(false);
  const [vaultTracks, setVaultTracks] = useState<VaultTrack[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [homeCategory, setHomeCategory] = useState<HomeCategory>('All');

  // 5 Refs
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

  const loadHistoryAndFavorites = useCallback(async () => {
    try {
      const [favs, recents, vault, stats] = await Promise.all([
        getFavoriteTracks(),
        getRecentlyPlayed(),
        getVaultTracks(),
        getVaultStats(),
      ]);
      setFavoriteTracks(favs);
      setRecentTracks(recents);
      setVaultTracks(vault);
      setVaultStats(stats);
      setDownloadedUris(new Set(vault.map((t) => t.track_uri)));
    } catch {}
  }, []);

  useEffect(() => {
    const unsubFav = subscribeFavoriteTracks((favs) => setFavoriteTracks(favs));
    const unsubVault = subscribeDownloadProgress(() => {
      void Promise.all([getVaultTracks(), getVaultStats()]).then(([tracks, stats]) => {
        setVaultTracks(tracks);
        setVaultStats(stats);
        setDownloadedUris(new Set(tracks.map((t) => t.track_uri)));
      });
    });
    return () => {
      unsubFav();
      unsubVault();
    };
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(data);
    } catch {}
    await loadFavorites();
    await loadHistoryAndFavorites();
  }, [loadFavorites, loadHistoryAndFavorites]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
      void loadHistoryAndFavorites();
    }, [loadFavorites, loadHistoryAndFavorites]),
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

  const handleStartSoloJam = async () => {
    void hapticMedium();
    if (currentTrack) {
      if (!playing) play();
      setPlayerModalOpen(true);
      return;
    }
    if (favoriteTracks.length > 0) {
      await playTrack(favoriteTracks[0], favoriteTracks, { sourceTitle: 'Liked Songs' });
      setPlayerModalOpen(true);
      return;
    }
    if (recentTracks.length > 0) {
      await playTrack(recentTracks[0], recentTracks, { sourceTitle: 'Recently Played' });
      setPlayerModalOpen(true);
      return;
    }
    await playTrack(STARTER_TRACKS[0], STARTER_TRACKS, { sourceTitle: 'Solo Jam' });
    setPlayerModalOpen(true);
  };

  const handleProfilePlayTrack = (track: PlayedTrack) => {
    setShowProfile(false);
    void playTrack(track, recentTracks, { sourceTitle: 'Recently Played' });
    setPlayerModalOpen(true);
  };

  const handleShufflePlayLiked = useCallback(() => {
    if (favoriteTracks.length === 0) return;
    void hapticMedium();
    const shuffled = [...favoriteTracks].sort(() => Math.random() - 0.5);
    void playTrack(shuffled[0], shuffled, { sourceTitle: 'Liked Songs' });
    setPlayerModalOpen(true);
  }, [favoriteTracks, playTrack, setPlayerModalOpen]);

  const handlePlayLikedTrack = (track: TrackInfo) => {
    void hapticLight();
    const otherTracks = favoriteTracks.filter((t) => t.track_uri !== track.track_uri);
    void playTrack(track, [track, ...otherTracks], { sourceTitle: 'Liked Songs' });
    setPlayerModalOpen(true);
  };

  const handlePlayRecentTrack = (track: PlayedTrack) => {
    void hapticLight();
    void playTrack(track, recentTracks, { sourceTitle: 'Recently Played' });
    setPlayerModalOpen(true);
  };

  const handleClearRecent = async () => {
    void hapticLight();
    await clearRecentlyPlayed();
    setRecentTracks([]);
    toast('Listening history cleared', 'info');
  };

  const handleRoomPress = (room: RoomSummary) => {
    if (!isOnline) {
      void hapticMedium();
      toast('Live rooms require internet. Starting solo session instead.', 'info');
      void handleStartSoloJam();
      return;
    }
    if (room.is_private) setPwRoom(room);
    else openRoom(room);
  };

  const handlePlayVaultTrack = (track: VaultTrack) => {
    void hapticLight();
    const currentTrackInfo: TrackInfo = {
      track_uri: track.local_file_uri || track.track_uri,
      track_name: track.track_name,
      artist: track.artist,
      album_art_url: track.album_art_url,
      duration_ms: track.duration_ms,
    };
    const queueList: TrackInfo[] = vaultTracks.map((t) => ({
      track_uri: t.local_file_uri || t.track_uri,
      track_name: t.track_name,
      artist: t.artist,
      album_art_url: t.album_art_url,
      duration_ms: t.duration_ms,
    }));
    void playTrack(currentTrackInfo, queueList, { sourceTitle: 'Offline Vault' });
    setPlayerModalOpen(true);
  };

  const handleShuffleVault = () => {
    if (vaultTracks.length === 0) return;
    void hapticMedium();
    const shuffled = [...vaultTracks].sort(() => Math.random() - 0.5);
    handlePlayVaultTrack(shuffled[0]);
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

  const handlePlayPresetGenre = async (genre: 'lofi' | 'synthwave' | 'ambient') => {
    void hapticMedium();
    const preset = PRESET_TRACKS[genre] || PRESET_TRACKS.lofi;
    await playTrack(preset.tracks[0], preset.tracks, { sourceTitle: preset.title });
    setPlayerModalOpen(true);
  };

  const quickAccessItems = useMemo(() => {
    const isLikedPlaying = Boolean(currentTrack && favoriteTracks.some((t) => t.track_uri === currentTrack.track_uri));
    return [
      { id: 'liked', title: 'Liked Songs', subtitle: favoriteTracks.length ? `${favoriteTracks.length} tracks` : 'Favorites', gradient: ['#5b21b6', '#7c3aed'] as [string, string], icon: <Heart size={20} color="#fff" fill="#fff" />, onPress: handleShufflePlayLiked, isPlaying: isLikedPlaying },
      { id: 'vault', title: 'Offline Vault', subtitle: vaultTracks.length ? `${vaultTracks.length} offline` : 'Saved Audio', gradient: ['#b45309', '#f59e0b'] as [string, string], icon: <HardDrive size={20} color="#fff" />, onPress: () => { void hapticMedium(); setHomeCategory('Downloaded'); flatListRef.current?.scrollToOffset({ offset: 0, animated: true }); }, isPlaying: false },
      { id: 'solo', title: 'Solo Jam', subtitle: 'Play Instantly', gradient: ['#0284c7', '#06b6d4'] as [string, string], icon: <Headphones size={20} color="#fff" />, onPress: () => void handleStartSoloJam(), isPlaying: playing && !pwRoom },
      { id: 'lofi', title: 'Lofi & Chill', subtitle: 'Study & Relax', gradient: ['#db2777', '#f97316'] as [string, string], icon: <Radio size={20} color="#fff" />, onPress: () => void handlePlayPresetGenre('lofi'), isPlaying: false },
      { id: 'synthwave', title: 'Synthwave Beats', subtitle: 'Retro Drive', gradient: ['#7c3aed', '#ec4899'] as [string, string], icon: <Sparkles size={20} color="#fff" />, onPress: () => void handlePlayPresetGenre('synthwave'), isPlaying: false },
      { id: 'ambient', title: 'Ambient Drift', subtitle: 'Deep Atmosphere', gradient: ['#1e1b4b', '#3b82f6'] as [string, string], icon: <Music size={20} color="#fff" />, onPress: () => void handlePlayPresetGenre('ambient'), isPlaying: false },
      (!isOnline || favoriteRooms.length === 0)
        ? {
            id: 'create-room',
            title: isOnline ? 'Create Jam Room' : 'Offline Vault',
            subtitle: isOnline ? 'Broadcast Live' : 'Browse Local Files',
            gradient: ['#065f46', '#10b981'] as [string, string],
            icon: isOnline ? <Plus size={20} color="#fff" strokeWidth={2.4} /> : <HardDrive size={20} color="#fff" />,
            onPress: () => { void hapticMedium(); if (isOnline) { if (user) setShowCreate(true); else setShowIdentity(true); } else { setHomeCategory('Downloaded'); } },
            isPlaying: false,
          }
        : {
            id: 'fav-room',
            title: favoriteRooms[0].name,
            subtitle: favoriteRooms[0].hostName ? `DJ ${favoriteRooms[0].hostName}` : 'Pinned Station',
            gradient: ['#065f46', '#10b981'] as [string, string],
            icon: <Radio size={20} color="#fff" />,
            onPress: () => { void hapticMedium(); openRoom({ id: favoriteRooms[0].id, name: favoriteRooms[0].name }); },
            isPlaying: false,
          },
      {
        id: 'join-code',
        title: isOnline ? 'Join with Code' : 'Manage Storage',
        subtitle: isOnline ? 'Private Room' : 'View Storage',
        gradient: ['#1e293b', '#475569'] as [string, string],
        icon: isOnline ? <KeyRound size={20} color="#fff" /> : <HardDrive size={20} color="#fff" />,
        onPress: () => { void hapticMedium(); if (isOnline) setShowJoinWithCode(true); else router.push('/offline'); },
        isPlaying: false,
      },
    ];
  }, [currentTrack, favoriteTracks, vaultTracks, isOnline, playing, pwRoom, favoriteRooms, user, handleShufflePlayLiked]);

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
        data={!isOnline || homeCategory === 'Music' || homeCategory === 'Downloaded' ? [] : filteredRooms}
        keyExtractor={(r) => r.id}
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <HomeTopNav
              user={user}
              initials={initials}
              onOpenVault={() => { void hapticMedium(); setHomeCategory('Downloaded'); }}
              onOpenProfile={() => setShowProfile(true)}
              onOpenSignIn={() => setShowIdentity(true)}
            />
            <NetworkStatusPill isOnline={isOnline} showReconnected={showReconnectedPill} />
            <CategoryFilterChips selectedCategory={homeCategory} onSelectCategory={setHomeCategory} />
            {(homeCategory === 'All' || homeCategory === 'Music' || homeCategory === 'Downloaded') && (
              <QuickAccessGrid items={quickAccessItems} />
            )}
            <HeroHeader
              onStartSoloJam={handleStartSoloJam}
              onCreateLiveRoom={() => { void hapticMedium(); if (user) setShowCreate(true); else setShowIdentity(true); }}
              onJoinWithCode={() => { void hapticMedium(); setShowJoinWithCode(true); }}
            />
            {(homeCategory === 'All' || homeCategory === 'Music') && (
              <MusicShelves
                favoriteTracks={favoriteTracks}
                recentTracks={recentTracks}
                downloadedUris={downloadedUris}
                onPlayLikedTrack={handlePlayLikedTrack}
                onShuffleLiked={handleShufflePlayLiked}
                onPlayRecentTrack={handlePlayRecentTrack}
                onClearRecent={handleClearRecent}
              />
            )}
            {(homeCategory === 'All' || homeCategory === 'Live Rooms') && favoriteRooms.length > 0 && (
              <StationCarousel favoriteRooms={favoriteRooms} onOpenRoom={openRoom} />
            )}
            {(!isOnline || homeCategory === 'Downloaded') && (
              <PersonalStatsCard
                vaultTracks={vaultTracks}
                vaultStats={vaultStats}
                currentTrackUri={currentTrack?.track_uri}
                onPlayVaultTrack={handlePlayVaultTrack}
                onShuffleVault={handleShuffleVault}
                onManageVault={() => router.push('/offline')}
              />
            )}
            {isOnline && homeCategory !== 'Downloaded' && (homeCategory === 'All' || homeCategory === 'Live Rooms') && (
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
          !isOnline || homeCategory === 'Music' || homeCategory === 'Downloaded' ? null : ready ? (
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
