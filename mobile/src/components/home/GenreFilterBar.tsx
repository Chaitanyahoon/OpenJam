import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { HardDrive, Search, X } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import { hapticMedium } from '../../utils/haptics';

const DEFAULT_GENRES: readonly string[] = [
  'All',
  'Lofi & Chill',
  'Synthwave',
  'Hip Hop',
  'Ambient',
];

export interface GenreFilterBarProps {
  roomCount?: number;
  isSyncingCloud?: boolean;
  searchQuery: string;
  searchFocused: boolean;
  selectedGenre: string | null;
  genres?: readonly string[];
  searchInputRef?: React.RefObject<TextInput | null> | React.MutableRefObject<any>;
  onSearchChange: (text: string) => void;
  onSearchFocus?: (focused: boolean) => void;
  onSearchFocusChange?: (focused: boolean) => void;
  onClearSearch?: () => void;
  onSelectGenre: (genre: string) => void;
  onOpenOfflineVault?: () => void;
}

export const GenreFilterBar: React.FC<GenreFilterBarProps> = ({
  roomCount = 0,
  isSyncingCloud = false,
  searchQuery,
  searchFocused,
  selectedGenre = 'All',
  genres = DEFAULT_GENRES,
  searchInputRef,
  onSearchChange,
  onSearchFocus,
  onSearchFocusChange,
  onClearSearch,
  onSelectGenre,
  onOpenOfflineVault,
}) => {
  const handleFocus = (focused: boolean) => {
    if (onSearchFocus) onSearchFocus(focused);
    if (onSearchFocusChange) onSearchFocusChange(focused);
  };

  const handleClear = () => {
    void hapticMedium();
    if (onClearSearch) onClearSearch();
    else onSearchChange('');
  };

  const handleGenrePress = (g: string) => {
    void hapticMedium();
    onSelectGenre(g);
  };

  return (
    <View style={styles.roomsToolbar}>
      <View style={styles.toolbarHeader}>
        <View style={styles.liveIndicator}>
          <View style={styles.livePulseDot} />
          <Text style={styles.liveHeaderText}>
            LIVE ROOMS ({roomCount})
          </Text>
          {isSyncingCloud && (
            <View style={styles.syncingCloudBadge}>
              <ActivityIndicator
                size="small"
                color={colors.amber}
                style={{ transform: [{ scale: 0.65 }] }}
              />
              <Text style={styles.syncingCloudText}>Syncing Cloud</Text>
            </View>
          )}
        </View>

        {onOpenOfflineVault && (
          <Pressable
            onPress={onOpenOfflineVault}
            hitSlop={8}
            style={({ pressed }) => [styles.offlineVaultBtn, pressed && styles.pressed]}
            accessibilityLabel="Open Offline Audio Vault"
          >
            <HardDrive size={12} color={colors.amber} />
            <Text style={styles.offlineVaultBtnText}>Offline Vault</Text>
          </Pressable>
        )}
      </View>

      {/* Search Field */}
      <View style={[styles.searchWrap, searchFocused && styles.searchWrapFocused]}>
        <Search size={16} color={searchFocused ? colors.amber : colors.text3} />
        <TextInput
          ref={searchInputRef}
          value={searchQuery}
          onChangeText={onSearchChange}
          onFocus={() => handleFocus(true)}
          onBlur={() => handleFocus(false)}
          placeholder="Search rooms, DJs, genres..."
          placeholderTextColor={colors.text3}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery ? (
          <Pressable
            onPress={handleClear}
            hitSlop={12}
            style={styles.clearSearchBtn}
            accessibilityLabel="Clear search"
          >
            <X size={15} color={colors.amber} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      {/* Genre Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.genreScroll}
        style={styles.genreScrollView}
      >
        {genres.map((g) => {
          const active = (selectedGenre ?? 'All') === g;
          return (
            <Pressable
              key={g}
              onPress={() => handleGenrePress(g)}
              style={({ pressed }) => [
                styles.genreChip,
                active && styles.genreChipActive,
                pressed && styles.pressed,
              ]}
              accessibilityLabel={`Filter by ${g}`}
            >
              {active ? <View style={styles.genreActiveDot} /> : null}
              <Text
                style={[styles.genreText, active && styles.genreTextActive]}
                maxFontSizeMultiplier={1.2}
              >
                {g}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  roomsToolbar: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  toolbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  liveHeaderText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    letterSpacing: 1.1,
    color: colors.text2,
  },
  syncingCloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    marginLeft: 6,
  },
  syncingCloudText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    color: colors.amber,
    letterSpacing: 0.2,
  },
  offlineVaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.22)',
  },
  offlineVaultBtnText: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 10.5,
    color: colors.amber,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
    gap: 8,
  },
  searchWrapFocused: {
    borderColor: 'rgba(255, 159, 28, 0.45)',
    backgroundColor: 'rgba(255, 159, 28, 0.05)',
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13.5,
    color: '#ffffff',
    paddingVertical: 0,
    minWidth: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  genreScrollView: {
    marginHorizontal: -spacing.md,
  },
  genreScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6.5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  genreChipActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderColor: colors.amber,
  },
  genreActiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.amber,
    marginRight: 5,
  },
  genreText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text3,
  },
  genreTextActive: {
    color: colors.amber,
    fontFamily: fontFamily.bodySemiBold,
  },
  pressed: {
    opacity: 0.8,
  },
});
