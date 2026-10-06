import type { ExpoConfig } from 'expo/config';

/**
 * OpenJam mobile — dynamic Expo config.
 *
 * After `npx eas-cli@latest init`, EAS fills in extra.eas.projectId and the
 * updates URL. Until then the placeholders below keep local dev working.
 */
const config: ExpoConfig = {
  name: 'OpenJam',
  slug: 'openjam-mobile',
  version: '1.0.2',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'openjam',
  userInterfaceStyle: 'dark',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'fun.openjam.app',
    adaptiveIcon: {
      backgroundColor: '#08080a',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      'android.permission.WAKE_LOCK',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.POST_NOTIFICATIONS',
    ],
  },
  plugins: [
    'expo-router',
    // Background audio: wires UIBackgroundModes + Android foreground service
    // (FOREGROUND_SERVICE_MEDIA_PLAYBACK, mediaPlayback type for API 34+).
    ['expo-audio', { enableBackgroundPlayback: true }],
    'expo-notifications',
    'expo-asset',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#08080a',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  updates: {
    // Replaced with your real project id by `eas init`.
    url: 'https://u.expo.dev/00000000-0000-0000-0000-000000000000',
  },
  runtimeVersion: { policy: 'appVersion' },
  extra: {
    eas: {
      // Replaced with your real project id by `eas init`.
      projectId: '00000000-0000-0000-0000-000000000000',
    },
  },
};

export default config;
