import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bookmark, ChevronRight, Radio } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import type { FavoriteRoom } from '../../storage/history';

export interface ProfileSavedRoomsSectionProps {
  favoriteRooms: FavoriteRoom[];
  onJoinRoom: (roomId: string) => void;
}

export function ProfileSavedRoomsSection({
  favoriteRooms,
  onJoinRoom,
}: ProfileSavedRoomsSectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>PINNED STATIONS ({favoriteRooms.length})</Text>
      </View>

      {favoriteRooms.length === 0 ? (
        <View style={styles.emptyState}>
          <Bookmark size={32} color={colors.text3} opacity={0.4} />
          <Text style={styles.emptyTitle}>No saved rooms</Text>
          <Text style={styles.emptySubtitle}>
            Pin your favorite rooms from the room screen to jump back in anytime!
          </Text>
        </View>
      ) : (
        favoriteRooms.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => onJoinRoom(r.id)}
            style={({ pressed }) => [styles.roomRow, pressed && styles.pressed]}
            accessibilityLabel={`Join room ${r.name}`}
          >
            <View style={styles.roomLeft}>
              <View style={styles.iconBox}>
                <Radio size={16} color={colors.amber} />
              </View>
              <View style={styles.roomMeta}>
                <Text style={styles.roomName} numberOfLines={1}>
                  {r.name}
                </Text>
                <Text style={styles.roomHost} numberOfLines={1}>
                  Host: {r.hostName || 'Community'}
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.text3} />
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: colors.text2,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 8,
  },
  roomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomMeta: {
    flex: 1,
  },
  roomName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: colors.text1,
  },
  roomHost: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  pressed: {
    opacity: 0.8,
  },
});
