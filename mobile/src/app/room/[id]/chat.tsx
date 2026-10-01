/** Chat tab: presence strip + chat panel. */
import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { ChatPanel } from '../../../components/ChatPanel';

function initials(name: string): string {
  return name
    .split(/[\s-_]+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ChatTab() {
  const { listeners, roomName } = useRoom();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header} numberOfLines={1}>
          {roomName}
        </Text>
        <View style={styles.presence}>
          <FlatList
            horizontal
            data={listeners}
            keyExtractor={(l) => l.user_id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.person}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.user_name)}</Text>
                  <View style={styles.dot} />
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {item.user_name}
                  {item.is_host ? ' ★' : ''}
                </Text>
              </View>
            )}
          />
        </View>
        <View style={styles.chat}>
          <ChatPanel />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 20,
    color: colors.text1,
    marginBottom: spacing.sm,
  },
  presence: { marginBottom: spacing.sm },
  person: { alignItems: 'center', marginRight: spacing.md, width: 64 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fontFamily.bodySemiBold, color: colors.amber, fontSize: 16 },
  dot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  personName: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 4,
  },
  chat: { flex: 1 },
});
