/**
 * Landing screen — hero, room list, create-room flow.
 * Mirrors the PWA home (HeroSection + RoomCard list).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { fontFamily } from '../fonts';
import {
  getRooms,
  getStoredSession,
  joinAsGuest,
  type ApiUser,
  type RoomSummary,
} from '../api';
import { useSocket } from '../state/SocketContext';
import { RoomCard } from '../components/RoomCard';
import { Title, Subtitle } from '../components/ui';
import {
  CreateRoomModal,
  IdentityModal,
  RoomPasswordModal,
} from '../components/Modals';
import { registerPushToken } from '../notifications';

export default function Landing() {
  const { connect } = useSocket();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pwRoom, setPwRoom] = useState<RoomSummary | null>(null);
  const [ready, setReady] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await getRooms());
    } catch {
      // backend unreachable — rooms stay empty, user can retry
    }
  }, []);

  useEffect(() => {
    (async () => {
      const session = await getStoredSession();
      if (!session.token) {
        setShowIdentity(true);
      } else {
        setUser(session.user);
        await connect();
        registerPushToken().catch(() => {});
      }
      await loadRooms();
      setReady(true);
    })();
  }, [connect, loadRooms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRooms();
    setRefreshing(false);
  }, [loadRooms]);

  const handleIdentity = async (displayName: string) => {
    const { user: u } = await joinAsGuest(displayName);
    setUser(u);
    setShowIdentity(false);
    await connect();
    registerPushToken().catch(() => {});
  };

  const openRoom = (room: RoomSummary, password = '') => {
    router.push({
      pathname: '/room/[id]',
      params: { id: room.id, ...(password ? { password } : {}) },
    });
  };

  const handleRoomPress = (room: RoomSummary) => {
    if (room.is_private) setPwRoom(room);
    else openRoom(room);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>
            Open<Text style={styles.logoAmber}>Jam</Text>
          </Text>
          <Subtitle>Hear it together — at the exact same millisecond.</Subtitle>
          {user ? (
            <Text style={styles.welcome}>Jamming as {user.display_name}</Text>
          ) : null}
        </View>

        <View style={styles.listHeader}>
          <Title>Live rooms</Title>
        </View>

        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => handleRoomPress(item)} />
          )}
          ListEmptyComponent={
            ready ? (
              <Text style={styles.empty}>
                No rooms live right now — create one and invite your friends.
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
          }
          contentContainerStyle={styles.listContent}
        />

        <Pressable
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => (user ? setShowCreate(true) : setShowIdentity(true))}
        >
          <Text style={styles.fabText}>＋</Text>
        </Pressable>

        <IdentityModal visible={showIdentity} onDone={handleIdentity} />
        <CreateRoomModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(roomId) => {
            setShowCreate(false);
            router.push({ pathname: '/room/[id]', params: { id: roomId } });
          }}
        />
        <RoomPasswordModal
          visible={!!pwRoom}
          roomName={pwRoom?.name ?? ''}
          onClose={() => setPwRoom(null)}
          onSubmit={(password) => {
            const room = pwRoom;
            setPwRoom(null);
            if (room) openRoom(room, password);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  container: { flex: 1, paddingHorizontal: spacing.md },
  hero: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  logo: {
    fontFamily: fontFamily.displayBold,
    fontSize: 38,
    color: colors.text1,
    letterSpacing: 0.5,
  },
  logoAmber: { color: colors.amber },
  welcome: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.green,
    marginTop: spacing.sm,
  },
  listHeader: { marginBottom: spacing.sm },
  listContent: { paddingBottom: 96 },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    color: colors.text3,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
  fabText: { fontSize: 28, color: '#08080a', marginTop: -2 },
});
