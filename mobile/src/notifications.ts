/**
 * Push notifications via Expo Push Service.
 * Flow: request permission -> get Expo push token -> (TODO) send to backend
 * so it can notify this device (room started, mentions).
 *
 * NOTE: Starting in Expo SDK 53, Android push notifications (remote notifications)
 * via expo-notifications are removed from Expo Go and will throw an error
 * at import time. This module safely guards against Expo Go on Android so development
 * and testing in Expo Go work without crashing the app.
 */
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getBackendUrl } from './config';
import { getStoredSession } from './api';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

try {
  const isExpoGo =
    Constants.appOwnership === 'expo' ||
    (Constants as { executionEnvironment?: string }).executionEnvironment === 'storeClient';

  if (!(Platform.OS === 'android' && isExpoGo)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
} catch {
  Notifications = null;
}

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('room-activity', {
      name: 'Room activity',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (e) {
    console.warn('[notifications] Failed to setup android channel:', e);
  }
}

/** Returns the Expo push token, or null (simulator / denied / Expo Go on Android). */
export async function registerPushToken(): Promise<string | null> {
  try {
    if (!Notifications || !Device.isDevice) return null;
    await setupAndroidChannel();
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status } =
      existing === 'granted'
        ? { status: existing }
        : await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId || projectId === '00000000-0000-0000-0000-000000000000') {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    // Best-effort: hand the token to the backend if it accepts it.
    try {
      const { token: sessionToken } = await getStoredSession();
      await fetch(`${getBackendUrl()}/push/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({ expo_push_token: token.data, platform: Platform.OS }),
      });
    } catch {
      // backend has no push endpoint yet — token is ready when it does
    }
    return token.data;
  } catch {
    return null;
  }
}
