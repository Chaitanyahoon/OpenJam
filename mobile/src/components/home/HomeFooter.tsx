import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { fontFamily } from '../../fonts';

export interface HomeFooterProps {
  bottomInset?: number;
  onPressPrivacy: () => void;
  onPressTerms: () => void;
  onPressSupport?: () => void;
}

export const HomeFooter: React.FC<HomeFooterProps> = ({
  bottomInset = 0,
  onPressPrivacy,
  onPressTerms,
  onPressSupport,
}) => {
  const handleSupport = async () => {
    if (onPressSupport) {
      onPressSupport();
      return;
    }
    const upiUrl = 'upi://pay?pa=chaitanyapatil700-1@oksbi&pn=OpenJam&cu=INR&tn=Support%20OpenJam';
    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
        return;
      }
    } catch {
      // Fall through to web
    }
    await Linking.openURL('https://www.openjam.fun').catch(() => {});
  };

  return (
    <View style={[styles.footerSection, { paddingBottom: Math.max(bottomInset, 16) + 12 }]}>
      <View style={styles.footerLinksRow}>
        <Pressable
          onPress={onPressPrivacy}
          hitSlop={8}
          style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Privacy policy"
        >
          <Text style={styles.footerLinkText}>Privacy</Text>
        </Pressable>
        <Text style={styles.footerDot}>•</Text>
        <Pressable
          onPress={onPressTerms}
          hitSlop={8}
          style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Terms of service"
        >
          <Text style={styles.footerLinkText}>Terms</Text>
        </Pressable>
        <Text style={styles.footerDot}>•</Text>
        <Pressable
          onPress={() => { void handleSupport(); }}
          hitSlop={8}
          style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Support OpenJam Tip Jar"
        >
          <Text style={[styles.footerLinkText, { color: colors.amber }]}>☕ Tip Jar</Text>
        </Pressable>
      </View>
      <Text style={styles.footerCopy}>OpenJam • Free & Open-Source Audio Sync</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  footerSection: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: 20,
    gap: 6,
  },
  footerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  footerLinkText: {
    color: colors.text3,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
  footerDot: {
    color: colors.text3,
    fontSize: 12,
  },
  footerCopy: {
    color: colors.text3,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.8,
  },
});
