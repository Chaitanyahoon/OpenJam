/**
 * Unified Spotify-Grade Mini-Player for OpenJam Mobile.
 *
 * Implements:
 * - Persistent floating capsule docked directly above the bottom tab navigation.
 * - Reanimated 4.5 & Gesture Handler multi-axis physics:
 *   - Horizontal Pan: swipe left for Next Track, swipe right for Previous Track with spring rebound.
 *   - Vertical Pan (swipe up) / Tap: expands full-screen SpotifyPlayerModal.
 * - Harmonized audio state: binds seamlessly to both collaborative live rooms (useRoom)
 *   and solo local listening (usePlayer) without UI conflicts.
 * - Clean modern album art card (rounded corners, no vinyl elements).
 * - Pinned bottom micro progress line with millisecond-smooth tracking.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Heart, Pause, Play, Radio, Speaker } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';
import { useOptionalRoom } from '../state/RoomContext';
import { hapticLight, hapticMedium } from '../utils/haptics';

const SWIPE_THRESHOLD = 65;

interface UnifiedMiniPlayerProps {
  bottomOffset?: number;
  onExpand?: () => void;
}

export function UnifiedMiniPlayer({
  bottomOffset = 0,
  onExpand,
}: UnifiedMiniPlayerProps) {
  const player = usePlayer();
  const playerStatus = usePlayerStatus();
  const room = useOptionalRoom();

  const [currentPosMs, setCurrentPosMs] = useState(0);

  // Poll current position smoothly when playing
  useEffect(() => {
    if (!player.currentTrack && !room?.nowPlaying) return;
    const interval = setInterval(() => {
      setCurrentPosMs(player.positionMs());
    }, 400);
    return () => clearInterval(interval);
  }, [player.currentTrack?.track_uri, room?.nowPlaying?.track_uri, playerStatus.playing, room?.isPlaying]);

  // Harmonized Active Track Resolution
  const isRoomActive = Boolean(room?.nowPlaying);
  const activeTrack = isRoomActive && room?.nowPlaying
    ? {
        title: room.nowPlaying.track_name,
        artist: room.nowPlaying.artist || 'Live Room Session',
        artworkUrl: room.nowPlaying.album_art_url || 'https://openjam.fun/default_art.png',
        isPlaying: room.isPlaying,
        isRoom: true,
        roomName: room.roomName || 'OpenJam Room',
      }
    : player.currentTrack
    ? {
        title: player.currentTrack.track_name,
        artist: player.currentTrack.artist || 'Unknown Artist',
        artworkUrl: player.currentTrack.album_art_url || 'https://openjam.fun/default_art.png',
        isPlaying: playerStatus.playing,
        isRoom: false,
        roomName: '',
      }
    : null;

  // Reanimated Physics Values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const expandPlayer = () => {
    void hapticLight();
    if (onExpand) {
      onExpand();
    } else {
      player.setPlayerModalOpen(true);
    }
  };

  const handleTogglePlay = () => {
    void hapticMedium();
    if (!activeTrack) return;
    if (activeTrack.isRoom && room) {
      if (room.isHost || room.canControl) {
        room.togglePlay();
      }
    } else {
      if (playerStatus.playing) {
        player.pause();
      } else {
        player.play();
      }
    }
  };

  const handleNext = () => {
    void hapticMedium();
    if (!activeTrack) return;
    if (activeTrack.isRoom && room) {
      if (room.isHost || room.canControl) {
        room.nextTrack();
      }
    } else {
      void player.playNext();
    }
  };

  const handlePrev = () => {
    void hapticMedium();
    if (!activeTrack) return;
    if (!activeTrack.isRoom) {
      void player.playPrev();
    }
  };

  // Pan Gesture: Horizontal swipe to skip, Upward drag to expand
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX * 0.75;
      if (e.translationY < 0) {
        translateY.value = e.translationY * 0.5;
      }
    })
    .onEnd((e) => {
      // Check upward drag for expand
      if (translateY.value < -40 || e.velocityY < -500) {
        runOnJS(expandPlayer)();
      }
      translateY.value = withSpring(0, { damping: 16, stiffness: 180 });

      // Check horizontal swipe for track skip
      if (translateX.value < -SWIPE_THRESHOLD || e.velocityX < -500) {
        runOnJS(handleNext)();
      } else if (translateX.value > SWIPE_THRESHOLD || e.velocityX > 500) {
        runOnJS(handlePrev)();
      }
      translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(expandPlayer)();
  });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  if (!activeTrack) {
    return null;
  }

  const effectiveDuration = playerStatus.durationMs > 0 ? playerStatus.durationMs : 180000;
  const progressPercent = Math.min(100, Math.max(0, (currentPosMs / effectiveDuration) * 100));

  return (
    <View
      style={[
        styles.containerWrapper,
        { bottom: bottomOffset + 12 },
      ]}
      pointerEvents="box-none"
    >
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            <View style={styles.contentRow}>
              {/* Clean Modern Album Art (No Vinyl) */}
              <Image
                source={{ uri: activeTrack.artworkUrl }}
                style={styles.artwork}
                contentFit="cover"
                transition={150}
              />

              {/* Title & Artist */}
              <View style={styles.trackInfo}>
                <View style={styles.titleRow}>
                  {activeTrack.isRoom && (
                    <View style={styles.liveRoomBadge}>
                      <Radio size={10} color={colors.amber} style={{ marginRight: 3 }} />
                      <Text style={styles.liveRoomBadgeText} numberOfLines={1}>
                        ROOM
                      </Text>
                    </View>
                  )}
                  <Text style={styles.title} numberOfLines={1}>
                    {activeTrack.title}
                  </Text>
                </View>
                <Text style={styles.artist} numberOfLines={1}>
                  {activeTrack.isRoom ? `🎧 ${activeTrack.artist}` : activeTrack.artist}
                </Text>
              </View>

              {/* Quick Actions */}
              <View style={styles.actions}>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    expandPlayer();
                  }}
                  hitSlop={8}
                  style={styles.actionBtn}
                  accessibilityLabel="Audio controls"
                >
                  <Speaker size={18} color="#9999aa" />
                </Pressable>

                {!activeTrack.isRoom && (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      void hapticMedium();
                      void player.toggleLike();
                    }}
                    hitSlop={10}
                    style={styles.actionBtn}
                    accessibilityLabel={player.isLiked ? 'Unlike song' : 'Like song'}
                  >
                    <Heart
                      size={20}
                      color={player.isLiked ? colors.amber : '#9999aa'}
                      fill={player.isLiked ? colors.amber : 'transparent'}
                    />
                  </Pressable>
                )}

                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    handleTogglePlay();
                  }}
                  hitSlop={10}
                  style={styles.playBtn}
                  accessibilityLabel={activeTrack.isPlaying ? 'Pause' : 'Play'}
                >
                  {activeTrack.isPlaying ? (
                    <Pause size={20} color="#08080a" fill="#08080a" />
                  ) : (
                    <Play size={20} color="#08080a" fill="#08080a" style={{ marginLeft: 2 }} />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Pinned Micro Progress Line */}
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
  );
}

const styles = StyleSheet.create({
  containerWrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9999,
  },
  container: {
    height: 56,
    backgroundColor: 'rgba(20, 18, 26, 0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.bgSurface,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  liveRoomBadgeText: {
    color: colors.amber,
    fontSize: 9,
    fontFamily: fontFamily.displayBold,
    letterSpacing: 0.5,
  },
  title: {
    color: colors.text1,
    fontSize: 13,
    fontFamily: fontFamily.displayBold,
    flexShrink: 1,
  },
  artist: {
    color: colors.text3,
    fontSize: 11,
    fontFamily: fontFamily.bodyRegular,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.amber,
  },
});
