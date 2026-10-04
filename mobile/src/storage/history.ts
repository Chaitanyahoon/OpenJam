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

/** 5. Storage metrics & cleanup */
export async function calculateStorageUsageKb(): Promise<number> {
  try {
    const keys = [
      RECENT_TRACKS_KEY,
      FAVORITE_ROOMS_KEY,
      LISTENING_STATS_KEY,
      APP_PREFERENCES_KEY,
    ];
    let totalBytes = 0;
    for (const key of keys) {
      const item = await AsyncStorage.getItem(key);
      if (item) totalBytes += item.length * 2; // rough UTF-16 bytes
    }
    return Math.max(1, Math.round(totalBytes / 1024));
  } catch {
    return 1;
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
