import { useMemo, useRef } from 'react';
import { Dimensions, PanResponder, type PanResponderInstance } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { hapticLight } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface UseArtworkGesturesProps {
  onSwipeNext: () => void | Promise<void>;
  onSwipePrev: () => void | Promise<void>;
  onDoubleTapLike: () => void | Promise<void>;
}

export interface UseArtworkGesturesResult {
  artworkPanResponder: PanResponderInstance;
  animatedArtworkStyle: ReturnType<typeof useAnimatedStyle>;
  animatedBurstHeartStyle: ReturnType<typeof useAnimatedStyle>;
}

/**
 * Deep Presentation Module: Artwork Gesture & Double-Tap Heart Burst Controller.
 *
 * Encapsulates:
 * - 320ms double-tap heart burst animation & like toggle
 * - Damped horizontal drag with real-time scaling
 * - Left/right swipe velocity/distance threshold detection
 * - Spring snapback or skip transitions
 */
export function useArtworkGestures({
  onSwipeNext,
  onSwipePrev,
  onDoubleTapLike,
}: UseArtworkGesturesProps): UseArtworkGesturesResult {
  // Double-tap heart burst on album artwork
  const burstHeartScale = useSharedValue(0);
  const burstHeartOpacity = useSharedValue(0);
  const animatedBurstHeartStyle = useAnimatedStyle(() => ({
    opacity: burstHeartOpacity.value,
    transform: [{ scale: burstHeartScale.value }],
  }));

  // Album Artwork Horizontal Swipe & Pan
  const artworkTranslateX = useSharedValue(0);
  const artworkScale = useSharedValue(1);
  const animatedArtworkStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: artworkTranslateX.value },
      { scale: artworkScale.value },
    ],
  }));

  const lastTapRef = useRef(0);

  const artworkPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 12 &&
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
          );
        },
        onPanResponderGrant: () => {
          const now = Date.now();
          if (now - lastTapRef.current < 320) {
            lastTapRef.current = 0;
            burstHeartScale.value = 0;
            burstHeartOpacity.value = 1;
            burstHeartScale.value = withSequence(
              withTiming(1.35, { duration: 180 }),
              withSpring(1.0, { damping: 12, stiffness: 200 }),
            );
            burstHeartOpacity.value = withSequence(
              withTiming(1, { duration: 350 }),
              withTiming(0, { duration: 250 }),
            );
            void onDoubleTapLike();
          } else {
            lastTapRef.current = now;
          }
        },
        onPanResponderMove: (_, gestureState) => {
          artworkTranslateX.value = gestureState.dx * 0.75;
          artworkScale.value = Math.max(
            0.92,
            1 - Math.abs(gestureState.dx) / (SCREEN_WIDTH * 2),
          );
        },
        onPanResponderRelease: (_, gestureState) => {
          const SWIPE_THRESHOLD = 55;
          if (gestureState.dx < -SWIPE_THRESHOLD || gestureState.vx < -0.35) {
            void hapticLight();
            artworkTranslateX.value = withTiming(
              -SCREEN_WIDTH * 0.8,
              { duration: 160 },
              () => {
                artworkTranslateX.value = SCREEN_WIDTH * 0.8;
                artworkTranslateX.value = withSpring(0, {
                  damping: 16,
                  stiffness: 220,
                });
                artworkScale.value = withSpring(1);
              },
            );
            void onSwipeNext();
          } else if (gestureState.dx > SWIPE_THRESHOLD || gestureState.vx > 0.35) {
            void hapticLight();
            artworkTranslateX.value = withTiming(
              SCREEN_WIDTH * 0.8,
              { duration: 160 },
              () => {
                artworkTranslateX.value = -SCREEN_WIDTH * 0.8;
                artworkTranslateX.value = withSpring(0, {
                  damping: 16,
                  stiffness: 220,
                });
                artworkScale.value = withSpring(1);
              },
            );
            void onSwipePrev();
          } else {
            artworkTranslateX.value = withSpring(0, {
              damping: 15,
              stiffness: 200,
            });
            artworkScale.value = withSpring(1);
          }
        },
      }),
    [onSwipeNext, onSwipePrev, onDoubleTapLike],
  );

  return {
    artworkPanResponder,
    animatedArtworkStyle,
    animatedBurstHeartStyle,
  };
}
