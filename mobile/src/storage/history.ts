/**
 * OpenJam Native Local Storage Suite (AsyncStorage).
 *
 * Persists:
 * 1. Recently Played History (up to 50 tracks with timestamps and cover art)
 * 2. Favorite / Pinned Rooms for 1-tap re-entry
 * 3. Listening Statistics (tracks jammed, minutes jammed, rooms visited)
 * 4. App & Audio Streaming Preferences (High Fidelity / Data Saver)
 * 5. Cache metrics and clear storage utilities
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackInfo } from '../sync/protocol';

const RECENT_TRACKS_KEY = 'openjam_recent_tracks_v2';
const FAVORITE_ROOMS_KEY = 'openjam_favorite_rooms_v2';
const LISTENING_STATS_KEY = 'openjam_listening_stats_v2';
const APP_PREFERENCES_KEY = 'openjam_app_preferences_v2';
const OFFLINE_PLAYLISTS_KEY = 'openjam_offline_playlists_v1';
const FAVORITE_TRACKS_KEY = 'openjam_favorite_tracks_v1';
const RECENT_SEARCHES_KEY = 'openjam_recent_searches_v1';

export interface OfflinePlaylist {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  tracks: TrackInfo[];
}

export interface PlayedTrack extends TrackInfo {
  playedAt: number;
  roomId?: string;
  roomName?: string;
}

export interface FavoriteRoom {
  id: string;
  name: string;
  hostName?: string;
  genreTags?: string[];
  savedAt: number;
}

export interface ListeningStats {
  totalTracksJammed: number;
  totalMinutesJammed: number;
  roomsVisited: string[];
}

export interface AppPreferences {
  audioQuality: 'high' | 'saver';
  hapticEnabled: boolean;
}

const DEFAULT_STATS: ListeningStats = {
  totalTracksJammed: 0,
  totalMinutesJammed: 0,
  roomsVisited: [],
};

const DEFAULT_PREFERENCES: AppPreferences = {
  audioQuality: 'high',
  hapticEnabled: true,
};

/** 1. Recently Played Tracks */
export async function getRecentlyPlayed(): Promise<PlayedTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_TRACKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function recordTrackPlayed(
  track: TrackInfo,
  room?: { id: string; name?: string },
): Promise<void> {
  if (!track || !track.track_name) return;
  try {
    const existing = await getRecentlyPlayed();
    // Don't record duplicate if the same track was already recorded in the last 2 minutes
    const now = Date.now();
    const first = existing[0];
    if (
      first &&
      first.track_uri === track.track_uri &&
      now - first.playedAt < 120_000
    ) {
      return;
    }

    const newEntry: PlayedTrack = {
      ...track,
      playedAt: now,
      roomId: room?.id,
      roomName: room?.name,
    };

    // Filter out previous occurrences of the exact track to keep list fresh
    const filtered = existing.filter((t) => t.track_uri !== track.track_uri);
    const updated = [newEntry, ...filtered].slice(0, 50);
    await AsyncStorage.setItem(RECENT_TRACKS_KEY, JSON.stringify(updated));

    // Also increment listening stats
    await incrementListeningStats(1, true, room?.id);
  } catch (err) {
    console.warn('Failed to record played track:', err);
  }
}

export async function clearRecentlyPlayed(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_TRACKS_KEY);
  } catch {}
}

