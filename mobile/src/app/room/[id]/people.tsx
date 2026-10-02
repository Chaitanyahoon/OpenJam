/** People tab: who's in the room (mirrors the PWA's People panel). */
import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';

function initials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PeopleTab() {
  const { listeners, roomName, me } = useRoom();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header} numberOfLines={1}>
          {roomName}
        </Text>
        <Text style={styles.sub}>
          {listeners.length} online
        </Text>
        <FlatList
          data={listeners}
          keyExtractor={(l) => l.user_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isMe = me && item.user_id === me.id;
            return (
              <View style={styles.row}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(item.user_name)}</Text>
                  </View>
                )}
                <View style={styles.dot} />
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.user_name}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.role}>
                    {item.is_host ? '★ Host' : 'Listener'}
                  </Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>No one else is here yet.</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  header: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 20,
    color: colors.text1,
    marginTop: spacing.sm,
  },
  sub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a20',
    borderWidth: 1,
    borderColor: colors.borderAmber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 16,
    color: colors.amber,
  },
  dot: {
    position: 'absolute',
    left: 44,
    top: 40,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  info: { flex: 1 },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: 15, color: colors.text1 },
  role: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3, marginTop: 2 },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text3,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
