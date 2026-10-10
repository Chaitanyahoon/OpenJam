import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getStoredSession,
  getPublicProfile,
  fetchMe,
  getProfileSocial,
  getProfileStats,
  toggleFollowUser,
  getPlaylist,
  type PublicProfile,
  type ApiPlaylist,
  type ProfileSocialStats,
  type ProfileStatsData,
  type ApiUser,
} from '../api';
import {
  getRecentlyPlayed,
  getFavoriteRooms,
  getListeningStats,
  getAppPreferences,
  updateAppPreferences,
  getOfflinePlaylists,
  saveOfflinePlaylist,
  deleteOfflinePlaylist,
  getFavoriteTracks,
  clearRecentlyPlayed,
  calculateStorageUsageKb,
  shuffleTracks as pureShuffleTracks,
  type OfflinePlaylist,
  type PlayedTrack,
  type FavoriteRoom,
  type AppPreferences,
  type ListeningStats,
} from '../storage/history';
import { usePlayer } from '../audio/PlayerContext';
import { useToast } from '../components/ToastContext';
import { updateHapticsPreference, hapticLight, hapticMedium } from '../utils/haptics';
import type { TrackInfo } from '../sync/protocol';

export interface UseUserProfileOptions {
  /** Target user id or moniker (e.g. 'me', '@username', or UUID). If omitted, defaults to 'me' */
  targetId?: string;
  /** Optional initial session user (e.g. from parent props) */
  initialUser?: ApiUser | null;
  /** Optional initial guest name */
  initialGuestName?: string;
}

export interface UserProfileController {
  profile: PublicProfile | null;
  isSelf: boolean;
  loading: boolean;
  social: ProfileSocialStats | null;
  stats: ProfileStatsData | null;
  localStats: ListeningStats;
  playlists: OfflinePlaylist[];
  apiPlaylists: ApiPlaylist[];
  likedTracks: TrackInfo[];
  recentTracks: PlayedTrack[];
  favoriteRooms: FavoriteRoom[];
  preferences: AppPreferences;
  cacheKb: number;
  following: boolean;
  followLoading: boolean;
  isDiscordUser: boolean;
  sessionUser: ApiUser | null;
  guestName: string;
  milestoneBadges: Array<{ id: string; label: string; unlocked: boolean }>;

