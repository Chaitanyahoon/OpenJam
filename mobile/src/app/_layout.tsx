import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
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
import { PlayerProvider } from '../audio/PlayerContext';
import { SocketProvider } from '../state/SocketContext';
import { ToastProvider } from '../components/ToastContext';
import { colors } from '../theme';
import { AppLoadingScreen } from '../components/AppLoadingScreen';
import { NetworkGuard } from '../components/NetworkGuard';

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

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

  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      // Release native splash immediately since AppLoadingScreen continues the branded sequence
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
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
            router.push('/room/solo');
          } else {
            router.push({ pathname: '/room/[id]', params: { id: data.roomId } });
          }
        }
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <PlayerProvider>
      <SocketProvider>
        <ToastProvider>
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
  );
}
