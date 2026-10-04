/**
 * RoomCard — high-fidelity native card matching the PWA's .room-card component.
 * Features:
 * - Cover artwork with dark gradient overlay
 * - Live status badge (Live / 24/7 Lounge / Private)
 * - Real-time listeners chip with pulsing green dot
 * - 4-bar animated equalizer wave indicator when music is playing
 * - Host avatar with deterministic HSL brand coloring
 * - Now-playing track banner at the card bottom
 * - Amber glowing border on active press
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Music, Disc, Play, Bookmark } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import type { RoomSummary } from '../api';
import { isRoomFavorited, toggleFavoriteRoom } from '../storage/history';
import { useToast } from './ToastContext';

function nameColor(name?: string): string {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) {
    h = (name || '').charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 65%, 50%)`;
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/[\s-_]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** 4-bar dancing equalizer visualizer matching PWA .card-now-playing-equalizer */
function EqualizerWave() {
  const h1 = useSharedValue(4);
  const h2 = useSharedValue(12);
  const h3 = useSharedValue(8);
  const h4 = useSharedValue(14);

  useEffect(() => {
    h1.value = withRepeat(withSequence(withTiming(14, { duration: 320 }), withTiming(4, { duration: 280 })), -1, true);
    h2.value = withRepeat(withSequence(withTiming(4, { duration: 240 }), withTiming(16, { duration: 360 })), -1, true);
    h3.value = withRepeat(withSequence(withTiming(16, { duration: 380 }), withTiming(6, { duration: 300 })), -1, true);
    h4.value = withRepeat(withSequence(withTiming(6, { duration: 260 }), withTiming(12, { duration: 340 })), -1, true);
  }, [h1, h2, h3, h4]);

  const s1 = useAnimatedStyle(() => ({ height: h1.value }));
  const s2 = useAnimatedStyle(() => ({ height: h2.value }));
  const s3 = useAnimatedStyle(() => ({ height: h3.value }));
  const s4 = useAnimatedStyle(() => ({ height: h4.value }));

  return (
    <View style={styles.eqPill}>
      <Animated.View style={[styles.eqBar, s1]} />
      <Animated.View style={[styles.eqBar, s2]} />
      <Animated.View style={[styles.eqBar, s3]} />
      <Animated.View style={[styles.eqBar, s4]} />
    </View>
  );
}

