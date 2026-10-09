import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme';
import { fontFamily } from '../../fonts';
import { hapticLight } from '../../utils/haptics';

export type HomeCategory = 'All' | 'Music' | 'Live Rooms' | 'Downloaded';

export interface CategoryFilterChipsProps {
  selectedCategory: HomeCategory;
  onSelectCategory: (category: HomeCategory) => void;
}

const CATEGORIES: readonly HomeCategory[] = ['All', 'Music', 'Live Rooms', 'Downloaded'];

export const CategoryFilterChips: React.FC<CategoryFilterChipsProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <View style={styles.topFilterChipsRow}>
      {CATEGORIES.map((cat) => {
        const active = selectedCategory === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => {
              void hapticLight();
              onSelectCategory(cat);
            }}
            style={({ pressed }) => [
              styles.topFilterChip,
              active && styles.topFilterChipActive,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${cat}`}
          >
            <Text
              style={[
                styles.topFilterChipText,
                active && styles.topFilterChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  topFilterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 12,
  },
  topFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  topFilterChipActive: {
    backgroundColor: colors.amber,
  },
  topFilterChipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#ffffff',
  },
  topFilterChipTextActive: {
    color: '#08080a',
  },
  pressed: {
    opacity: 0.8,
  },
});
