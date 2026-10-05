/**
 * Room shell: RoomProvider + bottom tabs (Playing | Queue | Chat | People)
 * with the PWA's mini-player. Mirrors the PWA's <640px mobile layout.
 *
 * Includes a room header bar with back navigation, share, and leave —
 * matching the PWA's sticky room header.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, BackHandler, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Share2, X, Bookmark } from 'lucide-react-native';
import { RoomProvider, useRoom } from '../../../state/RoomContext';
import { FlyingReactions } from '../../../components/FlyingReactions';
import { LeaveModal } from '../../../components/Modals';
import { RoomTabBar } from '../../../components/RoomTabBar';
import { initials, nameColor } from '../../../components/ChatPanel';
import { colors, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { isRoomFavorited, toggleFavoriteRoom } from '../../../storage/history';
import { useToast } from '../../../components/ToastContext';
import { hapticLight } from '../../../utils/haptics';

/** Context so child screens can trigger the leave modal */
const LeaveCtx = createContext<() => void>(() => {});
export function useLeave() {
  return useContext(LeaveCtx);
}

const InitialNameCtx = createContext<string>('');

function RoomHeader() {
  const { roomName, roomId, listeners, syncReady } = useRoom();
  const initialName = useContext(InitialNameCtx);
  const triggerLeave = useLeave();
  const toast = useToast();
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (roomId) {
      void isRoomFavorited(roomId).then(setFavorited);
    }
  }, [roomId]);

  const handleToggleBookmark = async () => {
    const isNowFav = await toggleFavoriteRoom({
      id: roomId,
      name: displayName,
      hostName,
    });
    setFavorited(isNowFav);
    void hapticLight();
    toast(
      isNowFav ? `Pinned "${displayName}" to Saved Rooms` : `Unpinned "${displayName}"`,
      'info',
    );
  };

  const shareRoom = useCallback(async () => {
    try {
      await Share.share({
        message: `Join me on OpenJam!\nhttps://www.openjam.fun/room/${roomId}`,
        title: `OpenJam – ${roomName || initialName || 'Live Room'}`,
      });
    } catch {
      // user cancelled
    }
  }, [roomId, roomName, initialName]);

  const displayName = roomName || initialName || 'OpenJam Room';
  const host = listeners.find((l) => l.is_host);
  const hostName = host?.user_name || 'Host';

  return (
    <View style={styles.header}>
      {/* Back / Leave button */}
      <Pressable
        onPress={() => triggerLeave()}
        hitSlop={14}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        accessibilityLabel="Leave room"
      >
        <ChevronLeft size={22} color={colors.text1} />
      </Pressable>

      {/* Room info with strict truncation */}
      <View style={styles.headerCenter}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.liveIndicatorDot,
              { backgroundColor: syncReady ? colors.green : colors.amber },
            ]}
          />
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {displayName}
          </Text>
        </View>

        <View style={styles.headerMeta}>
          {host?.avatar_url ? (
            <Image source={{ uri: host.avatar_url }} style={styles.hostMiniAvatar} />
          ) : (
            <View style={[styles.hostMiniFallback, { backgroundColor: nameColor(hostName) }]}>
              <Text style={styles.hostMiniInitials}>{initials(hostName)}</Text>
            </View>
          )}
          <Text style={styles.headerSub} numberOfLines={1} ellipsizeMode="tail">
            DJ <Text style={styles.hostBold}>{hostName}</Text> • {listeners.length} listening
          </Text>
        </View>
      </View>

      {/* Right actions: Bookmark + Share (Icon-only) */}
      <View style={styles.headerActions}>
        <Pressable
          onPress={handleToggleBookmark}
          hitSlop={12}
          style={({ pressed }) => [
            styles.actionIconBtn,
            favorited && styles.actionIconBtnActive,
            pressed && styles.pressed,
          ]}
          accessibilityLabel={favorited ? 'Unpin room' : 'Pin room to favorites'}
        >
          <Bookmark
            size={16}
            color={favorited ? colors.amber : colors.text2}
            fill={favorited ? colors.amber : 'transparent'}
          />
        </Pressable>

        <Pressable
          onPress={shareRoom}
          hitSlop={12}
          style={({ pressed }) => [styles.actionIconBtn, pressed && styles.pressed]}
          accessibilityLabel="Share room"
        >
          <Share2 size={16} color={colors.text2} />
        </Pressable>
      </View>
    </View>
  );
}

function RoomGuards({ children }: { children: React.ReactNode }) {
  const { roomClosed, joinError } = useRoom();
  const [showLeave, setShowLeave] = useState(false);

  // Android hardware back → show leave modal instead of instant exit; dismiss if open
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showLeave) {
        setShowLeave(false);
        return true;
      }
      setShowLeave(true);
      return true; // prevent default back
    });
    return () => sub.remove();
  }, [showLeave]);

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
        { text: 'Back', onPress: () => router.back() },
      ]);
    }
  }, [joinError]);

  return (
    <LeaveCtx.Provider value={() => setShowLeave(true)}>
      <RoomHeader />
      {children}
      <LeaveModal
        visible={showLeave}
        onClose={() => setShowLeave(false)}
        onConfirm={() => {
          setShowLeave(false);
          router.back();
        }}
      />
    </LeaveCtx.Provider>
  );
}

export default function RoomLayout() {
  const params = useLocalSearchParams<{ id: string; name?: string; password?: string }>();
  // Normalize: expo-router can return string[] for dynamic segments on deep links
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const initialName = Array.isArray(params.name) ? params.name[0] : (params.name ?? '');
  const password = Array.isArray(params.password) ? params.password[0] : params.password;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <InitialNameCtx.Provider value={initialName}>
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
      </InitialNameCtx.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: '#0c0c12',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 16,
    color: colors.text1,
    fontFamily: fontFamily.displayBold,
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  headerTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 15,
    color: colors.text1,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  hostMiniAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  hostMiniFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostMiniInitials: {
    fontSize: 7,
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
  },
  hostBold: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.text2,
  },
  headerSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.16)',
    borderColor: 'rgba(255, 159, 28, 0.38)',
  },
  pressed: {
    opacity: 0.7,
  },
});
