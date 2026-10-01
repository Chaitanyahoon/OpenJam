/** Queue tab wrapper. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { QueueList } from '../../../components/QueueList';

export default function QueueTab() {
  const { roomName } = useRoom();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.header} numberOfLines={1}>
          {roomName}
        </Text>
        <QueueList />
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
});
