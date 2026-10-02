/**
 * Local "liked" tracks (favourites), mirroring the PWA's local favourites list.
 * Keyed by track_uri, persisted on-device only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'openjam:favourites';

async function read(): Promise<Record<string, { name: string; artist: string }>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function isFavourite(trackUri: string): Promise<boolean> {
  if (!trackUri) return false;
  const all = await read();
  return trackUri in all;
}

export async function toggleFavourite(
  trackUri: string,
  name: string,
  artist: string,
): Promise<boolean> {
  const all = await read();
  if (trackUri in all) {
    delete all[trackUri];
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
    return false;
  }
  all[trackUri] = { name, artist };
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
  return true;
}
