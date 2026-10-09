import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import { fontFamily } from '../../fonts';

export interface QuickAccessTile {
  id: string;
  title: string;
  subtitle?: string;
  gradient: [string, string];
  icon: React.ReactNode;
  onPress: () => void;
  isPlaying?: boolean;
}

export interface QuickAccessGridProps {
  items: QuickAccessTile[];
}

export const QuickAccessGrid: React.FC<QuickAccessGridProps> = ({ items }) => {
  if (!items || items.length === 0) return null;

  return (
    <View style={styles.quickAccessSection}>
      <View style={styles.quickAccessGrid}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={({ pressed }) => [
              styles.quickAccessCard,
              pressed && styles.quickAccessCardPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <LinearGradient
              colors={item.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.quickAccessCover}
            >
              {item.icon}
            </LinearGradient>
            <View style={styles.quickAccessInfo}>
              <Text style={styles.quickAccessTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={styles.quickAccessSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            {item.isPlaying ? (
              <View style={styles.quickAccessPlayingIndicator}>
                <View style={styles.quickAccessPulseDot} />
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  quickAccessSection: {
    marginBottom: 14,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  quickAccessCard: {
    width: '48.8%',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickAccessCardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    transform: [{ scale: 0.985 }],
  },
  quickAccessCover: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAccessInfo: {
    flex: 1,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  quickAccessTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#ffffff',
    lineHeight: 15,
  },
  quickAccessSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: '#8e8e9f',
    marginTop: 2,
  },
  quickAccessPlayingIndicator: {
    paddingRight: 8,
  },
  quickAccessPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
});
