/**
 * Room bottom navigation — mirrors the PWA's <640px mobile layout:
 * Playing | Queue | Chat (unread badge) | People, with the PWA's
 * mini-player bar above the tabs on every non-Playing tab while
 * music is playing. Tap the mini-player to jump to Playing.
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
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

const TABS: { route: string; label: string; glyph: string }[] = [
  { route: 'player', label: 'Playing', glyph: '◉' },
  { route: 'queue', label: 'Queue', glyph: '▤' },
  { route: 'chat', label: 'Chat', glyph: '💬' },
  { route: 'people', label: 'People', glyph: '👥' },
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
  const ratio = duration > 0 ? Math.min(1, pos / duration) : 0;

  return (
    <View style={styles.mini}>
      <View style={styles.miniProgressBg}>
        <View style={[styles.miniProgressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.miniRow}>
        <Pressable style={styles.miniMain} onPress={onOpen}>
          {nowPlaying.album_art_url ? (
            <Image source={{ uri: nowPlaying.album_art_url }} style={styles.miniArt} />
          ) : (
            <View style={[styles.miniArt, styles.miniArtFallback]}>
              <Text style={styles.miniArtGlyph}>♪</Text>
            </View>
          )}
          <View style={styles.miniInfo}>
            <Text style={styles.miniTitle} numberOfLines={1}>
              {nowPlaying.track_name}
            </Text>
            <Text style={styles.miniArtist} numberOfLines={1}>
              {nowPlaying.artist}
            </Text>
          </View>
        </Pressable>
        <Pressable style={styles.miniPlay} onPress={togglePlay} hitSlop={12}>
          <Text style={styles.miniPlayGlyph}>{isPlaying ? '⏸' : '▶'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function RoomTabBar({ state, navigation }: TabBarProps) {
  const { unreadChat } = useRoom();
  const current = state.routes[state.index]?.name;
  const showMini = current !== 'player';

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
      <View style={styles.bar}>
        {TABS.map((t) => {
          const index = state.routes.findIndex((r) => r.name === t.route);
          if (index === -1) return null;
          const focused = current === t.route;
          return (
            <Pressable
              key={t.route}
              style={styles.tab}
              onPress={() => go(t.route, index)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
            >
              <View>
                <Text style={[styles.icon, focused && styles.iconFocused]}>{t.glyph}</Text>
                {t.route === 'chat' && unreadChat > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadChat > 99 ? '99+' : String(unreadChat)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, focused && styles.labelFocused]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(14, 14, 18, 0.92)',
    borderTopWidth: 1,
    borderTopColor: colors.borderAmber,
  },
  mini: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderAmber,
  },
  miniProgressBg: { height: 2, backgroundColor: colors.bgSurface },
  miniProgressFill: { height: '100%', backgroundColor: colors.amber },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  miniMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniArt: { width: 44, height: 44, borderRadius: 6 },
  miniArtFallback: {
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniArtGlyph: { color: colors.amber, fontSize: 20 },
  miniInfo: { flex: 1 },
  miniTitle: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.text1 },
  miniArtist: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3 },
  miniPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPlayGlyph: { fontSize: 16, color: '#08080a', marginLeft: 2 },
  bar: {
    height: TAB_BAR_HEIGHT + 8,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  icon: { fontSize: 22, color: colors.text3 },
  iconFocused: { color: colors.amber },
  label: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: colors.text3 },
  labelFocused: { color: colors.amber },
  badge: {
    position: 'absolute',
    top: -6,
    right: -14,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#08080a' },
});
