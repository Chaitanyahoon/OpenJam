/**
 * Floating MiniPlayer & Spotify Full-Screen Sheet Integration.
 *
 * Renders a persistent floating pill docked right above the bottom navigation bar
 * on all screens (Home, Playlists, Vault).
 *
 * Capabilities:
 * - 0-latency feedback for Play/Pause and Like toggling.
 * - Smooth bottom progress bar line.
 * - Tap expands the full SpotifyPlayerModal sheet.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Heart, Play, Pause, Speaker } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';
import { SpotifyPlayerModal } from './SpotifyPlayerModal';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface MiniPlayerProps {
  bottomOffset?: number;
}

export function MiniPlayer({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const {
    currentTrack,
    isLiked,
    play,
    pause,
    positionMs,
    toggleLike,
    setPlayerModalOpen,
  } = usePlayer();

  const { playing, durationMs } = usePlayerStatus();
  const [currentPosMs, setCurrentPosMs] = useState(0);

  useEffect(() => {
    if (!currentTrack) return;
    const interval = setInterval(() => {
      setCurrentPosMs(positionMs());
    }, 400);
    return () => clearInterval(interval);
  }, [currentTrack, positionMs]);

  if (!currentTrack) {
    return <SpotifyPlayerModal />;
  }

  const effectiveDuration = durationMs > 0 ? durationMs : 180000;
  const progressPercent = Math.min(100, Math.max(0, (currentPosMs / effectiveDuration) * 100));

  return (
    <>
      <Pressable
        onPress={() => {
          void hapticLight();
          setPlayerModalOpen(true);
        }}
        style={({ pressed }) => [
          styles.container,
          { bottom: bottomOffset + 12 },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Now playing ${currentTrack.track_name} by ${currentTrack.artist}. Tap to expand full player.`}
      >
        <View style={styles.contentRow}>
          {/* Cover Art */}
          <Image
            source={{ uri: currentTrack.album_art_url || 'https://openjam.fun/default_art.png' }}
            style={styles.artwork}
            contentFit="cover"
            transition={150}
          />

          {/* Title & Artist */}
          <View style={styles.trackInfo}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.track_name}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist || 'Unknown Artist'}
            </Text>
          </View>

          {/* Quick Actions (Output Device + Like + Play/Pause) */}
          <View style={styles.actions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                void hapticLight();
                setPlayerModalOpen(true);
              }}
              hitSlop={8}
              style={styles.actionBtn}
              accessibilityLabel="Audio devices and controls"
            >
              <Speaker size={18} color="#9999aa" />
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                void hapticMedium();
                void toggleLike();
              }}
              hitSlop={10}
              style={styles.actionBtn}
              accessibilityLabel={isLiked ? 'Unlike song' : 'Like song'}
            >
              <Heart
                size={20}
                color={isLiked ? colors.amber : '#9999aa'}
                fill={isLiked ? colors.amber : 'transparent'}
              />
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                void hapticMedium();
                if (playing) pause();
                else play();
              }}
              hitSlop={10}
              style={styles.playBtn}
              accessibilityLabel={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause size={20} color="#08080a" fill="#08080a" />
              ) : (
                <Play size={20} color="#08080a" fill="#08080a" style={{ marginLeft: 2 }} />
              )}
            </Pressable>
          </View>
        </View>

        {/* Micro progress line along the bottom edge */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
      </Pressable>

      <SpotifyPlayerModal />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 56,
    backgroundColor: 'rgba(20, 18, 26, 0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 999,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#111118',
  },
  trackInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: '#ffffff',
  },
  artist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: '#9999aa',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 2.5,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.amber,
  },
});
