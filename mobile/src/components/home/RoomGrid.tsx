import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { HardDrive, Radio, Search, Sparkles } from 'lucide-react-native';
import type { RoomSummary } from '../../api';
import { RoomCard } from '../RoomCard';
import { RoomCardSkeletonList } from '../RoomCardSkeleton';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import { hapticMedium } from '../../utils/haptics';

export interface RoomGridItemProps {
  room: RoomSummary;
  onPress: (room: RoomSummary) => void;
  onFavoriteToggle: () => void;
}

export const RoomGridItem: React.FC<RoomGridItemProps> = ({
  room,
  onPress,
  onFavoriteToggle,
}) => {
  return (
    <View style={styles.roomCardWrap}>
      <RoomCard
        room={room}
        onPress={() => onPress(room)}
        onFavoriteToggle={onFavoriteToggle}
      />
    </View>
  );
};

export interface RoomGridEmptyStateProps {
  isSearching: boolean;
  searchQuery: string;
  onClearSearchAndFilters: () => void;
  onCreateRoom: () => void;
  onOpenOfflineVault: () => void;
}

export const RoomGridEmptyState: React.FC<RoomGridEmptyStateProps> = ({
  isSearching,
  searchQuery,
  onClearSearchAndFilters,
  onCreateRoom,
  onOpenOfflineVault,
}) => {
  if (isSearching) {
    return (
      <Animated.View entering={FadeInDown.duration(250)} style={styles.searchEmptyCard}>
        <View style={styles.searchEmptyIconWrap}>
          <Search size={22} color={colors.amber} strokeWidth={2.2} />
        </View>
        <Text style={styles.searchEmptyTitle}>No Rooms Found</Text>
        <Text style={styles.searchEmptyDesc}>
          No live rooms match "{searchQuery.trim()}". Try checking another vibe keyword or clear your filter.
        </Text>
        <Pressable
          onPress={() => {
            void hapticMedium();
            onClearSearchAndFilters();
          }}
          style={({ pressed }) => [styles.clearSearchFilterBtn, pressed && styles.pressed]}
          accessibilityLabel="Clear search and filters"
        >
          <Text style={styles.clearSearchFilterText}>Clear Search & Filters</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.feedEmptyCard}>
      <View style={styles.feedEmptyIconWrap}>
        <Radio size={24} color={colors.amber} strokeWidth={2.2} />
      </View>
      <Text style={styles.feedEmptyTitle}>No Active Jam Rooms</Text>
      <Text style={styles.feedEmptyDesc}>
        No one is broadcasting right now. Be the first DJ to spin up a live session, or explore music saved in your Offline Vault!
      </Text>
      <View style={styles.feedEmptyActions}>
        <Pressable
          onPress={() => {
            void hapticMedium();
            onCreateRoom();
          }}
          style={({ pressed }) => [styles.feedEmptyCreateBtn, pressed && styles.pressed]}
          accessibilityLabel="Start a Live Jam Room"
        >
          <LinearGradient
            colors={['#ffb03a', '#ff9f1c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.feedEmptyCreateGradient}
          >
            <Sparkles size={15} color="#08080a" strokeWidth={2.4} />
            <Text style={styles.feedEmptyCreateText}>Start a Jam Room</Text>
          </LinearGradient>
        </Pressable>
        <Pressable
          onPress={() => {
            void hapticMedium();
            onOpenOfflineVault();
          }}
          style={({ pressed }) => [styles.feedEmptyVaultBtn, pressed && styles.pressed]}
          accessibilityLabel="Open Offline Audio Vault"
        >
          <HardDrive size={14} color={colors.amber} />
          <Text style={styles.feedEmptyVaultText}>Offline Vault</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
};

export interface RoomGridProps {
  rooms: RoomSummary[];
  searchQuery: string;
  selectedGenre?: string | null;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: () => void;
  onClearFilters: () => void;
  ready: boolean;
  onFavoriteToggle?: () => void;
  onOpenOfflineVault?: () => void;
}

export const RoomGrid: React.FC<RoomGridProps> = ({
  rooms,
  searchQuery,
  onSelectRoom,
  onCreateRoom,
  onClearFilters,
  ready,
  onFavoriteToggle = () => {},
  onOpenOfflineVault = () => {},
}) => {
  if (!ready) {
    return <RoomCardSkeletonList count={2} />;
  }

  if (rooms.length === 0) {
    return (
      <RoomGridEmptyState
        isSearching={searchQuery.trim().length > 0}
        searchQuery={searchQuery}
        onClearSearchAndFilters={onClearFilters}
        onCreateRoom={onCreateRoom}
        onOpenOfflineVault={onOpenOfflineVault}
      />
    );
  }

  return (
    <View style={styles.gridContainer}>
      {rooms.map((room) => (
        <RoomGridItem
          key={room.id}
          room={room}
          onPress={() => onSelectRoom(room.id)}
          onFavoriteToggle={onFavoriteToggle}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    width: '100%',
  },
  roomCardWrap: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  searchEmptyCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  searchEmptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  searchEmptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
  },
  searchEmptyDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: spacing.md,
  },
  clearSearchFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.4)',
  },
  clearSearchFilterText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
  },
  feedEmptyCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: 20,
    padding: 22,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  feedEmptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  feedEmptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  feedEmptyDesc: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 300,
  },
  feedEmptyActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  feedEmptyCreateBtn: {
    flex: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  feedEmptyCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
  },
  feedEmptyCreateText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#08080a',
  },
  feedEmptyVaultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  feedEmptyVaultText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
  },
  pressed: {
    opacity: 0.8,
  },
});