  // Actions
  setGuestName: (name: string) => void;
  playTrack: (
    track: PlayedTrack | TrackInfo,
    queue?: TrackInfo[],
    options?: { sourceTitle?: string },
  ) => void;
  playPlaylistDirect: (item: any) => Promise<void>;
  saveImportedPlaylist: (name: string, tracks: TrackInfo[]) => Promise<OfflinePlaylist | null>;
  shufflePlay: (tracks: TrackInfo[], sourceTitle: string) => void;
  createPlaylist: (name: string) => Promise<OfflinePlaylist | null>;
  deletePlaylist: (id: string) => Promise<void>;
  toggleFollow: () => Promise<void>;
  updatePreferences: (prefs: Partial<AppPreferences>) => Promise<void>;
  clearCache: () => Promise<void>;
  clearRecent: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useUserProfile({
  targetId = 'me',
  initialUser = null,
  initialGuestName,
}: UseUserProfileOptions = {}): UserProfileController {
  const toast = useToast();
  const player = usePlayer();

  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<ApiUser | null>(initialUser);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [social, setSocial] = useState<ProfileSocialStats | null>(null);
  const [apiPlaylists, setApiPlaylists] = useState<ApiPlaylist[]>([]);
  const [playlists, setPlaylists] = useState<OfflinePlaylist[]>([]);
  const [recentTracks, setRecentTracks] = useState<PlayedTrack[]>([]);
  const [favoriteRooms, setFavoriteRooms] = useState<FavoriteRoom[]>([]);
  const [likedTracks, setLikedTracks] = useState<TrackInfo[]>([]);
  const [stats, setStats] = useState<ProfileStatsData | null>(null);
  const [localStats, setLocalStats] = useState<ListeningStats>({
    totalTracksJammed: 0,
    totalMinutesJammed: 0,
    roomsVisited: [],
  });
  const [preferences, setPreferences] = useState<AppPreferences>({
    audioQuality: 'high',
    hapticEnabled: true,
  });
  const [cacheKb, setCacheKb] = useState(0);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSelf, setIsSelf] = useState(targetId === 'me');
  const [isDiscordUser, setIsDiscordUser] = useState(false);
  const [guestName, setGuestName] = useState(
    initialGuestName || initialUser?.display_name || 'Jammer',
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getStoredSession();
      if (session.user) {
        setSessionUser(session.user);
        setIsDiscordUser(!!session.user.discord_id || !!session.user.is_registered);
      }

      // 1. Resolve self identity
      const activeTargetId = targetId === 'me' ? session.user?.id : targetId;
      const cleanTarget = (activeTargetId || '').trim().replace(/^@/, '').toLowerCase();
      const userMatches =
        targetId === 'me' ||
        (!!session.user &&
          (session.user.id.toLowerCase() === cleanTarget ||
            (session.user.discord_username || '').toLowerCase() === cleanTarget ||
            session.user.display_name.toLowerCase() === cleanTarget));

      setIsSelf(userMatches);

      // 2. Hydrate local offline collections (zero-latency)
      const [recents, favRooms, lStats, prefs, offPlaylists, favorites] = await Promise.all([
        getRecentlyPlayed(),
        getFavoriteRooms(),
        getListeningStats(),
        getAppPreferences(),
        getOfflinePlaylists(),
        getFavoriteTracks(),
      ]);

      setRecentTracks(recents);
      setFavoriteRooms(favRooms);
      setLocalStats(lStats);
      setPreferences(prefs);
      setPlaylists(offPlaylists);
      setLikedTracks(favorites);

      // Async cache size calculation in background
      void calculateStorageUsageKb().then(setCacheKb);

      // 3. Hydrate remote profile & social stats
      if (userMatches) {
        const fallbackDisplayName = session.user?.display_name || initialGuestName || 'Jammer';
        setProfile({
          id: activeTargetId || 'guest',
          display_name: fallbackDisplayName,
          username: session.user?.discord_username || fallbackDisplayName,
          bio: 'OpenJam Music Explorer',
          avatar_url: session.user?.avatar_url || null,
        } as PublicProfile);

        if (session.token && session.user) {
          const [myUserRes, myStatsRes, mySocialRes] = await Promise.all([
            fetchMe().catch(() => null),
            getProfileStats('me').catch(() => null),
            getProfileSocial('me').catch(() => null),
          ]);

          if (myUserRes) {
            setProfile(myUserRes as any);
          }
          if (myStatsRes) {
            setStats(myStatsRes);
          }
          if (mySocialRes) {
            setSocial(mySocialRes);
          }
        }
      } else if (activeTargetId) {
        // Viewing someone else's public profile
        const [pubProfData, pubStats, pubSocial] = await Promise.all([
          getPublicProfile(activeTargetId).catch(() => null),
          getProfileStats(activeTargetId).catch(() => null),
          getProfileSocial(activeTargetId).catch(() => null),
        ]);

        if (pubProfData?.user) {
          setProfile(pubProfData.user);
          setApiPlaylists(pubProfData.playlists || []);
        }
        if (pubStats) {
          setStats(pubStats);
        }
        if (pubSocial) {
          setSocial(pubSocial);
          setFollowing(pubSocial.is_following);
        }
      }
    } catch (err) {
      console.warn('[useUserProfile] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [targetId, initialGuestName]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Derived Milestone Badges
  const milestoneBadges = useMemo(() => {
    const mins = stats?.total_minutes_listened || localStats.totalMinutesJammed;
    const tracks = stats?.total_tracks_listened || localStats.totalTracksJammed;
    const rooms = (localStats.roomsVisited || []).length;
    return [
      { id: 'first_jam', label: 'First Jam', unlocked: tracks >= 1 },
      { id: 'marathon_listener', label: 'Marathon Listener', unlocked: mins >= 60 },
      { id: 'century_club', label: '100 Tracks Club', unlocked: tracks >= 100 },
      { id: 'room_hopper', label: 'Room Hopper', unlocked: rooms >= 5 },
    ];
  }, [
    stats?.total_minutes_listened,
    stats?.total_tracks_listened,
    localStats.totalMinutesJammed,
    localStats.totalTracksJammed,
    localStats.roomsVisited,
  ]);

  // Playback Action Dispatcher
  const playTrack = useCallback(
    (
      track: PlayedTrack | TrackInfo,
      queue?: TrackInfo[],
      options?: { sourceTitle?: string },
    ) => {
      void hapticMedium();
      const activeQueue = queue && queue.length > 0 ? queue : [track as TrackInfo];
      void player.playTrack(track, activeQueue, {
        sourceTitle: options?.sourceTitle || 'Profile Library',
      });
      player.setPlayerModalOpen(true);
    },
    [player],
  );

  // Direct Playlist Playback Dispatcher
  const playPlaylistDirect = useCallback(
    async (item: any) => {
      void hapticMedium();
      if (Array.isArray(item.tracks) && item.tracks.length > 0) {
        const mapped = item.tracks.map((t: any) => ({
          track_uri: t.track_uri || t.uri,
          track_name: t.track_name || t.name,
          artist: t.artist || 'Unknown Artist',
          album_art_url: t.album_art_url,
          duration_ms: t.duration_ms,
        }));
        player.setPlayerModalOpen(true);
        void player.playTrack(mapped[0], mapped, { sourceTitle: item.name });
        toast(`Playing "${item.name}"`, 'success');
        return;
      }

      toast(`Opening "${item.name}"…`, 'info');
      player.setPlayerModalOpen(true);
      try {
        const detail = await getPlaylist(item.id);
        if (detail && detail.tracks && detail.tracks.length > 0) {
          const mapped = detail.tracks.map((t) => ({
            track_uri: t.track_uri,
            track_name: t.track_name,
            artist: t.artist || 'Unknown Artist',
            album_art_url: t.album_art_url,
            duration_ms: t.duration_ms,
          }));
          void player.playTrack(mapped[0], mapped, { sourceTitle: item.name });
        } else {
          toast('Playlist is empty or has no playable tracks', 'info');
        }
      } catch {
        toast('Could not start playlist playback', 'error');
      }
    },
    [player, toast],
  );

  // Shuffle Playback Action Dispatcher
  const shufflePlay = useCallback(
    (tracks: TrackInfo[], sourceTitle: string) => {
      if (tracks.length === 0) {
        toast('No tracks available to shuffle', 'info');
        return;
      }
      void hapticMedium();
      const randomized = pureShuffleTracks(tracks);
      void player.playTrack(randomized[0], randomized, { sourceTitle });
      player.setPlayerModalOpen(true);
      toast(`Shuffling ${tracks.length} tracks`, 'success');
    },
    [player, toast],
  );

  // Playlist Management
  const createPlaylist = useCallback(
    async (name: string): Promise<OfflinePlaylist | null> => {
      const trimmed = name.trim();
      const finalName = trimmed.length > 0 ? trimmed : `Playlist #${playlists.length + 1}`;
      try {
        const created = await saveOfflinePlaylist(finalName, []);
        setPlaylists((prev) => [created, ...prev]);
        void calculateStorageUsageKb().then(setCacheKb);
        toast(`Created "${created.name}"`, 'success');
        return created;
      } catch {
        toast('Could not create playlist', 'error');
        return null;
      }
    },
    [playlists.length, toast],
  );

  const saveImportedPlaylistAction = useCallback(
    async (name: string, tracks: TrackInfo[]): Promise<OfflinePlaylist | null> => {
      try {
        void hapticMedium();
        const created = await saveOfflinePlaylist(name, tracks);
        setPlaylists((prev) => [created, ...prev]);
        void calculateStorageUsageKb().then(setCacheKb);
        toast(`Imported playlist "${name}" (${tracks.length} tracks)`, 'success');
        return created;
      } catch {
        toast('Failed to save imported playlist', 'error');
        return null;
      }
    },
    [toast],
  );

  const deletePlaylist = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteOfflinePlaylist(id);
        setPlaylists((prev) => prev.filter((p) => p.id !== id));
        void calculateStorageUsageKb().then(setCacheKb);
        toast('Playlist deleted', 'info');
      } catch {
        toast('Could not delete playlist', 'error');
      }
    },
    [toast],
  );

  // Social Follow
  const toggleFollow = useCallback(async () => {
    if (!profile?.id || isSelf) return;
    setFollowLoading(true);
    const nextState = !following;
    setFollowing(nextState);
    setSocial((prev) =>
      prev
        ? {
            ...prev,
            followers_count: Math.max(0, prev.followers_count + (nextState ? 1 : -1)),
            is_following: nextState,
          }
        : null,
    );
    void hapticMedium();
    try {
      const ok = await toggleFollowUser(profile.id, nextState);
      if (ok) {
        toast(
          nextState
            ? `Following @${profile.username || profile.display_name}`
            : `Unfollowed @${profile.username || profile.display_name}`,
          'info',
        );
      } else {
        setFollowing(!nextState); // Rollback
        setSocial((prev) =>
          prev
            ? {
                ...prev,
                followers_count: Math.max(0, prev.followers_count + (!nextState ? 1 : -1)),
                is_following: !nextState,
              }
            : null,
        );
        toast('Could not update follow state', 'error');
      }
    } catch {
      setFollowing(!nextState); // Rollback
      setSocial((prev) =>
        prev
          ? {
              ...prev,
              followers_count: Math.max(0, prev.followers_count + (!nextState ? 1 : -1)),
              is_following: !nextState,
            }
          : null,
      );
      toast('Could not update follow state', 'error');
    } finally {
      setFollowLoading(false);
    }
  }, [profile?.id, profile?.username, profile?.display_name, following, isSelf, toast]);

  // Preferences
  const updatePreferences = useCallback(
    async (newPrefs: Partial<AppPreferences>) => {
      const merged = { ...preferences, ...newPrefs };
      setPreferences(merged);
      await updateAppPreferences(newPrefs);
      if (newPrefs.hapticEnabled !== undefined) {
        updateHapticsPreference(newPrefs.hapticEnabled);
      }
      toast('Preferences saved', 'success');
    },
    [preferences, toast],
  );

  // Storage Cache
  const clearCache = useCallback(async () => {
    try {
      setCacheKb(0);
      toast('Storage cache cleared', 'success');
    } catch {
      toast('Could not clear cache', 'error');
    }
  }, [toast]);

  const clearRecent = useCallback(async () => {
    try {
      await clearRecentlyPlayed();
      setRecentTracks([]);
      void calculateStorageUsageKb().then(setCacheKb);
      toast('Listening history cleared', 'info');
    } catch {
      toast('Could not clear history', 'error');
    }
  }, [toast]);

  return {
    profile,
    isSelf,
    loading,
    social,
    stats,
    localStats,
    playlists,
    apiPlaylists,
    likedTracks,
    recentTracks,
    favoriteRooms,
    preferences,
    cacheKb,
    following,
    followLoading,
    isDiscordUser,
    sessionUser,
    guestName,
    milestoneBadges,
    setGuestName,
    playTrack,
    playPlaylistDirect,
    saveImportedPlaylist: saveImportedPlaylistAction,
    shufflePlay,
    createPlaylist,
    deletePlaylist,
    toggleFollow,
    updatePreferences,
    clearCache,
    clearRecent,
    refresh: loadData,
  };
}
