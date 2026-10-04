import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../../theme';
import { QueueList } from '../../../components/QueueList';

export default function QueueTab() {
  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        <QueueList />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  container: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
});
