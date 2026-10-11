/**
 * Flying vector reaction overlay — ports the web app's floating particle
 * reactions to smooth Reanimated vector icons (runs on the UI thread at 60fps).
 * 100% Vector Lucide icons — zero cartoon text emojis.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Flame, Heart, Music, Sparkles, ThumbsUp } from 'lucide-react-native';
import { useRoomReactionsContext, type FlyingReaction } from '../state/RoomContext';
import { colors } from '../theme';

function renderReactionIcon(key: string) {
  const norm = (key || '').toLowerCase();
  if (norm === 'heart' || norm === '❤️' || norm.includes('heart')) {
    return <Heart size={24} color="#ef4444" fill="#ef4444" />;
  }
  if (norm === 'fire' || norm === '🔥' || norm.includes('fire') || norm.includes('flame')) {
    return <Flame size={24} color="#f97316" fill="#f97316" />;
  }
  if (norm === 'sparkles' || norm === '✨' || norm.includes('sparkle') || norm.includes('star')) {
    return <Sparkles size={24} color={colors.amber} fill={colors.amber} />;
  }
  if (norm === 'thumbsup' || norm === '👍' || norm.includes('thumb') || norm.includes('like')) {
    return <ThumbsUp size={24} color="#3b82f6" fill="#3b82f6" />;
  }
  if (norm === 'music' || norm === '🎵' || norm.includes('music') || norm.includes('note')) {
    return <Music size={24} color="#a855f7" />;
  }
  return <Sparkles size={24} color={colors.amber} fill={colors.amber} />;
}

function FloatingEmoji({
  reaction,
  onDone,
}: {
  reaction: FlyingReaction;
  onDone: (key: string) => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
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
    scale.value = withTiming(1.3, { duration: 2600 });
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
    <Animated.View style={[styles.flyingBubble, style]}>
      {renderReactionIcon(reaction.emoji)}
    </Animated.View>
  );
}

export function FlyingReactions() {
  const { reactions, dismissReaction } = useRoomReactionsContext();
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
  },
  flyingBubble: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(22, 22, 32, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
});