/** 2. Favorite / Pinned Rooms */
export async function getFavoriteRooms(): Promise<FavoriteRoom[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_ROOMS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleFavoriteRoom(room: {
  id: string;
  name: string;
  hostName?: string;
  genreTags?: string[];
}): Promise<boolean> {
  try {
    const list = await getFavoriteRooms();
    const exists = list.some((r) => r.id === room.id);
    let updated: FavoriteRoom[];

    if (exists) {
      updated = list.filter((r) => r.id !== room.id);
    } else {
      updated = [
        {
          id: room.id,
          name: room.name,
          hostName: room.hostName,
          genreTags: room.genreTags,
          savedAt: Date.now(),
        },
        ...list,
      ];
    }

    await AsyncStorage.setItem(FAVORITE_ROOMS_KEY, JSON.stringify(updated));
    return !exists;
  } catch {
    return false;
  }
}

export async function isRoomFavorited(roomId: string): Promise<boolean> {
  try {
    const list = await getFavoriteRooms();
    return list.some((r) => r.id === roomId);
  } catch {
    return false;
  }
}

/** 3. Listening Statistics */
export async function getListeningStats(): Promise<ListeningStats> {
  try {
    const raw = await AsyncStorage.getItem(LISTENING_STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATS;
  }
}

export async function incrementListeningStats(
  minutesDelta = 1,
  trackIncrement = false,
  roomId?: string,
): Promise<void> {
  try {
    const current = await getListeningStats();
    const rooms = new Set(current.roomsVisited);
    if (roomId) rooms.add(roomId);

    const updated: ListeningStats = {
      totalTracksJammed: current.totalTracksJammed + (trackIncrement ? 1 : 0),
      totalMinutesJammed: current.totalMinutesJammed + Math.max(0, minutesDelta),
      roomsVisited: Array.from(rooms),
    };
    await AsyncStorage.setItem(LISTENING_STATS_KEY, JSON.stringify(updated));
  } catch {}
}

/** 4. App Preferences */
export async function getAppPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(APP_PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function updateAppPreferences(
  prefs: Partial<AppPreferences>,
): Promise<AppPreferences> {
  try {
    const current = await getAppPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(APP_PREFERENCES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

let lastCalculatedKb = 1;
let lastCalculatedTime = 0;

/** 5. Storage metrics & cleanup */
export async function calculateStorageUsageKb(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastCalculatedTime < 10_000) {
    return lastCalculatedKb;
  }
  try {
    const keys = [
      RECENT_TRACKS_KEY,
      FAVORITE_ROOMS_KEY,
      LISTENING_STATS_KEY,
      APP_PREFERENCES_KEY,
      OFFLINE_PLAYLISTS_KEY,
      FAVORITE_TRACKS_KEY,
    ];
    const pairs = await AsyncStorage.multiGet(keys);
    let totalBytes = 0;
    for (const [, val] of pairs) {
      if (val) totalBytes += val.length * 2;
    }
    lastCalculatedKb = Math.max(1, Math.round(totalBytes / 1024));
    lastCalculatedTime = now;
    return lastCalculatedKb;
  } catch {
    return lastCalculatedKb;
  }
}

export async function clearAllLocalCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      RECENT_TRACKS_KEY,
      FAVORITE_ROOMS_KEY,
    ]);
  } catch {}
}

export function normalizeTrack(t: any): TrackInfo {
  return {
    track_uri: t?.track_uri || t?.uri || '',
    track_name: t?.track_name || t?.name || t?.title || 'Unknown Track',
    artist: t?.artist || t?.uploader || 'Unknown Artist',
    album_art_url: t?.album_art_url || t?.thumbnail || t?.cover_art_url || undefined,
    duration_ms: typeof t?.duration_ms === 'number' ? t.duration_ms : 0,
  };
}

/** 6. Offline Playlists & Favorite Tracks (Sandboxed App Storage) */
export async function getOfflinePlaylists(): Promise<OfflinePlaylist[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_PLAYLISTS_KEY);
    if (!raw) return [];
    const parsed: any[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => ({
      ...p,
      tracks: Array.isArray(p.tracks) ? p.tracks.map(normalizeTrack) : [],
    }));
  } catch {
    return [];
  }
}

export async function saveOfflinePlaylist(
  name: string,
  tracks: TrackInfo[] = [],
): Promise<OfflinePlaylist> {
  const playlists = await getOfflinePlaylists();
  const now = Date.now();
  const id = `playlist_${now}_${Math.random().toString(36).substring(2, 7)}`;
  const normalizedTracks = tracks.map(normalizeTrack);
  const newPlaylist: OfflinePlaylist = {
    id,
    name: name.trim() || 'My Offline Playlist',
    createdAt: now,
    updatedAt: now,
    tracks: normalizedTracks,
  };
  const updated = [newPlaylist, ...playlists];
  await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(updated));
  return newPlaylist;
}

export async function deleteOfflinePlaylist(playlistId: string): Promise<void> {
  try {
    const playlists = await getOfflinePlaylists();
    const updated = playlists.filter((p) => p.id !== playlistId);
    await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(updated));
  } catch {}
}

export async function addTrackToOfflinePlaylist(
  playlistId: string,
  track: TrackInfo,
): Promise<boolean> {
  try {
    const playlists = await getOfflinePlaylists();
    const index = playlists.findIndex((p) => p.id === playlistId);
    if (index === -1) return false;

    const p = playlists[index];
    const norm = normalizeTrack(track);
    if (!norm.track_uri) return false;

    const exists = p.tracks.some(
      (t) =>
        t.track_uri === norm.track_uri ||
        (t.track_name.toLowerCase() === norm.track_name.toLowerCase() &&
          t.artist.toLowerCase() === norm.artist.toLowerCase()),
    );
    if (exists) return false;

    p.tracks.push(norm);
    p.updatedAt = Date.now();
    playlists[index] = p;
    await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(playlists));
    return true;
  } catch {
    return false;
  }
}

