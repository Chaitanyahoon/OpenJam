/**
 * Onboarding Permissions & Offline Storage Banner.
 *
 * Prompts user to grant notification permission (for lockscreen & background audio controls)
 * and confirms that offline playlist storage is ready in the app sandbox.
 * Strictly uses Lucide icons and OpenJam design tokens.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Check, HardDrive, ShieldCheck, X } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import {
  dismissPermissionBanner,
  getNotificationPermissionStatus,
  isPermissionBannerDismissed,
  requestNotificationPermission,
} from '../permissions';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface PermissionBannerProps {
  onPermissionChanged?: (granted: boolean) => void;
}

export function PermissionBanner({ onPermissionChanged }: PermissionBannerProps) {
  const [visible, setVisible] = useState(false);
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const dismissed = await isPermissionBannerDismissed();
      if (dismissed) return;

      const status = await getNotificationPermissionStatus();
      if (mounted) {
        if (status === 'granted') {
          setGranted(true);
          setVisible(false);
        } else {
          setVisible(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    hapticLight();
    const ok = await requestNotificationPermission();
    setLoading(false);
    if (ok) {
      hapticMedium();
      setGranted(true);
      onPermissionChanged?.(true);
      setTimeout(async () => {
        await dismissPermissionBanner();
        setVisible(false);
      }, 1200);
    } else {
      onPermissionChanged?.(false);
    }
  };

  const handleDismiss = async () => {
    hapticLight();
    await dismissPermissionBanner();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.badge}>
          <ShieldCheck size={14} color={colors.amber} />
          <Text style={styles.badgeText}>APP PERMISSIONS</Text>
        </View>
        <Pressable
          onPress={handleDismiss}
          hitSlop={10}
          accessibilityLabel="Dismiss permissions banner"
          style={styles.closeBtn}
        >
          <X size={16} color={colors.text2} />
        </Pressable>
      </View>

      <Text style={styles.title}>Enable Background Playback & Offline Sync</Text>
      <Text style={styles.description}>
        Grant notification access for lock screen music controls. Your offline playlists and
        favorites are safely stored in your private app sandbox.
      </Text>

      <View style={styles.featuresRow}>
        <View style={styles.featureItem}>
          <Bell size={13} color={colors.amber} />
          <Text style={styles.featureText}>Lockscreen Controls</Text>
        </View>
        <View style={styles.featureItem}>
          <HardDrive size={13} color={colors.amber} />
          <Text style={styles.featureText}>Offline Playlists Ready</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        {granted ? (
          <View style={styles.grantedPill}>
            <Check size={14} color={colors.green} />
            <Text style={styles.grantedText}>Permissions Active</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleEnable}
            disabled={loading}
            style={({ pressed }) => [
              styles.enableBtn,
              pressed && styles.btnPressed,
              loading && styles.btnDisabled,
            ]}
          >
            <Text style={styles.enableBtnText}>
              {loading ? 'Enabling...' : 'Enable Playback Controls'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#101016',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    maxWidth: 600,
    alignSelf: 'center',
    width: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.amber,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
    marginBottom: 4,
  },
  description: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text2,
    lineHeight: 17,
    marginBottom: 10,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  featureText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enableBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  enableBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    fontWeight: '700',
    color: '#08080a',
  },
  grantedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  grantedText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    fontWeight: '600',
    color: colors.green,
  },
});