export function RoomCard({
  room,
  onPress,
  onFavoriteToggle,
}: {
  room: RoomSummary;
  onPress: () => void;
  onFavoriteToggle?: () => void;
}) {
  const toast = useToast();
  const [favorited, setFavorited] = useState(false);
  const isPlaying = !!(room.now_playing && room.now_playing.track_name);
  const coverUrl = room.now_playing?.album_art_url;
  const isLounge = room.id === 'openjam-lounge';

  useEffect(() => {
    void isRoomFavorited(room.id).then(setFavorited);
  }, [room.id]);

  const handleToggleFavorite = async () => {
    const isNowFav = await toggleFavoriteRoom({
      id: room.id,
      name: room.name,
      hostName: room.host_name,
      genreTags: room.genre_tags,
    });
    setFavorited(isNowFav);
    onFavoriteToggle?.();
    toast(
      isNowFav ? `Pinned "${room.name}" to Saved Rooms` : `Unpinned "${room.name}"`,
      'info',
    );
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={['rgba(24, 24, 34, 0.85)', 'rgba(12, 12, 16, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.card}
      >
        {/* Card Cover Area */}
        <View style={styles.coverWrap}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.coverImg} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient
              colors={['#1c1c28', '#0c0c12']}
              style={[styles.coverImg, styles.coverFallback]}
            >
              <Music size={40} color={colors.amber} opacity={0.3} />
            </LinearGradient>
          )}

          {/* Fade over bottom of cover */}
          <LinearGradient
            colors={['transparent', 'rgba(12, 12, 16, 0.95)']}
            style={styles.coverFade}
          />

          {/* Top Badges Overlay */}
          <View style={styles.badgesOverlay}>
            <View
              style={[
                styles.badge,
                isLounge ? styles.badgeLounge : room.is_private ? styles.badgePrivate : styles.badgeLive,
              ]}
            >
              <View
                style={[
                  styles.badgeDot,
                  { backgroundColor: isLounge ? colors.amber : room.is_private ? '#a855f7' : colors.red },
                ]}
              />
              <Text style={styles.badgeText}>
                {isLounge ? '24/7 Lounge' : room.is_private ? 'Private' : 'LIVE'}
              </Text>
            </View>

            <View style={styles.badgesRight}>
              {isPlaying && <EqualizerWave />}
              <View style={styles.listenersChip}>
                <View style={styles.listenersDot} />
                <Text style={styles.listenersCount}>{room.listener_count ?? 0}</Text>
              </View>
              <Pressable
                onPress={handleToggleFavorite}
                hitSlop={8}
                style={({ pressed }) => [styles.favoriteBtn, pressed && styles.favoriteBtnPressed]}
                accessibilityLabel={favorited ? 'Unpin room' : 'Pin room'}
              >
                <Bookmark
                  size={12}
                  color={favorited ? colors.amber : '#ffffff'}
                  fill={favorited ? colors.amber : 'transparent'}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Card Body Details */}
        <View style={styles.details}>
          {room.genre_tags && room.genre_tags.length > 0 ? (
            <View style={styles.tagChipsRow}>
              {room.genre_tags.slice(0, 3).map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.title} numberOfLines={1}>
            {room.name}
          </Text>

          {/* Host attribution */}
          <View style={styles.hostRow}>
            {room.host_avatar_url ? (
              <Image source={{ uri: room.host_avatar_url }} style={styles.hostAvatar} contentFit="cover" />
            ) : (
              <View
                style={[
                  styles.hostAvatar,
                  styles.hostAvatarFallback,
                  { backgroundColor: nameColor(room.host_name) },
                ]}
              >
                <Text style={styles.hostInitials}>{getInitials(room.host_name)}</Text>
              </View>
            )}
            <Text style={styles.hostText} numberOfLines={1}>
              Hosted by <Text style={styles.hostName}>{room.host_name || 'Anonymous'}</Text>
            </Text>
          </View>
        </View>

        {/* Bottom Now-Playing Banner */}
        <View style={styles.nowPlayingBanner}>
          <Disc size={15} color={colors.amber} />
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>
              {isPlaying ? room.now_playing!.track_name : 'No track playing'}
            </Text>
            <Text style={styles.artistName} numberOfLines={1}>
              {isPlaying ? room.now_playing!.artist : 'Idle room'}
            </Text>
          </View>
          <View style={styles.joinBtn}>
            <Play size={10} color={colors.amber} fill={colors.amber} style={{ marginLeft: 1 }} />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    backgroundColor: '#0c0c12',
    // Card elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 6,
  },
  coverWrap: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverGlyph: {
    fontSize: 48,
    color: colors.amber,
    opacity: 0.25,
  },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  badgesOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 5,
  },
  badgeLive: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  badgeLounge: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderColor: 'rgba(255, 159, 28, 0.5)',
  },
  badgePrivate: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eqPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.4)',
    gap: 3,
    height: 24,
  },
  eqBar: {
    width: 2.5,
    backgroundColor: colors.amber,
    borderRadius: 1,
  },
  listenersChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  listenersDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  listenersCount: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: '#ffffff',
  },
  favoriteBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtnPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.8,
  },
  details: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  tagChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  tagChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagChipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: colors.amber,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.text1,
    letterSpacing: -0.2,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  hostAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  hostAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostInitials: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: '#ffffff',
  },
  hostText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    flex: 1,
  },
  hostName: {
    fontFamily: fontFamily.bodySemiBold,
    color: colors.text1,
  },
  nowPlayingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 26, 0.7)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  musicNote: {
    fontSize: 13,
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  artistName: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  joinBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinArrow: {
    fontSize: 10,
    color: colors.amber,
    marginLeft: 1,
  },
});
