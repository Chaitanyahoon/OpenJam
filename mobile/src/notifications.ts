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

// Media playback notification constants
export const MEDIA_NOTIFICATION_ID = 'openjam-media-playback';
export const MEDIA_CHANNEL_ID = 'openjam-media-playback-channel';
export const MEDIA_CATEGORY_ID = 'openjam-media-category';
export const MEDIA_CATEGORY_PLAYING = 'openjam-media-category-playing';
export const MEDIA_CATEGORY_PAUSED = 'openjam-media-category-paused';

export const MEDIA_ACTIONS = {
  PREV: 'ACTION_PREV',
  PLAY_PAUSE: 'ACTION_PLAY_PAUSE',
  NEXT: 'ACTION_NEXT',
} as const;

let mediaChannelConfigured = false;

export async function setupMediaPlaybackNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (mediaChannelConfigured) return;
  try {
    await Notifications.setNotificationChannelAsync(MEDIA_CHANNEL_ID, {
      name: 'OpenJam Music Playback',
      importance: Notifications.AndroidImportance.LOW,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: null,
      enableVibrate: false,
      showBadge: false,
    });

    // Playing category (shows Pause button)
    await Notifications.setNotificationCategoryAsync(MEDIA_CATEGORY_PLAYING, [
      {
        identifier: MEDIA_ACTIONS.PREV,
        buttonTitle: 'Previous',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.PLAY_PAUSE,
        buttonTitle: 'Pause',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.NEXT,
        buttonTitle: 'Next',
        options: { opensAppToForeground: false },
      },
    ]);

    // Paused category (shows Play button)
    await Notifications.setNotificationCategoryAsync(MEDIA_CATEGORY_PAUSED, [
      {
        identifier: MEDIA_ACTIONS.PREV,
        buttonTitle: 'Previous',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.PLAY_PAUSE,
        buttonTitle: 'Play',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.NEXT,
        buttonTitle: 'Next',
        options: { opensAppToForeground: false },
      },
    ]);

    // Base category for backward compatibility
    await Notifications.setNotificationCategoryAsync(MEDIA_CATEGORY_ID, [
      {
        identifier: MEDIA_ACTIONS.PREV,
        buttonTitle: 'Previous',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.PLAY_PAUSE,
        buttonTitle: 'Play/Pause',
        options: { opensAppToForeground: false },
      },
      {
        identifier: MEDIA_ACTIONS.NEXT,
        buttonTitle: 'Next',
        options: { opensAppToForeground: false },
      },
    ]);

    mediaChannelConfigured = true;
  } catch (err) {
    console.warn('[notifications] Failed to configure media playback channel:', err);
  }
}

export interface MediaNotificationMeta {
  title: string;
  artist?: string;
  isPlaying: boolean;
  roomId?: string;
  artworkUrl?: string;
}

let lastNotificationState = '';

export async function updateMediaNotification(meta: MediaNotificationMeta): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (!meta.title) {
    await dismissMediaNotification();
    return;
  }

  // Deduplicate identical successive notification calls
  const stateKey = `${meta.title}::${meta.artist}::${meta.isPlaying}::${meta.roomId}`;
  if (stateKey === lastNotificationState) return;
  lastNotificationState = stateKey;

  try {
    await setupMediaPlaybackNotification();

    const subtext = meta.artist
      ? (meta.isPlaying ? meta.artist : `${meta.artist} • Paused`)
      : (meta.isPlaying ? 'Streaming on OpenJam' : 'Paused');

    await Notifications.scheduleNotificationAsync({
      identifier: MEDIA_NOTIFICATION_ID,
      content: {
        title: meta.title,
        body: subtext,
        subtitle: meta.roomId ? 'Jam Room' : 'Solo Jam',
        categoryIdentifier: meta.isPlaying ? MEDIA_CATEGORY_PLAYING : MEDIA_CATEGORY_PAUSED,
        sticky: meta.isPlaying,
        autoDismiss: false,
        color: '#ff9f1c',
        data: {
          action: 'open_room',
          roomId: meta.roomId || 'solo',
        },
      },
      trigger: null,
    });
  } catch (err) {
    // Graceful fallback if background notification permission denied
  }
}

export async function dismissMediaNotification(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  lastNotificationState = '';
  try {
    await Notifications.dismissNotificationAsync(MEDIA_NOTIFICATION_ID);
  } catch {}
}

export type MediaActionCallback = (action: 'prev' | 'play_pause' | 'next') => void;
const mediaActionListeners = new Set<MediaActionCallback>();
let globalResponseSub: Notifications.EventSubscription | null = null;

export function registerMediaActionListener(callback: MediaActionCallback): () => void {
  mediaActionListeners.add(callback);

  if (!globalResponseSub && (Platform.OS === 'android' || Platform.OS === 'ios')) {
    try {
      globalResponseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const actionId = response.actionIdentifier;
        let action: 'prev' | 'play_pause' | 'next' | null = null;
        if (actionId === MEDIA_ACTIONS.PREV) action = 'prev';
        else if (actionId === MEDIA_ACTIONS.PLAY_PAUSE) action = 'play_pause';
        else if (actionId === MEDIA_ACTIONS.NEXT) action = 'next';

        if (action) {
          for (const listener of mediaActionListeners) {
            try {
              listener(action);
            } catch (err) {
              console.warn('[notifications] Media listener error:', err);
            }
          }
        }
      });
    } catch {}
  }

  return () => {
    mediaActionListeners.delete(callback);
    if (mediaActionListeners.size === 0 && globalResponseSub) {
      try {
        globalResponseSub.remove();
      } catch {}
      globalResponseSub = null;
    }
  };
}
