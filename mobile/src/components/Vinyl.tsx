/**
 * Rotating vinyl record + breathing ambient glow.
 * Ports the web app's signature effects (UI_UX_BRIEF.md §4):
 * - infinite 6s rotation while playing, eased friction stop on pause
 * - background glow breathing (calm idle -> energetic when playing)
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

const SIZE = 280;
const LABEL = SIZE * 0.38;

export function Vinyl({
  artworkUrl,
  playing,
}: {
  artworkUrl?: string;
  playing: boolean;
}) {
  const rotation = useSharedValue(0);
  const glow = useSharedValue(1);

  useEffect(() => {
    if (playing) {
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 6000, easing: Easing.linear }),
        -1,
      );
    } else {
      // friction stop: ease out over ~3/4 of a turn
      cancelAnimation(rotation);
      rotation.value = withTiming(rotation.value + 270, {
        duration: 900,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [playing, rotation]);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(playing ? 1.14 : 1.05, {
        duration: playing ? 1100 : 2800,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
  }, [playing, glow]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value % 360}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glow.value }],
    opacity: 0.55 + (glow.value - 1) * 2,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Animated.View style={[styles.disc, discStyle]}>
        {/* grooves */}
        <View style={styles.groove1} />
        <View style={styles.groove2} />
        <View style={styles.label}>
          {artworkUrl ? (
            <Image source={{ uri: artworkUrl }} style={styles.art} contentFit="cover" />
          ) : (
            <View style={[styles.art, styles.artFallback]} />
          )}
        </View>
        <View style={styles.spindle} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: SIZE * 1.15,
    height: SIZE * 1.15,
    borderRadius: (SIZE * 1.15) / 2,
    backgroundColor: colors.amber,
    opacity: 0.5,
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: '#0b0b0e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  groove1: {
    position: 'absolute',
    width: SIZE * 0.86,
    height: SIZE * 0.86,
    borderRadius: (SIZE * 0.86) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  groove2: {
    position: 'absolute',
    width: SIZE * 0.7,
    height: SIZE * 0.7,
    borderRadius: (SIZE * 0.7) / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    width: LABEL,
    height: LABEL,
    borderRadius: LABEL / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.amber,
  },
  art: { width: '100%', height: '100%' },
  artFallback: { backgroundColor: colors.bgSurface },
  spindle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.bgBase,
    borderWidth: 2,
    borderColor: colors.text3,
  },
});
