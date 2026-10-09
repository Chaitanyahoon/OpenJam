import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Headphones, KeyRound, Sparkles } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';

const SLOGANS = ['In Sync.', 'With Friends.', 'In Real-Time.', 'In Harmony.'] as const;

/** Memoized ticker prevents full parent screen re-renders every 2.8s */
export const SloganTicker = React.memo(function SloganTicker() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);
  return <Text style={styles.heroTitleAmber}>{SLOGANS[index]}</Text>;
});

export interface HeroHeaderProps {
  onStartSoloJam: () => void;
  onCreateLiveRoom?: () => void;
  onCreateRoom?: () => void;
  onJoinWithCode?: () => void;
  onExploreRooms?: () => void;
}

export const HeroHeader: React.FC<HeroHeaderProps> = ({
  onStartSoloJam,
  onCreateLiveRoom,
  onCreateRoom,
  onJoinWithCode,
  onExploreRooms,
}) => {
  const handleCreateRoom = () => {
    if (onCreateLiveRoom) onCreateLiveRoom();
    else if (onCreateRoom) onCreateRoom();
  };

  const handleJoinCode = () => {
    if (onJoinWithCode) onJoinWithCode();
    else if (onExploreRooms) onExploreRooms();
  };

  return (
    <View style={styles.heroGlassCard}>
      <LinearGradient
        colors={['rgba(24, 24, 34, 0.90)', 'rgba(12, 12, 18, 0.96)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Main Title with Animated Slogan Ticker */}
      <Text style={styles.heroTitle}>
        Listen Together.{' '}
        <SloganTicker />
      </Text>

      <Text style={styles.heroSubtitle}>
        Synchronized music listening with zero audio latency.
      </Text>

      {/* Action Buttons: Solo Jam + Social Jam Actions */}
      <View style={styles.heroActions}>
        <Pressable
          onPress={onStartSoloJam}
          style={({ pressed }) => [styles.soloBtn, pressed && styles.pressed]}
          accessibilityLabel="Start Solo Jam"
        >
          <LinearGradient
            colors={['#ffb03a', '#ff9f1c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Headphones size={17} color="#08080a" strokeWidth={2.4} />
          <Text style={styles.soloBtnText}>Solo Jam • Listen Immediately</Text>
        </Pressable>

        <View style={styles.heroSecondaryActions}>
          <Pressable
            onPress={handleCreateRoom}
            style={({ pressed }) => [styles.instantBtnSecondary, pressed && styles.pressed]}
            accessibilityLabel="Create Live Room"
          >
            <Sparkles size={14} color="#ffffff" strokeWidth={2.2} />
            <Text style={styles.instantSecondaryText}>Create Live Room</Text>
          </Pressable>

          <Pressable
            onPress={handleJoinCode}
            style={({ pressed }) => [
              styles.joinCodeBtn,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Join with Code"
          >
            <KeyRound size={14} color="#ffffff" strokeWidth={2.2} />
            <Text style={styles.joinCodeBtnText}>Join Code</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroGlassCard: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  heroTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
    lineHeight: 28,
    marginTop: 2,
    textAlign: 'center',
  },
  heroTitleAmber: {
    color: colors.amber,
  },
  heroSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13.5,
    color: colors.text2,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 340,
    marginTop: 4,
    marginBottom: 16,
  },
  heroActions: {
    width: '100%',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  soloBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.full,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  soloBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14.5,
    color: '#08080a',
    letterSpacing: 0.2,
  },
  heroSecondaryActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  instantBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 159, 28, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
  },
  instantSecondaryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
  },
  joinCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  joinCodeBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  pressed: {
    opacity: 0.8,
  },
});
