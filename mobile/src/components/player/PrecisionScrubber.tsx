/**
 * PrecisionScrubber — Isolated high-frequency audio progress slider & precision deflection scrubber.
 *
 * Capabilities:
 * - Local 200ms position polling loop isolated from parent modal render tree (prevents 5Hz re-renders).
 * - Continuous vertical deflection precision scrubbing matching Spotify's native experience:
 *   - S(Y) = clamp(1.0 - 0.009 * max(0, Y - 30), 0.1, 1.0)
 * - Fine (0.1x), quarter (0.25x), and half-speed (0.5x) feedback pills with Lucide vector icons.
 * - Millisecond-accurate elapsed and remaining timecodes with formatDuration formatting.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { colors, radius } from '../../theme';
import { fontFamily } from '../../fonts';
import { formatDuration } from '../../utils/format';
import { hapticLight, hapticMedium } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function calculatePrecisionScrubSpeed(deflectionY: number): number {
  return Math.max(0.1, Math.min(1.0, 1.0 - 0.009 * Math.max(0, deflectionY - 30)));
}

export function getScrubPillLabel(speed: number): string {
  if (speed <= 0.25) return 'Fine Scrubbing (0.1x)';
  if (speed <= 0.55) return 'Quarter-Speed Scrubbing (0.25x)';
  if (speed < 0.95) return 'Half-Speed Scrubbing (0.5x)';
  return 'Normal Speed';
}

export interface PrecisionScrubberProps {
  durationMs: number;
  positionMs: () => number;
  seekToMs: (ms: number) => Promise<void>;
  accentColor?: string;
  isPlayerModalOpen: boolean;
  onPositionChange?: (posMs: number) => void;
}

export function PrecisionScrubber({
  durationMs,
  positionMs,
  seekToMs,
  accentColor = colors.amber,
  isPlayerModalOpen,
  onPositionChange,
}: PrecisionScrubberProps) {
  const [currentPosMs, setCurrentPosMs] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [scrubSpeed, setScrubSpeed] = useState(1.0);

  const trackBarWidthRef = useRef(SCREEN_WIDTH - 64);
  const lastTouchXRef = useRef(0);
  const startYRef = useRef(0);

  // Poll current position smoothly without bubbling re-renders to parent modal
  useEffect(() => {
    if (!isPlayerModalOpen) return;
    const interval = setInterval(() => {
      if (!isScrubbing) {
        const pos = positionMs();
        setCurrentPosMs(pos);
        onPositionChange?.(pos);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlayerModalOpen, isScrubbing, positionMs, onPositionChange]);

  const effectiveDuration = durationMs > 0 ? durationMs : 180000;
  const displayPosMs = isScrubbing ? scrubRatio * effectiveDuration : currentPosMs;
  const progressPercent = Math.min(100, Math.max(0, (displayPosMs / effectiveDuration) * 100));

  // Continuous Vertical Deflection Precision Scrubber PanResponder
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsScrubbing(true);
          const touchX = evt.nativeEvent.locationX;
          const initialRatio = Math.max(0, Math.min(1, touchX / trackBarWidthRef.current));
          setScrubRatio(initialRatio);
          lastTouchXRef.current = evt.nativeEvent.pageX;
          startYRef.current = evt.nativeEvent.pageY;
          setScrubSpeed(1.0);
          void hapticLight();
        },
        onPanResponderMove: (evt) => {
          const currentX = evt.nativeEvent.pageX;
          const currentY = evt.nativeEvent.pageY;
          const deltaX = currentX - lastTouchXRef.current;
          const deflectionY = Math.max(0, currentY - startYRef.current);

          const speed = calculatePrecisionScrubSpeed(deflectionY);
          setScrubSpeed(speed);

          const deltaRatio = (deltaX * speed) / trackBarWidthRef.current;
          setScrubRatio((prev) => Math.max(0, Math.min(1, prev + deltaRatio)));
          lastTouchXRef.current = currentX;
        },
        onPanResponderRelease: async () => {
          const finalRatio = scrubRatio;
          const targetMs = Math.round(finalRatio * effectiveDuration);
          setCurrentPosMs(targetMs);
          setIsScrubbing(false);
          setScrubSpeed(1.0);
          void hapticMedium();
          await seekToMs(targetMs);
          onPositionChange?.(targetMs);
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
          setScrubSpeed(1.0);
        },
      }),
    [effectiveDuration, scrubRatio, seekToMs, onPositionChange],
  );

  return (
    <View style={styles.progressSection}>
      {isScrubbing && scrubSpeed < 0.95 && (
        <View style={[styles.scrubTooltipPill, { borderColor: accentColor }]}>
          <Sparkles size={11} color={accentColor} style={{ marginRight: 4 }} />
          <Text style={[styles.scrubTooltipText, { color: accentColor }]}>
            {getScrubPillLabel(scrubSpeed)}
          </Text>
        </View>
      )}
      <View
        style={styles.progressTrack}
        onLayout={(e) => {
          trackBarWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${progressPercent}%`, backgroundColor: accentColor },
          ]}
        />
        <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
      </View>

      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatDuration(displayPosMs)}</Text>
        <Text style={styles.timeText}>
          {displayPosMs > 0
            ? `-${formatDuration(effectiveDuration - displayPosMs)}`
            : formatDuration(effectiveDuration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressSection: {
    marginVertical: 12,
  },
  scrubTooltipPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 24, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  scrubTooltipText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10.5,
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amber,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: '#777788',
  },
});