export async function addTracksBulkToOfflinePlaylist(
  playlistId: string,
  newTracks: TrackInfo[],
): Promise<number> {
  try {
    const playlists = await getOfflinePlaylists();
    const index = playlists.findIndex((p) => p.id === playlistId);
    if (index === -1) return 0;

    const p = playlists[index];
    let addedCount = 0;
    const existingUris = new Set(p.tracks.map((t) => t.track_uri));

    for (const raw of newTracks) {
      const norm = normalizeTrack(raw);
      if (norm.track_uri && !existingUris.has(norm.track_uri)) {
        p.tracks.push(norm);
        existingUris.add(norm.track_uri);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      p.updatedAt = Date.now();
      playlists[index] = p;
      await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(playlists));
    }
    return addedCount;
  } catch {
    return 0;
  }
}

export async function removeTrackFromOfflinePlaylist(
  playlistId: string,
  trackUri: string,
): Promise<boolean> {
  try {
    const playlists = await getOfflinePlaylists();
    const index = playlists.findIndex((p) => p.id === playlistId);
    if (index === -1) return false;

    const p = playlists[index];
    p.tracks = p.tracks.filter((t) => t.track_uri !== trackUri);
    p.updatedAt = Date.now();
    playlists[index] = p;
    await AsyncStorage.setItem(OFFLINE_PLAYLISTS_KEY, JSON.stringify(playlists));
    return true;
  } catch {
    return false;
  }
}

const favoriteListeners = new Set<(favorites: TrackInfo[]) => void>();

export function subscribeFavoriteTracks(
  listener: (favorites: TrackInfo[]) => void,
): () => void {
  favoriteListeners.add(listener);
  void getFavoriteTracks().then((favs) => listener(favs));
  return () => {
    favoriteListeners.delete(listener);
  };
}

export async function getFavoriteTracks(): Promise<TrackInfo[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_TRACKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function toggleFavoriteTrack(track: TrackInfo): Promise<boolean> {
  try {
    const list = await getFavoriteTracks();
    const exists = list.some((t) => t.track_uri === track.track_uri);
    let updated: TrackInfo[];
    if (exists) {
      updated = list.filter((t) => t.track_uri !== track.track_uri);
    } else {
      updated = [track, ...list];
    }
    await AsyncStorage.setItem(FAVORITE_TRACKS_KEY, JSON.stringify(updated));
    for (const listener of favoriteListeners) {
      try {
        listener(updated);
      } catch {}
    }
    return !exists;
  } catch {
    return false;
  }
}

export async function isFavoriteTrack(trackUri: string): Promise<boolean> {
  try {
    const list = await getFavoriteTracks();
    return list.some((t) => t.track_uri === trackUri);
  } catch {
    return false;
  }
}

let pendingSoloQueue: TrackInfo[] | null = null;
let pendingSoloAutoplayTrack: TrackInfo | null = null;

export function setPendingSoloQueue(tracks: TrackInfo[], playTrack?: TrackInfo): void {
  pendingSoloQueue = tracks;
  pendingSoloAutoplayTrack = playTrack || tracks[0] || null;
}

export function consumePendingSoloQueue(): { tracks: TrackInfo[]; playTrack: TrackInfo | null } | null {
  if (!pendingSoloQueue) return null;
  const result = { tracks: pendingSoloQueue, playTrack: pendingSoloAutoplayTrack };
  pendingSoloQueue = null;
  pendingSoloAutoplayTrack = null;
  return result;
}

/**
 * Deterministic Fisher-Yates shuffle that creates a randomized copy of tracks.
 */
export function shuffleTracks<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Pure helper for deduplicated, case-insensitive recent search ordering.
 */
export function filterRecentSearches(existing: string[], newQuery: string, limit = 10): string[] {
  const clean = newQuery.trim();
  if (!clean || clean.length < 2) return existing;
  const filtered = existing.filter((item) => item.toLowerCase() !== clean.toLowerCase());
  return [clean, ...filtered].slice(0, limit);
}

/**
 * Retrieves persisted recent search queries from AsyncStorage.
 */
export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new search query to recent searches, deduplicating and capping at 10.
 */
export async function saveRecentSearch(query: string): Promise<string[]> {
  try {
    const current = await getRecentSearches();
    const updated = filterRecentSearches(current, query, 10);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Removes a specific search query from recent searches.
 */
export async function removeRecentSearch(query: string): Promise<string[]> {
  try {
    const current = await getRecentSearches();
    const updated = current.filter((item) => item.toLowerCase() !== query.trim().toLowerCase());
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all recent searches from storage.
 */
export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {}
}



