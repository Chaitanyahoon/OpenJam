/**
 * Push notifications via Expo Push Service.
 * Flow: request permission -> get Expo push token -> (TODO) send to backend
 * so it can notify this device (room started, mentions).
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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
  await Notifications.setNotificationChannelAsync('room-activity', {
    name: 'Room activity',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
  });
}

/** Returns the Expo push token, or null (simulator / denied). */
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
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {},
    );
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
