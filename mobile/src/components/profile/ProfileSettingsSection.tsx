import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ChevronRight,
  ExternalLink,
  Headphones,
  LogIn,
  LogOut,
  ShieldCheck,
  Sliders,
  Trash2,
  Vibrate,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import type { AppPreferences } from '../../storage/history';

export interface ProfileSettingsSectionProps {
  preferences: AppPreferences;
  onToggleAudioQuality: (val: boolean) => void;
  onToggleHaptics: (val: boolean) => void;
  onOpenAndroidSettings: () => void;
  onClearHistory: () => void;
  recentCount: number;
  isDiscordUser: boolean;
  usernameOrName?: string;
  onDiscordLogin?: () => void;
  onSignOut?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
}

export function ProfileSettingsSection({
  preferences,
  onToggleAudioQuality,
  onToggleHaptics,
  onOpenAndroidSettings,
  onClearHistory,
  recentCount,
  isDiscordUser,
  usernameOrName,
  onDiscordLogin,
  onSignOut,
  onNavigatePrivacy,
  onNavigateTerms,
}: ProfileSettingsSectionProps) {
  return (
    <View style={styles.container}>
      {/* 1. App & Playback Preferences */}
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>APP & PLAYBACK PREFERENCES</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>High-Fidelity Audio</Text>
          <Text style={styles.cardSub}>
            Stream full 320kbps audio. Disable for Data Saver mode.
          </Text>
        </View>
        <Switch
          value={preferences.audioQuality === 'high'}
          onValueChange={onToggleAudioQuality}
          trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Haptic Touch Feedback</Text>
          <Text style={styles.cardSub}>
            Tactile vibrations when scrubbing, reacting, and reordering.
          </Text>
        </View>
        <Switch
          value={preferences.hapticEnabled ?? true}
          onValueChange={onToggleHaptics}
          trackColor={{ true: colors.amber, false: 'rgba(255, 255, 255, 0.15)' }}
          thumbColor={colors.white}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Background Audio Service</Text>
          <Text style={styles.cardSub}>
            Foreground service keeps music streaming when device is locked.
          </Text>
        </View>
        <View style={styles.activeBadge}>
          <Headphones size={11} color={colors.amber} />
          <Text style={styles.activeBadgeText}>Active</Text>
        </View>
      </View>

      {/* 2. System & Storage */}
      <View style={[styles.headerRow, { marginTop: spacing.md }]}>
        <Text style={styles.sectionTitle}>SYSTEM & LOCAL STORAGE</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>System App Settings</Text>
          <Text style={styles.cardSub}>
            Manage OS permissions, clear system caches, and sound output.
          </Text>
        </View>
        <Pressable
          onPress={onOpenAndroidSettings}
          style={({ pressed }) => [styles.outlineActionBtn, pressed && styles.pressed]}
          accessibilityLabel="Open system settings"
        >
          <Text style={styles.outlineActionBtnText}>Settings</Text>
          <ExternalLink size={12} color={colors.amber} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>Listening History</Text>
          <Text style={styles.cardSub}>
            {recentCount} track{recentCount === 1 ? '' : 's'} recorded. Playlists remain saved.
          </Text>
        </View>
        <Pressable
          onPress={onClearHistory}
          disabled={recentCount === 0}
          style={({ pressed }) => [
            styles.clearHistoryBtn,
            recentCount === 0 && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Clear listening history"
        >
          <Trash2 size={12} color={colors.red} />
          <Text style={styles.clearHistoryBtnText}>Clear</Text>
        </Pressable>
      </View>

      {/* 3. Account & Authentication */}
      <View style={styles.authBlock}>
        {isDiscordUser ? (
          <Pressable
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOutBtn, pressed && styles.pressed]}
            accessibilityLabel="Sign out of Discord"
          >
            <LogOut size={16} color={colors.red} />
            <Text style={styles.signOutText}>
              Sign Out of Discord{usernameOrName ? ` (@${usernameOrName})` : ''}
            </Text>
          </Pressable>
        ) : onDiscordLogin ? (
          <Pressable
            onPress={onDiscordLogin}
            style={({ pressed }) => [styles.discordLoginBtn, pressed && styles.pressed]}
            accessibilityLabel="Sign in with Discord"
          >
            <LogIn size={16} color="#ffffff" />
            <Text style={styles.discordLoginText}>Sign in with Discord</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 4. Legal & Compliance */}
      {(onNavigatePrivacy || onNavigateTerms) ? (
        <View style={styles.legalBlock}>
          {onNavigatePrivacy ? (
            <Pressable
              onPress={onNavigatePrivacy}
              style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            >
              <Text style={styles.legalText}>Privacy Policy</Text>
              <ChevronRight size={14} color={colors.text3} />
            </Pressable>
          ) : null}
          {onNavigatePrivacy && onNavigateTerms ? <View style={styles.legalDivider} /> : null}
          {onNavigateTerms ? (
            <Pressable
              onPress={onNavigateTerms}
              style={({ pressed }) => [styles.legalRow, pressed && styles.pressed]}
            >
              <Text style={styles.legalText}>Terms of Service</Text>
              <ChevronRight size={14} color={colors.text3} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 0.8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.text1,
  },
  cardSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  activeBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: colors.amber,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  outlineActionBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  clearHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  clearHistoryBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.red,
  },
  authBlock: {
    marginTop: spacing.md,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  signOutText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.red,
  },
  discordLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#5865F2',
    borderRadius: radius.md,
  },
  discordLoginText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  legalBlock: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  legalText: {
    color: colors.text2,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
  },
  legalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.8,
  },
});
