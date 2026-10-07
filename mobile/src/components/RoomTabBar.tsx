/**
 * Room bottom navigation — Spotify & PWA inspired:
 * Playing | Queue | Chat (unread badge) | People, with the
 * mini-player bar above the tabs on every non-Playing tab while
 * music is playing. Tap the mini-player to jump to Playing.
 *
 * Uses Lucide vector icons — zero emojis.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import {
  Disc,
  ListMusic,
  MessageSquare,
  Users,
  Music,
  Play,
  Pause,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, TAB_BAR_HEIGHT } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';

/** Minimal shape of the tabBar render props passed by expo-router's Tabs. */
interface TabBarProps {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
}

const TABS = [
  { route: 'player', label: 'Playing', Icon: Disc },
  { route: 'queue', label: 'Queue', Icon: ListMusic },
  { route: 'chat', label: 'Chat', Icon: MessageSquare },
  { route: 'people', label: 'People', Icon: Users },
];

function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const { nowPlaying, isPlaying, togglePlay } = useRoom();
  const player = usePlayer();
  const { durationMs } = usePlayerStatus();
  const [pos, setPos] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPos(player.positionMs()), 500);
    return () => clearInterval(t);
  }, [player]);

  if (!nowPlaying) return null;
  const duration = durationMs || nowPlaying.duration_ms || 0;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, pos / duration)) : 0;

  return (
    <View style={styles.mini}>
      <View style={styles.miniProgressBg}>
        <View style={[styles.miniProgressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.miniRow}>
        <Pressable style={styles.miniMain} onPress={onOpen}>
          {nowPlaying.album_art_url ? (
            <Image
              source={{ uri: nowPlaying.album_art_url }}
              style={styles.miniArt}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.miniArt, styles.miniArtFallback]}>
              <Music size={18} color="rgba(255, 159, 28, 0.4)" />
            </View>
          )}
          <View style={styles.miniInfo}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {nowPlaying.track_name}
            </Text>
            <Text style={styles.miniArtist} numberOfLines={1}>
              {nowPlaying.artist || 'OpenJam'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.miniPlay, pressed && styles.pressed]}
          onPress={togglePlay}
          hitSlop={12}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={15} color={colors.amber} fill={colors.amber} />
          ) : (
            <Play size={15} color={colors.amber} fill={colors.amber} style={{ marginLeft: 2 }} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function RoomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { unreadChat, listeners } = useRoom();
  const current = state.routes[state.index]?.name;
  const showMini = current !== 'player';
  const bottomPad = Math.max(insets.bottom, 12);

  const go = (routeName: string, index: number) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={styles.wrap}>
      {showMini ? (
        <MiniPlayer onOpen={() => go('player', state.routes.findIndex((r) => r.name === 'player'))} />
      ) : null}
      <View style={[styles.bar, { paddingBottom: bottomPad, height: TAB_BAR_HEIGHT + bottomPad }]}>
        {TABS.map((t) => {
          const index = state.routes.findIndex((r) => r.name === t.route);
          if (index === -1) return null;
          const focused = current === t.route;
          const TabIcon = t.Icon;
          return (
            <Pressable
              key={t.route}
              style={styles.tab}
              onPress={() => go(t.route, index)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <View style={[styles.tabContent, focused && styles.tabContentFocused]}>
                <View style={styles.iconWrap}>
                  <TabIcon
                    size={19}
                    color={focused ? colors.amber : colors.text3}
                    strokeWidth={focused ? 2.5 : 2}
                  />
                  {t.route === 'chat' && unreadChat > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadChat > 99 ? '99+' : String(unreadChat)}
                      </Text>
                    </View>
                  ) : null}
                  {t.route === 'people' && listeners.length > 0 && !focused ? (
                    <View style={styles.listenersDot} />
                  ) : null}
                </View>
                <Text style={[styles.label, focused && styles.labelFocused]}>{t.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0c0c12',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  mini: {
    backgroundColor: '#12121c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  miniProgressBg: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.amber,
  },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  miniMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniArt: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  miniArtFallback: {
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInfo: {
    flex: 1,
  },
  miniTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.text1,
  },
  miniArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  miniPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: TAB_BAR_HEIGHT + 8,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 6,
    backgroundColor: '#0c0c12',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 3,
  },
  tabContentFocused: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
  },
  iconWrap: {
    position: 'relative',
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontFamily: fontFamily.bodyMedium,
    color: colors.text3,
    letterSpacing: 0.2,
  },
  labelFocused: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.amber,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 9,
    fontFamily: fontFamily.bodySemiBold,
    color: '#08080a',
  },
  listenersDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  pressed: {
    opacity: 0.7,
  },
});
