/**
 * REST client for the OpenJam backend (FastAPI).
 * Endpoint shapes mirror docs/API_DOCUMENTATION.md.
 *
 * Auth: POST /auth/join { display_name } -> { user, token }.
 * The token is sent as `Authorization: Bearer <token>` (the backend also
 * accepts it as a session_token cookie; mobile uses the header).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBackendUrl } from './config';
export { getBackendUrl };

const TOKEN_KEY = 'openjam_token';
const USER_KEY = 'openjam_user';
const NAME_KEY = 'openjam_display_name';

export interface ApiUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_registered: boolean;
  discord_id?: string | null;
  discord_username?: string | null;
}

export interface RoomSummary {
  id: string;
  name: string;
  description?: string;
  host_name: string;
  host_avatar_url?: string | null;
  listener_count: number;
  is_private: boolean;
  genre_tags?: string[];
  current_track?: {
    track_name: string;
    artist: string;
    album_art_url?: string;
  } | null;
  now_playing?: {
    track_name: string;
    artist: string;
    album_art_url?: string;
  } | null;
}

export interface TrackSearchResult {
  uri: string;
  name: string;
  artist: string;
  album_art_url?: string;
  duration_ms?: number;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getBackendUrl()}${path}`, {
    ...(init || {}),
    headers: { ...(await authHeaders()), ...(init?.headers || {}) },
  });
  if (res.status === 401) {
    // Purge expired or invalid token to avoid permanent socket authentication loops
    await clearSession().catch(() => {});
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Create (or refresh) an anonymous guest session. Persists token + user. */
export async function joinAsGuest(
  displayName: string,
): Promise<{ user: ApiUser; token: string }> {
  const res = await fetch(`${getBackendUrl()}/auth/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!res.ok) throw new Error('Could not create guest session');
  const data = (await res.json()) as { user: ApiUser; token: string };
  await AsyncStorage.multiSet([
    [TOKEN_KEY, data.token],
    [USER_KEY, JSON.stringify(data.user)],
    [NAME_KEY, data.user.display_name],
  ]);
  return data;
}

export async function fetchMe(): Promise<ApiUser | null> {
  try {
    const data = await request<{ user: ApiUser | null }>('/auth/me');
    if (data && data.user) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      if (data.user.display_name) {
        await AsyncStorage.setItem(NAME_KEY, data.user.display_name);
      }
      return data.user;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAuthToken(token: string): Promise<ApiUser | null> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return await fetchMe();
}

export async function getStoredSession(): Promise<{
  token: string | null;
  user: ApiUser | null;
  displayName: string | null;
}> {
  const [token, userJson, displayName] = await AsyncStorage.multiGet([
    TOKEN_KEY,
    USER_KEY,
    NAME_KEY,
  ]).then((pairs) => pairs.map(([, v]) => v));
  return {
    token,
    user: userJson ? (JSON.parse(userJson) as ApiUser) : null,
    displayName,
  };
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, NAME_KEY]);
}

export const COMMUNITY_ROOMS: RoomSummary[] = [
  {
    id: 'openjam-lounge',
    name: '24/7 Lofi & Chill Lounge',
    description: 'OpenJam Official Community Lounge — synchronized chill beats 24/7.',
    host_name: 'OpenJam Radio',
    listener_count: 24,
    is_private: false,
    genre_tags: ['lofi', 'chill', 'beats'],
    now_playing: {
      track_name: 'Midnight Dreams',
      artist: 'Kalaido & Lofi Beats',
      album_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500',
    },
  },
  {
    id: 'synthwave-station',
    name: 'Synthwave Sunset',
    description: 'Neon retro driving beats synced across the world.',
    host_name: 'RetroWave FM',
    listener_count: 17,
    is_private: false,
    genre_tags: ['synthwave', 'electronic', 'neon'],
    now_playing: {
      track_name: 'Resonance & Retrowave',
      artist: 'HOME & Synth Beats',
      album_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500',
    },
  },
  {
    id: 'the-aux-cord',
    name: 'The Aux Cord (Open Deck)',
    description: 'Anyone can queue tracks. Free-for-all listening room.',
    host_name: 'Open Jammer',
    listener_count: 11,
    is_private: false,
    genre_tags: ['hiphop', 'r&b', 'indie'],
    now_playing: {
      track_name: 'Blinding Lights',
      artist: 'The Weeknd',
      album_art_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
    },
  },
];

export async function getRooms(): Promise<RoomSummary[]> {
  try {
    const data = await request<{ rooms: any[] }>('/rooms');
    const liveRooms = (data.rooms ?? []).map((r) => ({
      ...r,
      now_playing: r.now_playing || r.current_track || null,
      genre_tags: r.genre_tags && r.genre_tags.length > 0 ? r.genre_tags : ['music', 'live'],
    }));

    if (liveRooms.length === 0) {
      return COMMUNITY_ROOMS;
    }

    const hasLounge = liveRooms.some((r: RoomSummary) => r.id === 'openjam-lounge');
    if (!hasLounge) {
      return [COMMUNITY_ROOMS[0], ...liveRooms];
    }
    return liveRooms;
  } catch (err) {
    return COMMUNITY_ROOMS;
  }
}

export async function createRoom(input: {
  name: string;
  description?: string;
  password?: string;
  is_private?: boolean;
  genre_tags?: string[];
  allow_guest_controls?: boolean;
}): Promise<{ id: string; name: string }> {
  const data = await request<{ room: { id: string; name: string } }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description || '',
      password: input.password || '',
      is_private: !!input.is_private,
      genre_tags: input.genre_tags || [],
      allow_guest_controls: !!input.allow_guest_controls,
    }),
  });
  return data.room;
}

export async function updateRoom(
  roomId: string,
  input: {
    name?: string;
    description?: string;
    genre_tags?: string[];
    allow_guest_controls?: boolean;
  },
): Promise<{ id: string; name: string; genre_tags?: string[]; allow_guest_controls?: boolean }> {
  const data = await request<{
    room: { id: string; name: string; genre_tags?: string[]; allow_guest_controls?: boolean };
  }>(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return data.room;
}

export async function deleteRoom(roomId: string): Promise<void> {
  await request<{ message: string }>(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
  });
}

export async function searchTracks(query: string): Promise<TrackSearchResult[]> {
  try {
    const data = await request<{ tracks?: TrackSearchResult[] } | TrackSearchResult[]>(
      `/search/tracks?q=${encodeURIComponent(query)}`,
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.tracks)) return data.tracks;
    return [];
  } catch {
    return [];
  }
}

/**
 * Direct stream URL for a track. The backend 302-redirects to the CDN;
 * expo-audio follows redirects. Re-request on 403/expiry (stall recovery).
 */
export function streamUrl(videoId: string): string {
  return `${getBackendUrl()}/stream/${encodeURIComponent(videoId)}`;
}
