import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { HardDrive, LogIn } from 'lucide-react-native';
import type { ApiUser } from '../../api';
import { colors, radius } from '../../theme';
import { fontFamily } from '../../fonts';

const openjamLogo = require('../../../assets/images/openjam-emblem.png');

export interface HomeTopNavProps {
  user: ApiUser | null;
  initials: string;
  onOpenVault: () => void;
  onOpenProfile: () => void;
  onOpenSignIn: () => void;
  bgOpacity?: number;
}

export const HomeTopNav: React.FC<HomeTopNavProps> = ({
  user,
  initials,
  onOpenVault,
  onOpenProfile,
  onOpenSignIn,
  bgOpacity = 0,
}) => {
  return (
    <View
      style={[
        styles.navBar,
        bgOpacity > 0 && {
          backgroundColor: `rgba(8, 8, 10, ${Math.min(0.95, bgOpacity)})`,
          borderBottomWidth: bgOpacity > 0.4 ? 1 : 0,
          borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        },
      ]}
    >
      <View style={styles.navLeft}>
        <View style={styles.brandLogoWrap}>
          <Image
            source={openjamLogo}
            style={styles.brandLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName} maxFontSizeMultiplier={1.2}>
          Open<Text style={styles.brandNameAmber}>Jam</Text>
        </Text>
      </View>

      <View style={styles.navRight}>
        <Pressable
          onPress={onOpenVault}
          style={({ pressed }) => [styles.navVaultBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityLabel="Open Offline Audio Vault"
        >
          <HardDrive size={16} color={colors.amber} />
        </Pressable>

        {user ? (
          <Pressable
            onPress={onOpenProfile}
            style={({ pressed }) => [
              styles.discordUserChip,
              !user.discord_id && styles.guestUserChip,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="View profile"
          >
            {user.avatar_url ? (
              <Image source={{ uri: user.avatar_url }} style={styles.discordAvatarMini} />
            ) : (
              <View
                style={[
                  styles.discordAvatarFallback,
                  !user.discord_id && styles.guestAvatarFallback,
                ]}
              >
                <Text
                  style={[
                    styles.userInitialsMini,
                    !user.discord_id && styles.guestInitialsMini,
                  ]}
                  maxFontSizeMultiplier={1.0}
                >
                  {initials}
                </Text>
              </View>
            )}
            <Text
              style={styles.userName}
              numberOfLines={1}
              ellipsizeMode="tail"
              maxFontSizeMultiplier={1.2}
            >
              {user.discord_username ? `@${user.discord_username}` : (user.display_name || 'Jammer')}
            </Text>
            <View
              style={[
                styles.discordOnlineDot,
                !user.discord_id && styles.guestOnlineDot,
              ]}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={onOpenSignIn}
            style={({ pressed }) => [styles.discordLoginPill, pressed && styles.pressed]}
            accessibilityLabel="Sign in or join as guest"
          >
            <LogIn size={15} color="#ffffff" strokeWidth={2.4} />
            <Text style={styles.discordPillText} maxFontSizeMultiplier={1.2}>Sign In</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 8,
  },
  navLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  brandLogoWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: 30,
    height: 30,
  },
  brandName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 21,
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  brandNameAmber: {
    color: colors.amber,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  navVaultBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordLoginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5865F2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    gap: 6,
    shadowColor: '#5865F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
    flexShrink: 0,
  },
  discordPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: '#ffffff',
  },
  discordUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88, 101, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(88, 101, 242, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
    maxWidth: 190,
    flexShrink: 1,
  },
  discordAvatarMini: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    flexShrink: 0,
  },
  discordAvatarFallback: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#5865F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  discordOnlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    flexShrink: 0,
  },
  guestUserChip: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  guestAvatarFallback: {
    backgroundColor: colors.amber,
  },
  guestInitialsMini: {
    color: '#08080a',
  },
  guestOnlineDot: {
    backgroundColor: colors.amber,
    flexShrink: 0,
  },
  userInitialsMini: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    color: '#ffffff',
  },
  userName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text1,
    flexShrink: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.8,
  },
});
