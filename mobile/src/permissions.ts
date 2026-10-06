/**
 * Permissions & App Storage Management.
 * Handles:
 * 1. Native Android OS Permission Dialogs for Notifications (POST_NOTIFICATIONS)
 *    and Media Audio/Storage (READ_MEDIA_AUDIO / READ_EXTERNAL_STORAGE).
 * 2. Sandboxed Storage Verification for offline playlist downloads & favorites.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const FIRST_LAUNCH_PERMISSIONS_KEY = '@openjam_first_launch_permissions_asked_v1';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface StorageInfo {
  type: 'sandboxed';
  description: string;
  isReady: boolean;
}

/** Check current notification permission status */
export async function getNotificationPermissionStatus(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status as PermissionState;
  } catch {
    return 'undetermined';
  }
}

/** Request notification permission for background audio & lock screen controls */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request native Android OS system permission dialogs on the very first app launch:
 * - Notifications (POST_NOTIFICATIONS) for lockscreen audio transport & background stream
 * - Music & Audio / Storage (READ_MEDIA_AUDIO / READ_EXTERNAL_STORAGE) for offline storage
 */
export async function requestFirstLaunchPermissions(): Promise<{
  notificationsGranted: boolean;
  storageGranted: boolean;
}> {
  try {
    const alreadyAsked = await AsyncStorage.getItem(FIRST_LAUNCH_PERMISSIONS_KEY);
    if (alreadyAsked === 'true') {
      return { notificationsGranted: true, storageGranted: true };
    }

    let notificationsGranted = false;
    let storageGranted = false;

    if (Platform.OS === 'android') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const permissionsToRequest: any[] = [];
      const apiLevel =
        typeof Platform.Version === 'number'
          ? Platform.Version
          : parseInt(String(Platform.Version), 10) || 30;

      // Android 13+ (API 33+)
      if (apiLevel >= 33) {
        if (PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        if (PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO);
        }
      } else {
        // Android 12 and below
        if (PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        }
        if (PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE) {
          permissionsToRequest.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }
      }

      if (permissionsToRequest.length > 0) {
        const results = await PermissionsAndroid.requestMultiple(permissionsToRequest);

        if (apiLevel >= 33) {
          notificationsGranted =
            results[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
            PermissionsAndroid.RESULTS.GRANTED;
          storageGranted =
            results[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;
        } else {
          storageGranted =
            results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
            PermissionsAndroid.RESULTS.GRANTED;
          notificationsGranted = true;
        }
      }
    }

    // Ensure expo-notifications permission state is also synced
    try {
      const notifRes = await Notifications.requestPermissionsAsync();
      if (notifRes.status === 'granted') {
        notificationsGranted = true;
      }
    } catch {}

    await AsyncStorage.setItem(FIRST_LAUNCH_PERMISSIONS_KEY, 'true');
    return { notificationsGranted, storageGranted };
  } catch (err) {
    console.warn('Error requesting first launch permissions:', err);
    return { notificationsGranted: false, storageGranted: false };
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
