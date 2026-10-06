/**
 * Push notifications via Expo Push Service.
 * Native standalone module: requests permissions, configures Android channel,
 * and fetches the Expo push token for backend sync.
 */
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getBackendUrl } from './config';
import { getStoredSession } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
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

/** Returns the Expo push token, or null if running on simulator or denied. */
export async function registerPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
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
