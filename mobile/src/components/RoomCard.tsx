/** Room list card — glassmorphic, amber accents. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import type { RoomSummary } from '../api';

export function RoomCard({
  room,
  onPress,
}: {
  room: RoomSummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={styles.name} numberOfLines={1}>
            {room.name}
          </Text>
          <Text style={styles.host} numberOfLines={1}>
            {room.host_name}
            {room.is_private ? '  •  private' : ''}
          </Text>
          {room.now_playing ? (
            <Text style={styles.nowPlaying} numberOfLines={1}>
              ♪ {room.now_playing.track_name} — {room.now_playing.artist}
            </Text>
          ) : null}
        </View>
        <View style={styles.presence}>
          <View style={styles.dot} />
          <Text style={styles.count}>{room.listener_count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center' },
  main: { flex: 1, marginRight: spacing.sm },
  name: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 17,
    color: colors.text1,
  },
  host: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    marginTop: 2,
  },
  nowPlaying: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.amber,
    marginTop: 4,
  },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  count: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 14,
    color: colors.text1,
  },
});
