import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import { PlayerProvider, usePlayer } from '../audio/PlayerContext';
import { SocketProvider } from '../state/SocketContext';
import { ToastProvider } from '../components/ToastContext';
import { colors } from '../theme';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { NetworkGuard } from '../components/NetworkGuard';
import { SpotifyPlayerModal } from '../components/SpotifyPlayerModal';

import { Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { saveAuthToken } from '../api';
import { useAppHeartbeat } from '../utils/heartbeat';
import { useToast } from '../components/ToastContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function AuthBridge() {
  const toast = useToast();

  useEffect(() => {
    const handleUrl = async (rawUrl: string) => {
      if (!rawUrl || (!rawUrl.includes('token=') && !rawUrl.includes('error='))) return;
      const match = rawUrl.match(/[?&#]token=([^&#]+)/);
      if (match) {
        const token = decodeURIComponent(match[1]).replace(/\/+$/, '').trim();
        if (token) {
          try {
            await WebBrowser.dismissAuthSession();
          } catch {}
          const user = await saveAuthToken(token);
          if (user) {
            toast(`Signed in as ${user.display_name}`, 'success');
          }
        }
      } else if (rawUrl.includes('error=')) {
        try {
          await WebBrowser.dismissAuthSession();
        } catch {}
        toast('Discord sign-in was interrupted', 'error');
      }
    };

    void Linking.getInitialURL().then((url) => {
      if (url) void handleUrl(url);
    });

    const sub = Linking.addEventListener('url', (e) => {
      if (e.url) void handleUrl(e.url);
    });

    return () => {
      sub.remove();
    };
  }, [toast]);

  return null;
}

function NotificationBridge() {
  const { setPlayerModalOpen } = usePlayer();

  useEffect(() => {
    // 1. Cold start response handling
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response.notification.request.content.data as
          | { action?: string; roomId?: string }
          | undefined;
        if (data?.action === 'open_room' && data?.roomId) {
          if (data.roomId === 'solo') {
            setPlayerModalOpen(true);
            router.push('/');
          } else {
            router.push({ pathname: '/room/[id]', params: { id: data.roomId } });
          }
        }
      })
      .catch(() => {});

    // 2. Active background listener
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER ||
        !response.actionIdentifier
      ) {
        const data = response.notification.request.content.data as
          | { action?: string; roomId?: string }
          | undefined;
        if (data?.action === 'open_room' && data?.roomId) {
          if (data.roomId === 'solo') {
            setPlayerModalOpen(true);
            router.push('/');
          } else {
            router.push({ pathname: '/room/[id]', params: { id: data.roomId } });
          }
        }
      }
    });
    return () => {
      sub.remove();
    };
  }, [setPlayerModalOpen]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  useAppHeartbeat();
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      // Release native splash immediately since AppLoadingScreen continues the branded sequence
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bgBase }}>
      <PlayerProvider>
        <NotificationBridge />
        <SocketProvider>
          <ToastProvider>
            <AuthBridge />
            <NetworkGuard>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bgBase },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="offline/index" />
                <Stack.Screen name="room/[id]" />
                <Stack.Screen name="playlist/[id]" />
                <Stack.Screen name="profile/[id]" />
                <Stack.Screen name="legal/privacy" />
                <Stack.Screen name="legal/terms" />
              </Stack>

              {/* Global Spotify Player Modal */}
              <SpotifyPlayerModal />

              {/* Seamless animated branding loading overlay */}
              {!splashGone && (
                <AppLoadingScreen
                  isReady={Boolean(fontsLoaded)}
                  onFinished={() => setSplashGone(true)}
                />
              )}
            </NetworkGuard>
          </ToastProvider>
        </SocketProvider>
      </PlayerProvider>
    </GestureHandlerRootView>
  );
}
