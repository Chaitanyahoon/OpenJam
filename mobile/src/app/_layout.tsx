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

  if (!fontsLoaded) return null;

  return (
    <PlayerProvider>
      <SocketProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bgBase },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
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
        </ToastProvider>
      </SocketProvider>
    </PlayerProvider>
  );
}
