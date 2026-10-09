import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { radius, spacing } from '../theme';

export function RoomCardSkeleton() {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.8,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      {/* Top Header Placeholder */}
      <View style={styles.topRow}>
        <View style={styles.badgePlaceholder} />
        <View style={styles.listenersPlaceholder} />
      </View>

      {/* Center Artwork Hero Stage Placeholder (Zero Vinyl) */}
      <View style={styles.heroPlaceholderStage}>
        <View style={styles.heroIconPlaceholder} />
        <View style={styles.heroEqPlaceholder}>
          <View style={[styles.heroEqBar, { height: 8 }]} />
          <View style={[styles.heroEqBar, { height: 14 }]} />
          <View style={[styles.heroEqBar, { height: 10 }]} />
          <View style={[styles.heroEqBar, { height: 12 }]} />
        </View>
      </View>

      {/* Bottom Content Placeholders */}
      <View style={styles.bottomSection}>
        <View style={styles.titlePlaceholder} />
        <View style={styles.subtitlePlaceholder} />
        <View style={styles.tagsRow}>
          <View style={styles.tagPlaceholder} />
          <View style={styles.tagPlaceholderSmall} />
        </View>
      </View>
    </Animated.View>
  );
}

export function RoomCardSkeletonList({ count = 2 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.itemWrap}>
          <RoomCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    rowGap: spacing.md,
    marginTop: spacing.xs,
  },
  itemWrap: {
    width: '100%',
  },
  card: {
    backgroundColor: 'rgba(20, 20, 28, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    rowGap: 10,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgePlaceholder: {
    width: 76,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  listenersPlaceholder: {
    width: 48,
    height: 16,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  heroPlaceholderStage: {
    height: 104,
    backgroundColor: 'rgba(13, 13, 20, 0.75)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  heroIconPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.2)',
  },
  heroEqPlaceholder: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 14,
  },
  heroEqBar: {
    width: 3,
    backgroundColor: 'rgba(255, 159, 28, 0.3)',
    borderRadius: 1.5,
  },
  bottomSection: {
    rowGap: 6,
  },
  titlePlaceholder: {
    width: '75%',
    height: 15,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  subtitlePlaceholder: {
    width: '45%',
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  tagsRow: {
    flexDirection: 'row',
    columnGap: 6,
    marginTop: 2,
  },
  tagPlaceholder: {
    width: 50,
    height: 15,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tagPlaceholderSmall: {
    width: 38,
    height: 15,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
