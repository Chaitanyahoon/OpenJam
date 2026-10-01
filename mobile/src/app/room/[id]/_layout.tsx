/**
 * Room shell: RoomProvider + bottom tabs (Queue | Player | Chat).
 * Mirrors the PWA's <640px mobile layout (APP_FLOW.md §2.1).
 */
import React, { useEffect } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Tabs, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RoomProvider, useRoom } from '../../../state/RoomContext';
import { FlyingReactions } from '../../../components/FlyingReactions';
import { LeaveModal } from '../../../components/Modals';
import { colors, TAB_BAR_HEIGHT } from '../../../theme';
import { useState } from 'react';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>
  );
}

function RoomGuards({ children }: { children: React.ReactNode }) {
  const { roomClosed, joinError, roomName } = useRoom();
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
            screenOptions={{
              headerShown: false,
              tabBarStyle: styles.tabBar,
              tabBarActiveTintColor: colors.amber,
              tabBarInactiveTintColor: colors.text3,
              tabBarLabelStyle: styles.tabLabel,
              sceneStyle: { backgroundColor: colors.bgBase },
            }}
          >
            <Tabs.Screen
              name="queue"
              options={{
                title: 'Queue',
                tabBarIcon: ({ focused }) => <TabIcon glyph="▤" focused={focused} />,
              }}
            />
            <Tabs.Screen
              name="player"
              options={{
                title: 'Player',
                tabBarIcon: ({ focused }) => <TabIcon glyph="◉" focused={focused} />,
              }}
            />
            <Tabs.Screen
              name="chat"
              options={{
                title: 'Chat',
                tabBarIcon: ({ focused }) => <TabIcon glyph="💬" focused={focused} />,
              }}
            />
          </Tabs>
          <FlyingReactions />
        </RoomGuards>
      </RoomProvider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  tabBar: {
    height: TAB_BAR_HEIGHT + 8,
    backgroundColor: 'rgba(14, 14, 18, 0.92)',
    borderTopWidth: 1,
    borderTopColor: colors.borderAmber,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 11, fontFamily: 'Poppins_500Medium' },
  icon: { fontSize: 22, color: colors.text3 },
  iconFocused: { color: colors.amber },
});
