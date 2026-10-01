/**
 * Flying emoji reaction overlay — ports the web app's floating particle
 * reactions to Reanimated (runs on the UI thread at 60fps).
 */
import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRoom, type FlyingReaction } from '../state/RoomContext';

const { width: W, height: H } = Dimensions.get('window');

function FloatingEmoji({
  reaction,
  onDone,
}: {
  reaction: FlyingReaction;
  onDone: (key: string) => void;
}) {
  const y = useSharedValue(H * 0.75);
  const x = useSharedValue(W * (0.25 + Math.random() * 0.5));
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const drift = (Math.random() - 0.5) * 120;
    y.value = withTiming(-80, { duration: 2600, easing: Easing.out(Easing.quad) });
    x.value = withTiming(x.value + drift, {
      duration: 2600,
      easing: Easing.inOut(Easing.sin),
    });
    scale.value = withTiming(1.4, { duration: 2600 });
    opacity.value = withTiming(0, { duration: 2600, easing: Easing.in(Easing.quad) });
    const t = setTimeout(() => onDone(reaction.key), 2700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.Text style={[styles.emoji, style]}>{reaction.emoji}</Animated.Text>
  );
}

export function FlyingReactions() {
  const { reactions, dismissReaction } = useRoom();
  if (reactions.length === 0) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      {reactions.map((r) => (
        <FloatingEmoji key={r.key} reaction={r} onDone={dismissReaction} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  emoji: {
    position: 'absolute',
    fontSize: 42,
  },
});
