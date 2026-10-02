/** Room list row — minimalist hairline row, no card chrome. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
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
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {room.name}
        </Text>
        {room.now_playing ? (
          <Text style={styles.nowPlaying} numberOfLines={1}>
            {room.now_playing.track_name} — {room.now_playing.artist}
          </Text>
        ) : (
          <Text style={styles.host} numberOfLines={1}>
            {room.host_name}
            {room.is_private ? '  •  private' : ''}
          </Text>
        )}
      </View>
      <View style={styles.presence}>
        <View style={styles.dot} />
        <Text style={styles.count}>{room.listener_count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.7 },
  main: { flex: 1, marginRight: spacing.sm },
  name: {
    fontFamily: fontFamily.bodyMedium,
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
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    marginTop: 2,
  },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green },
  count: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text3,
  },
});
