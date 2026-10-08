import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';

const openjamLogo = require('../../assets/images/openjam-emblem.png');

interface AppLoadingScreenProps {
  isReady: boolean;
  onFinished?: () => void;
  statusText?: string;
}

/** 5-bar animated audio visualizer to signal live stream connection */
function MiniEqualizer() {
  const h1 = useRef(new Animated.Value(8)).current;
  const h2 = useRef(new Animated.Value(18)).current;
  const h3 = useRef(new Animated.Value(24)).current;
  const h4 = useRef(new Animated.Value(14)).current;
  const h5 = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    const createLoop = (anim: Animated.Value, minH: number, maxH: number, dur: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: maxH,
            duration: dur,
            useNativeDriver: false, // height cannot use native driver
          }),
          Animated.timing(anim, {
            toValue: minH,
            duration: dur * 0.9,
            useNativeDriver: false,
          }),
        ]),
      );
    };

    const l1 = createLoop(h1, 6, 20, 360);
    const l2 = createLoop(h2, 10, 26, 410);
    const l3 = createLoop(h3, 12, 28, 330);
    const l4 = createLoop(h4, 8, 22, 380);
    const l5 = createLoop(h5, 7, 18, 400);

    l1.start();
    l2.start();
    l3.start();
    l4.start();
    l5.start();

    return () => {
      l1.stop();
      l2.stop();
      l3.stop();
      l4.stop();
      l5.stop();
    };
  }, [h1, h2, h3, h4, h5]);

  return (
    <View style={styles.eqContainer}>
      <Animated.View style={[styles.eqBar, { height: h1 }]} />
      <Animated.View style={[styles.eqBar, { height: h2 }]} />
      <Animated.View style={[styles.eqBar, styles.eqBarAccent, { height: h3 }]} />
      <Animated.View style={[styles.eqBar, { height: h4 }]} />
      <Animated.View style={[styles.eqBar, { height: h5 }]} />
    </View>
  );
}

export function AppLoadingScreen({
  isReady,
  onFinished,
  statusText = 'Connecting to synchronized soundscape…',
}: AppLoadingScreenProps) {
  const insets = useSafeAreaInsets();
  // Breathing audio pulse aura
  const auraScale = useRef(new Animated.Value(0.92)).current;
  const auraOpacity = useRef(new Animated.Value(0.35)).current;
  // Logo subtle pulse
  const logoScale = useRef(new Animated.Value(0.98)).current;
  // Screen exit fade
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const auraPulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(auraScale, {
            toValue: 1.25,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 0.92,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(auraOpacity, {
            toValue: 0.75,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.35,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(logoScale, {
            toValue: 1.03,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 0.98,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    auraPulse.start();
    return () => auraPulse.stop();
  }, [auraOpacity, auraScale, logoScale]);

  useEffect(() => {
    if (isReady) {
      // Graceful hand-off fade out
      const timer = setTimeout(() => {
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && onFinished) {
            onFinished();
          }
        });
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [isReady, onFinished, screenOpacity]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.overlay, { opacity: screenOpacity }]}
      pointerEvents={isReady ? 'none' : 'auto'}
    >
      <View style={styles.centerBox}>
        {/* Ambient Glowing Audio Aura behind Logo */}
        <Animated.View
          style={[
            styles.auraGlow,
            {
              transform: [{ scale: auraScale }],
              opacity: auraOpacity,
            },
          ]}
        />

        {/* Headphones Brand Emblem */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={openjamLogo}
            style={styles.logoImage}
            resizeMode="contain"
            accessible={true}
            accessibilityLabel="OpenJam Brand Emblem"
          />
        </Animated.View>

        {/* Brand Typography */}
        <View style={styles.titleRow}>
          <Text style={styles.brandTitle}>Open</Text>
          <Text style={styles.brandTitleAccent}>Jam</Text>
        </View>

        {/* Synchronized Micro Badge */}
        <View style={styles.badgePill}>
          <View style={styles.livePulseDot} />
          <Text style={styles.badgeText}>REAL-TIME AUDIO SYNC</Text>
        </View>

        {/* Audio Equalizer & Status Feedback */}
        <View style={styles.statusSection}>
          <MiniEqualizer />
          <Text style={styles.statusCaption}>{statusText}</Text>
        </View>
      </View>

      {/* Footer Branding */}
      <View style={[styles.footer, { bottom: Math.max(insets.bottom, 20) + 16 }]}>
        <Text style={styles.footerText}>HIGH-FIDELITY ROOMS • POWERED BY DISCORD</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: colors.bgBase,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  auraGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255, 159, 28, 0.24)',
    top: -20,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
  },
  logoWrap: {
    width: 130,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoImage: {
    width: 124,
    height: 112,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  brandTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 32,
    color: colors.text1,
    letterSpacing: -0.5,
  },
  brandTitleAccent: {
    fontFamily: fontFamily.displayBold,
    fontSize: 32,
    color: colors.amber,
    letterSpacing: -0.5,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.28)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: spacing.sm,
    columnGap: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 0.8,
  },
  statusSection: {
    alignItems: 'center',
    marginTop: spacing.xl,
    rowGap: spacing.sm,
  },
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 30,
    columnGap: 4,
  },
  eqBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  eqBarAccent: {
    backgroundColor: colors.amber,
  },
  statusCaption: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    letterSpacing: 0.2,
  },
  footer: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 9.5,
    color: 'rgba(148, 163, 184, 0.45)',
    letterSpacing: 1.2,
  },
});
