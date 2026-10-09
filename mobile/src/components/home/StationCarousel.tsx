import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Bookmark, Play, Radio } from 'lucide-react-native';
import type { FavoriteRoom } from '../../storage/history';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import { hapticMedium } from '../../utils/haptics';

export interface StationCarouselProps {
  favoriteRooms: FavoriteRoom[];
  onOpenRoom: (room: { id: string; name?: string }) => void;
  onTuneInStation?: (genreOrRoomId: string) => void;
}

export const StationCarousel: React.FC<StationCarouselProps> = ({
  favoriteRooms,
  onOpenRoom,
  onTuneInStation,
}) => {
  if (!favoriteRooms || favoriteRooms.length === 0) return null;

  const handleTuneIn = (fav: FavoriteRoom) => {
    void hapticMedium();
    onOpenRoom({ id: fav.id, name: fav.name });
    if (onTuneInStation) onTuneInStation(fav.id);
  };

  return (
    <View style={styles.pinnedSection}>
      <View style={styles.pinnedHeader}>
        <View style={styles.pinnedTitleWrap}>
          <Bookmark size={13} color={colors.amber} fill={colors.amber} />
          <Text style={styles.pinnedTitle}>PINNED STATIONS</Text>
          <View style={styles.pinnedCountBadge}>
            <Text style={styles.pinnedCountText}>{favoriteRooms.length}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pinnedScroll}
        style={styles.pinnedScrollView}
      >
        {favoriteRooms.map((fav) => (
          <Pressable
            key={fav.id}
            onPress={() => handleTuneIn(fav)}
            style={({ pressed }) => [styles.pinnedCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Tune into ${fav.name}`}
          >
            <View style={styles.pinnedCardTop}>
              <View style={styles.pinnedRadioIconWrap}>
                <Radio size={13} color={colors.amber} />
              </View>
              <View style={styles.pinnedLivePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.pinnedLiveText}>SAVED</Text>
              </View>
            </View>

            <Text style={styles.pinnedCardName} numberOfLines={1}>
              {fav.name}
            </Text>

            <Text style={styles.pinnedCardHost} numberOfLines={1}>
              {fav.hostName ? `DJ ${fav.hostName}` : 'Community Room'}
            </Text>

            <View style={styles.pinnedCardFooter}>
              <View style={styles.pinnedTuneChip}>
                <Play size={10} color="#08080a" fill="#08080a" />
                <Text style={styles.pinnedTuneText}>Tune In</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  pinnedSection: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  pinnedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  pinnedTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  pinnedCountBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  pinnedCountText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  pinnedScrollView: {
    marginHorizontal: -spacing.md,
  },
  pinnedScroll: {
    gap: 10,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
  },
  pinnedCard: {
    width: 156,
    backgroundColor: 'rgba(22, 22, 30, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.md,
    padding: 12,
  },
  pinnedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pinnedRadioIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  pinnedLiveText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 8,
    color: '#22c55e',
    letterSpacing: 0.5,
  },
  pinnedCardName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#ffffff',
    marginBottom: 2,
  },
  pinnedCardHost: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginBottom: 10,
  },
  pinnedCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinnedTuneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinnedTuneText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#08080a',
  },
  pressed: {
    opacity: 0.8,
  },
});
