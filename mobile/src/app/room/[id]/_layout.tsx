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
import { ChevronLeft, Share2, X, Bookmark, Copy } from 'lucide-react-native';
import { copyToClipboard } from '../../../utils/clipboard';
import { RoomProvider, useRoom } from '../../../state/RoomContext';
import { usePlayer } from '../../../audio/PlayerContext';
import type { TrackInfo } from '../../../sync/protocol';
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
  const { roomName, roomId, listeners, syncReady, connectionState } = useRoom();
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

  const handleCopyCode = async () => {
    void hapticLight();
    const ok = await copyToClipboard(roomId);
    if (ok) {
      toast(`Room code "#${roomId}" copied! Share with friends.`, 'success');
    } else {
      toast(`Room code is #${roomId}`, 'info');
    }
  };

  const isSolo = roomId === 'solo' || roomId.startsWith('solo');
  const displayName = isSolo ? 'Solo Jam' : roomName || initialName || 'OpenJam Room';

  const shareRoom = useCallback(async () => {
    try {
      await Share.share({
        message: isSolo
          ? 'Jamming on OpenJam! Check it out: https://www.openjam.fun'
          : `Join my live room "${displayName}" on OpenJam!\nRoom Code: #${roomId}\nLink: https://www.openjam.fun/room/${roomId}`,
        title: `OpenJam – ${displayName}`,
      });
    } catch {
      // user cancelled
    }
  }, [roomId, displayName, isSolo]);
  const host = listeners.find((l) => l.is_host);
  const hostName = isSolo ? 'You' : host?.user_name || 'Host';

  const indicatorColor = isSolo
    ? colors.amber
    : connectionState === 'connected' && syncReady
      ? colors.green
      : connectionState === 'offline'
        ? colors.red
        : colors.amber;

  return (
    <View style={styles.header}>
      {/* Back / Leave button */}
      <Pressable
        onPress={() => {
          if (isSolo) {
            router.replace('/');
          } else {
            triggerLeave();
          }
        }}
        hitSlop={14}
        style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
        accessibilityLabel={isSolo ? 'Return home' : 'Leave room'}
      >
        <ChevronLeft size={22} color={colors.text1} />
      </Pressable>

      {/* Room info with strict truncation */}
      <View style={styles.headerCenter}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.liveIndicatorDot,
              { backgroundColor: indicatorColor },
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
            <View style={[styles.hostMiniFallback, { backgroundColor: isSolo ? colors.amber : nameColor(hostName) }]}>
              <Text style={styles.hostMiniInitials}>{isSolo ? 'SJ' : initials(hostName)}</Text>
            </View>
          )}
          <Text style={styles.headerSub} numberOfLines={1} ellipsizeMode="tail">
            {isSolo ? (
              <Text style={styles.hostBold}>Personal Mode • Instant Play</Text>
            ) : (
              <>DJ <Text style={styles.hostBold}>{hostName}</Text> • {listeners.length} listening</>
            )}
          </Text>
        </View>
      </View>

      {/* Right actions: Copy Code + Bookmark + Share */}
      <View style={styles.headerActions}>
        {!isSolo && (
          <Pressable
            onPress={handleCopyCode}
            hitSlop={10}
            style={({ pressed }) => [styles.headerCodePill, pressed && styles.pressed]}
            accessibilityLabel={`Copy room code #${roomId}`}
          >
            <Copy size={11} color={colors.amber} />
            <Text style={styles.headerCodePillText} numberOfLines={1}>
              #{roomId.slice(0, 8)}
            </Text>
          </Pressable>
        )}

        {!isSolo && (
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
        )}

        <Pressable
          onPress={shareRoom}
          hitSlop={12}
          style={({ pressed }) => [styles.actionIconBtn, pressed && styles.pressed]}
          accessibilityLabel={isSolo ? 'Share OpenJam' : 'Share room'}
        >
          <Share2 size={16} color={colors.text2} />
        </Pressable>
      </View>
    </View>
  );
}

function RoomGuards({ children }: { children: React.ReactNode }) {
  const { roomClosed, joinError, retryJoin, roomId, nowPlaying, queue } = useRoom();
  const player = usePlayer();
  const toast = useToast();
  const [showLeave, setShowLeave] = useState(false);
  const isSolo = roomId === 'solo' || roomId.startsWith('solo');

  // Android hardware back → show leave modal instead of instant exit; dismiss if open
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSolo) {
        router.replace('/');
        return true;
      }
      if (showLeave) {
        setShowLeave(false);
        return true;
      }
      setShowLeave(true);
      return true; // prevent default back
    });
    return () => sub.remove();
  }, [showLeave, isSolo]);

  useEffect(() => {
    if (roomClosed) {
      Alert.alert('Room closed', 'The host closed this room.', [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }, [roomClosed]);

  useEffect(() => {
    if (joinError) {
      Alert.alert('Could not join', joinError, [
        { text: 'Retry', onPress: () => retryJoin() },
        { text: 'Back', onPress: () => router.replace('/'), style: 'cancel' },
      ]);
    }
  }, [joinError, retryJoin]);

  const handleContinueSolo = () => {
    setShowLeave(false);
    if (nowPlaying) {
      const currentPos = player.positionMs();
      const remainingTracks = queue
        .map((q) => ((q as any).track ? (q as any).track : (q as TrackInfo)))
        .filter((t) => t.track_uri !== nowPlaying.track_uri);
      void player.playTrack(nowPlaying, [nowPlaying, ...remainingTracks], {
        sourceTitle: 'Solo Jam',
        initialPositionMs: currentPos,
      });
      toast(`Switched to Solo Jam — "${nowPlaying.track_name}" continues`, 'success');
    }
    router.replace('/');
  };

  const handleLeaveAndPause = () => {
    setShowLeave(false);
    player.pause();
    router.replace('/');
  };

  return (
    <LeaveCtx.Provider value={() => setShowLeave(true)}>
      <RoomHeader />
      {children}
      <LeaveModal
        visible={showLeave}
        onClose={() => setShowLeave(false)}
        onConfirm={handleLeaveAndPause}
        onContinueSolo={nowPlaying ? handleContinueSolo : undefined}
        trackName={nowPlaying?.track_name}
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
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <InitialNameCtx.Provider value={initialName}>
        <RoomProvider key={id} roomId={id} password={password}>
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
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
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
  headerCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  headerCodePillText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 0.5,
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
