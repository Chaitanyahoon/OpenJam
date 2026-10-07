/**
 * RoomCard — high-fidelity native card matching the PWA's .room-card component.
 * Features:
 * - Cover artwork with dark gradient overlay OR Analog Vinyl Turntable stage when idle
 * - Live status badge (Live / 24/7 Lounge / Private)
 * - Real-time listeners chip with pulsing green dot
 * - 4-bar animated equalizer wave indicator when music is playing
 * - Host avatar with deterministic HSL brand coloring
 * - High-affordance Now-playing track banner with "Tune In" / "Join Jam" pill CTA
 * - Amber glowing border on active press
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Music, Disc, Play, Bookmark, Radio, Sparkles, Lock, Headphones } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import type { RoomSummary } from '../api';
import { isRoomFavorited, toggleFavoriteRoom } from '../storage/history';
import { hapticMedium } from '../utils/haptics';
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
    h1.value = withRepeat(
      withSequence(withTiming(14, { duration: 320 }), withTiming(4, { duration: 280 })),
      -1,
      true,
    );
    h2.value = withRepeat(
      withSequence(withTiming(4, { duration: 240 }), withTiming(16, { duration: 360 })),
      -1,
      true,
    );
    h3.value = withRepeat(
      withSequence(withTiming(16, { duration: 380 }), withTiming(6, { duration: 300 })),
      -1,
      true,
    );
    h4.value = withRepeat(
      withSequence(withTiming(6, { duration: 260 }), withTiming(12, { duration: 340 })),
      -1,
      true,
    );
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

/** Visual analog vinyl turntable stage rendered when no album art is loaded */
function VinylTurntableStage({
  isPlaying,
}: {
  isLounge?: boolean;
  isPlaying: boolean;
}) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 6000, easing: Easing.linear }),
        -1,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = withTiming(rotation.value + 120, {
        duration: 600,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [isPlaying, rotation]);

  const discAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value % 360}deg` }],
  }));

  return (
    <View style={styles.turntableStage}>
      {/* Ambient warm radial glow behind the record */}
      <View
        style={[
          styles.turntableAura,
          isPlaying && styles.turntableAuraActive,
        ]}
      />

      {/* Vinyl Record Disc */}
      <Animated.View
        style={[
          styles.vinylRecord,
          discAnimatedStyle,
        ]}
      >
        {/* Concentric groove rings */}
        <View style={styles.grooveRing1} />
        <View style={styles.grooveRing2} />
        <View style={styles.grooveRing3} />

        {/* Center Vinyl Label */}
        <View
          style={[
            styles.vinylCenterLabel,
            isPlaying && styles.vinylCenterLabelActive,
          ]}
        >
          <Disc size={13} color={colors.amber} strokeWidth={2.4} />
          {/* Spindle hole */}
          <View style={styles.spindleHole} />
        </View>
      </Animated.View>
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
  const [imageError, setImageError] = useState(false);
  const isPlaying = !!(room.now_playing && room.now_playing.track_name);
  const rawCover = room.now_playing?.album_art_url || room.current_track?.album_art_url;
  const coverUrl = rawCover?.trim();
  const isValidHttpUrl = !!coverUrl && (coverUrl.startsWith('http://') || coverUrl.startsWith('https://'));
  const hasValidCover = isValidHttpUrl && !imageError;
  const isLounge = room.id === 'openjam-lounge';

  useEffect(() => {
    void isRoomFavorited(room.id).then(setFavorited);
  }, [room.id]);

  useEffect(() => {
    setImageError(false);
  }, [coverUrl]);

  const handleToggleFavorite = async () => {
    void hapticMedium();
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
      style={({ pressed }) => [
        styles.wrapper,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Room ${room.name}, ${isPlaying ? `Now playing ${room.now_playing?.track_name}` : 'Idle room'}`}
    >
      <LinearGradient
        colors={['rgba(24, 24, 34, 0.95)', 'rgba(12, 12, 18, 0.98)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.card}
      >
        {/* Card Cover Area */}
        <View style={styles.coverWrap}>
          {hasValidCover ? (
            <>
              <Image
                source={{ uri: coverUrl }}
                style={styles.coverImg}
                contentFit="cover"
                transition={200}
                onError={() => setImageError(true)}
              />
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.4)', 'transparent', 'rgba(12, 12, 18, 0.95)']}
                style={StyleSheet.absoluteFill}
              />
              {/* Fade over bottom of cover */}
              <LinearGradient
                colors={['transparent', 'rgba(12, 12, 18, 0.98)']}
                style={styles.coverFade}
              />
            </>
          ) : (
            <VinylTurntableStage isPlaying={isPlaying} />
          )}

          {/* Top Badges Overlay */}
          <View style={styles.badgesOverlay}>
            <View
              style={[
                styles.badge,
                isLounge ? styles.badgeLounge : room.is_private ? styles.badgePrivate : styles.badgeLive,
              ]}
            >
              {room.is_private ? (
                <Lock size={10} color="#c084fc" strokeWidth={2.4} />
              ) : (
                <View
                  style={[
                    styles.badgeDot,
                    { backgroundColor: isLounge ? colors.amber : colors.red },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.badgeText,
                  room.is_private && { color: '#e9d5ff' },
                  isLounge && { color: colors.amber },
                ]}
                maxFontSizeMultiplier={1.15}
              >
                {isLounge ? '24/7 Lounge' : room.is_private ? 'Private' : 'LIVE'}
              </Text>
            </View>

            <View style={styles.badgesRight}>
              {isPlaying && <EqualizerWave />}
              <View style={styles.listenersChip}>
                <Headphones size={11} color={colors.green} />
                <Text style={styles.listenersCount} maxFontSizeMultiplier={1.15}>
                  {room.listener_count ?? 0}
                </Text>
              </View>
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  void handleToggleFavorite();
                }}
                hitSlop={10}
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
                  <Text style={styles.tagChipText} numberOfLines={1} maxFontSizeMultiplier={1.15}>
                    {tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text
            style={styles.title}
            numberOfLines={1}
            maxFontSizeMultiplier={1.25}
          >
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
                <Text style={styles.hostInitials} maxFontSizeMultiplier={1.0}>
                  {getInitials(room.host_name)}
                </Text>
              </View>
            )}
            <Text style={styles.hostText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              Hosted by <Text style={styles.hostName}>{room.host_name || 'Anonymous'}</Text>
            </Text>
          </View>
        </View>

        {/* Bottom Now-Playing Banner */}
        <View style={styles.nowPlayingBanner}>
          <View style={styles.nowPlayingLeft}>
            {isPlaying ? (
              <View style={styles.discIconWrap}>
                <Disc size={15} color={colors.amber} strokeWidth={2.4} />
              </View>
            ) : (
              <View style={styles.radioIconWrap}>
                <Radio size={13} color={colors.text3} />
              </View>
            )}
            <View style={styles.trackInfo}>
              <Text
                style={[styles.trackName, !isPlaying && styles.trackNameIdle]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}
              >
                {isPlaying ? room.now_playing!.track_name : 'Ready to Jam'}
              </Text>
              <Text style={styles.artistName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {isPlaying
                  ? room.now_playing!.artist || 'Playing track'
                  : 'Be the first to queue a track'}
              </Text>
            </View>
          </View>

          {isPlaying ? (
            <View style={styles.tuneInCta}>
              <Play size={9.5} color="#08080a" fill="#08080a" />
              <Text style={styles.tuneInCtaText} maxFontSizeMultiplier={1.15}>
                Tune In
              </Text>
            </View>
          ) : (
            <View style={styles.joinJamCta}>
              <Play size={8.5} color={colors.amber} fill={colors.amber} />
              <Text style={styles.joinJamCtaText} maxFontSizeMultiplier={1.15}>
                Join Jam
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: 'hidden',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    backgroundColor: '#0c0c12',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 4,
  },
  coverWrap: {
    height: 136,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0c0c12',
  },
  coverImg: {
    width: '100%',
    height: '100%',
  },
  coverFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 42,
  },
  turntableStage: {
    height: 136,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d14',
    position: 'relative',
    overflow: 'hidden',
    paddingTop: 16,
  },
  turntableAura: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
  },
  turntableAuraActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.18)',
  },
  vinylRecord: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#111118',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
  },
  grooveRing1: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  grooveRing2: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  grooveRing3: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  vinylCenterLabel: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylCenterLabelActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.32)',
    borderColor: colors.amber,
  },
  spindleHole: {
    position: 'absolute',
    width: 4.5,
    height: 4.5,
    borderRadius: 2.25,
    backgroundColor: '#08080a',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  badgesOverlay: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4.5,
    flexShrink: 0,
  },
  badgeLive: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  badgeLounge: {
    backgroundColor: 'rgba(255, 159, 28, 0.18)',
    borderColor: 'rgba(255, 159, 28, 0.45)',
  },
  badgePrivate: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    color: '#ffffff',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badgesRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
  },
  eqPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.4)',
    gap: 2,
    height: 18,
  },
  eqBar: {
    width: 2,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    flexShrink: 0,
  },
  listenersCount: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#ffffff',
  },
  favoriteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  favoriteBtnPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.8,
  },
  details: {
    paddingHorizontal: 15,
    paddingTop: 11,
    paddingBottom: 11,
  },
  tagChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
    overflow: 'hidden',
  },
  tagChip: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.22)',
    borderRadius: radius.full,
    paddingHorizontal: 7.5,
    paddingVertical: 2,
    maxWidth: 130,
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
    fontSize: 16.5,
    lineHeight: 22,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 7,
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
    fontSize: 8.5,
    color: '#ffffff',
  },
  hostText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
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
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 16, 24, 0.75)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  nowPlayingLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  discIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  trackName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  trackNameIdle: {
    color: colors.text1,
  },
  artistName: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10.5,
    color: colors.text3,
    marginTop: 0.5,
  },
  tuneInCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
    flexShrink: 0,
  },
  tuneInCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#08080a',
  },
  joinJamCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.32)',
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
    flexShrink: 0,
  },
  joinJamCtaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
});
