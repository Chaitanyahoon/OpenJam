/**
 * Landing screen — minimalist: wordmark, live count, one headline,
 * one amber action, hairline room rows.
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

  const startRoom = () => {
    if (user) setShowCreate(true);
    else setShowIdentity(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>
            Open<Text style={styles.logoAmber}>Jam</Text>
          </Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>
              {rooms.length} room{rooms.length === 1 ? '' : 's'} live now
            </Text>
          </View>
        </View>

        <Text style={styles.headline}>Listen together, in sync.</Text>

        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          onPress={startRoom}
        >
          <Text style={styles.ctaText}>Start a room</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>Live rooms</Text>

        <FlatList
          data={rooms}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <RoomCard room={item} onPress={() => handleRoomPress(item)} />
          )}
          ListEmptyComponent={
            ready ? (
              <Text style={styles.empty}>
                No rooms live right now — start one above.
              </Text>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} />
          }
          contentContainerStyle={styles.listContent}
        />

        <Pressable onPress={startRoom} hitSlop={12} style={styles.newRoom}>
          <Text style={styles.newRoomText}>+ New room</Text>
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
  container: { flex: 1, paddingHorizontal: spacing.lg },
  hero: { paddingTop: spacing.lg },
  logo: {
    fontFamily: fontFamily.displayBold,
    fontSize: 28,
    color: colors.text1,
    letterSpacing: 0.5,
  },
  logoAmber: { color: colors.amber },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },
  liveText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
  },
  headline: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 30,
    color: colors.text1,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    lineHeight: 36,
  },
  cta: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 17,
    color: '#08080a',
  },
  sectionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text3,
    marginTop: spacing.xl,
  },
  listContent: { paddingBottom: spacing.md },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    color: colors.text3,
    marginTop: spacing.lg,
    fontSize: 14,
  },
  newRoom: { paddingVertical: spacing.lg },
  newRoomText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: colors.amber,
  },
});
