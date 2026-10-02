/**
 * Room shell: RoomProvider + bottom tabs (Playing | Queue | Chat | People)
 * with the PWA's mini-player. Mirrors the PWA's <640px mobile layout.
 */
import React, { useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Tabs, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoomProvider, useRoom } from '../../../state/RoomContext';
import { FlyingReactions } from '../../../components/FlyingReactions';
import { LeaveModal } from '../../../components/Modals';
import { RoomTabBar } from '../../../components/RoomTabBar';
import { colors } from '../../../theme';
import { useState } from 'react';

function RoomGuards({ children }: { children: React.ReactNode }) {
  const { roomClosed, joinError } = useRoom();
  const [showLeave, setShowLeave] = useState(false);

  useEffect(() => {
    if (roomClosed) {
      Alert.alert('Room closed', 'The host closed this room.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [roomClosed]);

  useEffect(() => {
    if (joinError) {
      Alert.alert('Could not join', joinError, [
        { text: 'Retry', onPress: () => router.replace({ pathname: '/room/[id]', params: {} }) },
        { text: 'Back', onPress: () => router.back() },
      ]);
    }
  }, [joinError]);

  return (
    <>
      {children}
      <LeaveModal
        visible={showLeave}
        onClose={() => setShowLeave(false)}
        onConfirm={() => {
          setShowLeave(false);
          router.back();
        }}
      />
    </>
  );
}

export default function RoomLayout() {
  const { id, password } = useLocalSearchParams<{ id: string; password?: string }>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <RoomProvider roomId={id} password={password}>
        <RoomGuards>
          <Tabs
            tabBar={(props) => <RoomTabBar {...props} />}
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: colors.bgBase },
            }}
          >
            <Tabs.Screen name="player" options={{ title: 'Playing' }} />
            <Tabs.Screen name="queue" options={{ title: 'Queue' }} />
            <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
            <Tabs.Screen name="people" options={{ title: 'People' }} />
          </Tabs>
          <FlyingReactions />
        </RoomGuards>
      </RoomProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
});
