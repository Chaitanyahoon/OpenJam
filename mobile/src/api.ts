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
  host_name: string;
  host_avatar_url?: string | null;
  listener_count: number;
  is_private: boolean;
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
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  // keep display name so rejoin is one tap
}

export async function getRooms(): Promise<RoomSummary[]> {
  const data = await request<{ rooms: RoomSummary[] }>('/rooms');
  return data.rooms ?? [];
}

export async function createRoom(input: {
  name: string;
  password?: string;
  is_private?: boolean;
}): Promise<{ id: string; name: string }> {
  const data = await request<{ room: { id: string; name: string } }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      password: input.password || '',
      is_private: !!input.is_private,
    }),
  });
  return data.room;
}

export async function searchTracks(query: string): Promise<TrackSearchResult[]> {
  const data = await request<TrackSearchResult[]>(
    `/search?q=${encodeURIComponent(query)}`,
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Direct stream URL for a track. The backend 302-redirects to the CDN;
 * expo-audio follows redirects. Re-request on 403/expiry (stall recovery).
 */
export function streamUrl(videoId: string): string {
  return `${getBackendUrl()}/stream/${encodeURIComponent(videoId)}`;
}
