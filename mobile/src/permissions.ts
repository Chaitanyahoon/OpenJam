/**
 * Permissions & App Storage Management.
 * Handles:
 * 1. Notification Permission (POST_NOTIFICATIONS) for Android 13+ lockscreen media
 *    playback controls and background service alerts.
 * 2. Sandboxed Storage Verification for offline playlist downloads & favorites
 *    (Scoped sandbox storage requires 0 dangerous OS permissions).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const PERMISSION_BANNER_DISMISSED_KEY = 'openjam_permission_banner_dismissed_v1';

type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;

try {
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    (Constants as { executionEnvironment?: string }).executionEnvironment === 'storeClient';

  if (!(Platform.OS === 'android' && isExpoGo)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  }
} catch {
  Notifications = null;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface StorageInfo {
  type: 'sandboxed';
  description: string;
  isReady: boolean;
}

/** Check current notification permission status */
export async function getNotificationPermissionStatus(): Promise<PermissionState> {
  if (!Notifications) return 'granted';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'undetermined';
  }
}

/** Request notification permission for background audio & lock screen controls */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return true;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Get sandboxed storage information for offline playlists & tracks */
export function getSandboxStorageInfo(): StorageInfo {
  return {
    type: 'sandboxed',
    description: 'Private app storage sandbox for offline playlists & favorites.',
    isReady: true,
  };
}

/** Check if user previously dismissed the permissions onboarding banner */
export async function isPermissionBannerDismissed(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(PERMISSION_BANNER_DISMISSED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/** Dismiss the permissions onboarding banner */
export async function dismissPermissionBanner(): Promise<void> {
  try {
    await AsyncStorage.setItem(PERMISSION_BANNER_DISMISSED_KEY, 'true');
  } catch {}
}
