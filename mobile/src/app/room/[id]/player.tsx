/**
 * Player tab — Spotify Phone App inspired turntable listening room.
 *
 * Sizing & Layout overhaul:
 * - Responsive prominent album artwork stage scaled to phone width (up to 340px)
 * - 60 FPS spinning vinyl record disc sliding out behind sleeve on playback
 * - Bold high-contrast typography (24px track title, 16px artist)
 * - Full-width tactile scrubber with monospace tabular-num timecodes and thumb knob
 * - Spotify transport controls: 72px center Play/Pause with glowing amber aura,
 *   generous 48px Prev/Next buttons, Shuffle & Loop toggles
 * - Live audio 8-bar equalizer pulse above the scrubber
 * - Spotify-style Connected Device / Room In-Sync status bar
 * - Vote to Skip counter and quick action
 * - Synced Karaoke lyrics card with tap-to-seek and auto-scroll centering
 * - Empty state with immediate "Add Songs to Queue" CTA
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Music,
  MessageSquareQuote,
  Radio,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Plus,
  Heart,
  Flame,
  Sparkles,
  ThumbsUp,
  Search,
  DownloadCloud,
  CheckCircle2,
  HardDrive,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { usePlayer, usePlayerStatus } from '../../../audio/PlayerContext';
import { fetchLyrics, type Lyrics, activeLyricIndex } from '../../../audio/lyrics';
import { useToast } from '../../../components/ToastContext';
import {
  downloadTrackToVault,
  getVaultTracks,
  filterSessionTracksToDownloadPure,
} from '../../../storage/vault';
import type { TrackInfo } from '../../../sync/protocol';
import {
  hapticSelection,
  hapticMedium,
  hapticLight,
  hapticHeavy,
} from '../../../utils/haptics';

export const REACTION_OPTIONS = [
  { id: 'heart', label: 'Love', icon: <Heart size={14} color="#ef4444" fill="#ef4444" /> },
  { id: 'fire', label: 'Fire', icon: <Flame size={14} color="#f97316" fill="#f97316" /> },
  { id: 'sparkles', label: 'Magic', icon: <Sparkles size={14} color={colors.amber} fill={colors.amber} /> },
  { id: 'thumbsup', label: 'Vibe', icon: <ThumbsUp size={14} color="#3b82f6" fill="#3b82f6" /> },
  { id: 'music', label: 'Jam', icon: <Music size={14} color="#a855f7" /> },
];

const DEFAULT_ARTWORK_SIZE = 280;

const STARTER_VIBES = [
  {
    id: 'lofi',
    track_name: 'Lofi Hip Hop Chill Beats',
    artist: 'Lofi Girl',
    track_uri: 'jfKfPfyJRdk',
    album_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
    duration_ms: 180000,
  },
  {
    id: 'synthwave',
    track_name: 'Synthwave Night Drive',
    artist: 'Retro Dreamer',
    track_uri: '4xDzrJKXOOY',
    album_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
    duration_ms: 210000,
  },
  {
    id: 'coffee',
    track_name: 'Coffee Shop Acoustic Chill',
    artist: 'Acoustic Jam',
    track_uri: '5qap5aO4i9A',
    album_art_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=300&q=80',
    duration_ms: 195000,
  },
];

function fmt(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00';
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const lyricsCache = new Map<string, Lyrics>();

export default function PlayerTab() {
  const {
    roomId,
    roomName,
    nowPlaying,
    isPlaying,
    loop,
    canControl,
    isHost,
    queue,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleRepeat,
    shuffleQueue,
    seekToMs,
    voteSkip,
    skipVotes,
    syncReady,
    sendReaction,
    addTrack,
    playNow,
  } = useRoom();
  const toast = useToast();
  const player = usePlayer();
  const { durationMs } = usePlayerStatus();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isRoomEmpty = !nowPlaying;

  // Responsive modern artwork sizing (Hero album card)
  const maxAvailableWidth = windowWidth - spacing.lg * 2;
  const maxStageWidth = Math.min(maxAvailableWidth, 380);
  const artworkSize = Math.max(180, Math.min(maxStageWidth, Math.floor(windowHeight * 0.36), 320));

  const [pos, setPos] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      if (player) {
        setPos(player.positionMs());
      }
    }, 250);
    return () => clearInterval(t);
  }, [player]);

  const [barWidth, setBarWidth] = useState(0);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<Lyrics>({ lines: [], synced: false });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);

  // 1-Tap Offline Vault Session Saver
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [isVaultSaved, setIsVaultSaved] = useState(false);

  const handleSaveSessionToVault = useCallback(async () => {
    try {
      setIsSavingVault(true);
      const existing = await getVaultTracks();
      const existingUris = new Set(existing.map((t) => t.track_uri));
      const toDownload = filterSessionTracksToDownloadPure(nowPlaying, queue, existingUris);

      if (toDownload.length === 0) {
        if (!nowPlaying && queue.length === 0) {
          toast('No tracks in session to save', 'info');
        } else {
          setIsVaultSaved(true);
          toast('All session tracks already in your vault!', 'info');
        }
        return;
      }

      toast(`Saving ${toDownload.length} session track${toDownload.length > 1 ? 's' : ''} to vault…`, 'info');
      let savedCount = 0;
      for (const track of toDownload) {
        try {
          await downloadTrackToVault(track, false);
          savedCount++;
        } catch (e) {
          console.warn('Failed saving track to vault:', track.track_name, e);
        }
      }
      setIsVaultSaved(true);
      toast(`Saved ${savedCount} track${savedCount > 1 ? 's' : ''} to offline vault!`, 'success');
      void hapticMedium();
    } catch (err) {
      console.warn('Failed saving session to vault:', err);
      toast('Could not save session to vault', 'error');
    } finally {
      setIsSavingVault(false);
    }
  }, [nowPlaying, queue, toast]);

  // Subtle modern audio equalizer bars
  const eq1 = useSharedValue(6);
  const eq2 = useSharedValue(12);
  const eq3 = useSharedValue(18);
  const eq4 = useSharedValue(8);

  useEffect(() => {
    if (isPlaying) {
      eq1.value = withRepeat(
        withSequence(withTiming(18, { duration: 320, easing: Easing.inOut(Easing.quad) }), withTiming(6, { duration: 380, easing: Easing.inOut(Easing.quad) })),
        -1,
        true,
      );
      eq2.value = withRepeat(
        withSequence(withTiming(24, { duration: 420, easing: Easing.inOut(Easing.quad) }), withTiming(8, { duration: 350, easing: Easing.inOut(Easing.quad) })),
        -1,
        true,
      );
      eq3.value = withRepeat(
        withSequence(withTiming(10, { duration: 280, easing: Easing.inOut(Easing.quad) }), withTiming(22, { duration: 450, easing: Easing.inOut(Easing.quad) })),
        -1,
        true,
      );
      eq4.value = withRepeat(
        withSequence(withTiming(20, { duration: 360, easing: Easing.inOut(Easing.quad) }), withTiming(6, { duration: 300, easing: Easing.inOut(Easing.quad) })),
        -1,
        true,
      );
    } else {
      eq1.value = withTiming(4, { duration: 250 });
      eq2.value = withTiming(4, { duration: 250 });
      eq3.value = withTiming(4, { duration: 250 });
      eq4.value = withTiming(4, { duration: 250 });
    }
  }, [isPlaying, eq1, eq2, eq3, eq4]);

  const eq1Style = useAnimatedStyle(() => ({ height: eq1.value }));
  const eq2Style = useAnimatedStyle(() => ({ height: eq2.value }));
  const eq3Style = useAnimatedStyle(() => ({ height: eq3.value }));
  const eq4Style = useAnimatedStyle(() => ({ height: eq4.value }));

  const duration =
    durationMs > 0 ? durationMs : (nowPlaying?.duration_ms ?? 0);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPos, setScrubPos] = useState(0);
  const scrubPosRef = useRef(0);
  const barWidthRef = useRef(0);
  barWidthRef.current = barWidth;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const canControlRef = useRef(canControl);
  canControlRef.current = canControl;

  const barLayoutRef = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 0 });
  const scrubberViewRef = useRef<View>(null);

  const measureScrubber = useCallback(() => {
    scrubberViewRef.current?.measure((_x, _y, width, _height, pageX) => {
      if (width > 0) {
        barLayoutRef.current = { pageX, width };
        setBarWidth(width);
      }
    });
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canControlRef.current,
        onMoveShouldSetPanResponder: () => canControlRef.current,
        onPanResponderGrant: (evt) => {
          if (!canControlRef.current || durationRef.current <= 0) return;
          measureScrubber();
          const pageX = evt.nativeEvent.pageX;
          const left = barLayoutRef.current.pageX || 0;
          const width = barLayoutRef.current.width || barWidthRef.current;
          if (width <= 0) return;
          const touchX = pageX - left;
          const target = Math.round(
            (Math.max(0, Math.min(touchX, width)) / width) * durationRef.current,
          );
          scrubPosRef.current = target;
          setScrubPos(target);
          setIsScrubbing(true);
          void hapticSelection();
        },
        onPanResponderMove: (evt) => {
          if (!canControlRef.current || durationRef.current <= 0) return;
          const pageX = evt.nativeEvent.pageX;
          const left = barLayoutRef.current.pageX || 0;
          const width = barLayoutRef.current.width || barWidthRef.current;
          if (width <= 0) return;
          const touchX = pageX - left;
          const target = Math.round(
            (Math.max(0, Math.min(touchX, width)) / width) * durationRef.current,
          );
          if (Math.abs(target - scrubPosRef.current) > 1000) {
            void hapticSelection();
          }
          scrubPosRef.current = target;
          setScrubPos(target);
        },
        onPanResponderRelease: () => {
          if (!canControlRef.current || durationRef.current <= 0) {
            setIsScrubbing(false);
            return;
          }
          const finalTarget = scrubPosRef.current;
          setIsScrubbing(false);
          seekToMs(finalTarget);
          void hapticMedium();
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
        },
      }),
    [seekToMs, measureScrubber],
  );

  const displayPos = isScrubbing ? scrubPos : pos;
  const ratio = duration > 0 ? Math.min(1, Math.max(0, displayPos / duration)) : 0;

  // Lazy-load lyrics only when sheet is opened (or if track changes while open)
  useEffect(() => {
    if (!lyricsOpen) return;
    if (!nowPlaying?.track_name) {
      setLyrics({ lines: [], synced: false });
      return;
    }
    const cacheKey = nowPlaying.track_uri || `${nowPlaying.artist || ''}-${nowPlaying.track_name}`;
    const cached = lyricsCache.get(cacheKey);
    if (cached) {
      setLyrics(cached);
      return;
    }
    let cancelled = false;
    setLyricsLoading(true);
    const durSec = Math.round(duration / 1000);
    fetchLyrics(nowPlaying.artist ?? '', nowPlaying.track_name, durSec)
      .then((res) => {
        if (!cancelled) {
          lyricsCache.set(cacheKey, res);
          setLyrics(res);
        }
      })
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lyricsOpen, nowPlaying?.track_name, nowPlaying?.artist, nowPlaying?.track_uri, duration]);

  // Active line calculation for synced lyrics
  const activeIdx = useMemo(() => {
    if (!lyrics.synced || lyrics.lines.length === 0) return -1;
    return activeLyricIndex(lyrics.lines, pos);
  }, [lyrics.lines, lyrics.synced, pos]);

  // Auto-scroll lyrics to keep active line centered
  useEffect(() => {
    if (lyricsOpen && lyrics.synced && activeIdx >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTo({
        y: Math.max(0, activeIdx * 42 - 100),
        animated: true,
      });
    }
  }, [activeIdx, lyricsOpen, lyrics.synced]);

  const onSeekPress = (e: GestureResponderEvent) => {
    if (!canControl || duration <= 0) return;
    measureScrubber();
    const pageX = e.nativeEvent.pageX;
    const left = barLayoutRef.current.pageX || 0;
    const width = barLayoutRef.current.width || barWidth;
    if (width <= 0) return;
    const touchX = pageX - left;
    const targetMs = Math.round((Math.max(0, Math.min(touchX, width)) / width) * duration);
    seekToMs(targetMs);
  };

  const navigation = useNavigation<any>();
  const goQueue = () => {
    try {
      navigation.navigate('queue');
    } catch {
      router.navigate({ pathname: '/room/[id]/queue', params: { id: roomId } });
    }
  };

  const art = nowPlaying?.album_art_url;

  return (
    <View style={styles.safe}>
      {/* Ambient background bloom gradient derived from album art */}
      <View style={styles.ambientBloom} pointerEvents="none">
        <LinearGradient
          colors={['rgba(255, 159, 28, 0.20)', 'rgba(255, 159, 28, 0.04)', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 16) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isRoomEmpty ? (
          /* Modern Minimalist Waiting Stage */
          <View style={[styles.emptyArtworkCard, { width: artworkSize, height: Math.min(artworkSize, 220) }]}>
            <LinearGradient
              colors={['#1c1c28', '#12121c', '#0a0a0f']}
              style={styles.emptyArtworkGradient}
            >
              <View style={styles.emptyArtworkPulseGlow} />
              <View style={styles.emptyArtworkIconWrap}>
                <Music size={36} color={colors.amber} />
              </View>
              <Text style={styles.emptyArtworkTitle}>Waiting for Music</Text>
              <Text style={styles.emptyArtworkSubtitle}>OPENJAM COLLABORATIVE SESSION</Text>
              <View style={styles.emptyArtworkPill}>
                <View style={styles.emptyArtworkLiveDot} />
                <Text style={styles.emptyArtworkPillText}>Ready to Jam</Text>
              </View>
            </LinearGradient>
          </View>
        ) : (
          /* Prominent Modern Artwork Hero Card */
          <View style={[styles.artworkContainer, { width: artworkSize, height: artworkSize }]}>
            <View style={styles.artworkAura} pointerEvents="none" />
            <View style={[styles.artworkCard, { width: artworkSize, height: artworkSize }]}>
              {art ? (
                <Image
                  source={{ uri: art }}
                  style={styles.art}
                  contentFit="cover"
                  transition={300}
                />
              ) : (
                <LinearGradient
                  colors={['#242436', '#141420', '#0a0a10']}
                  style={[styles.art, styles.artFallback]}
                >
                  <View style={styles.artFallbackIconWrap}>
                    <Music size={38} color={colors.amber} />
                  </View>
                  <Text style={styles.artFallbackTitle} numberOfLines={1}>
                    {nowPlaying?.track_name || 'Live Track'}
                  </Text>
                  <Text style={styles.artFallbackSub}>OPENJAM SESSION</Text>
                </LinearGradient>
              )}
            </View>
          </View>
        )}

        {nowPlaying ? (
          <>
            {/* Spotify-style Track Info Row with Save Vault & Lyrics quick action pills */}
            <View style={styles.trackInfoRow}>
              <View style={styles.trackMetaCol}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {nowPlaying.track_name}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {nowPlaying.artist || 'Unknown Artist'}
                </Text>
              </View>

              <View style={styles.trackActionsRow}>
                <Pressable
                  onPress={handleSaveSessionToVault}
                  disabled={isSavingVault}
                  style={({ pressed }) => [
                    styles.actionPill,
                    isVaultSaved && styles.actionPillSaved,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Save session to offline vault"
                >
                  {isSavingVault ? (
                    <ActivityIndicator size="small" color={colors.amber} />
                  ) : isVaultSaved ? (
                    <>
                      <CheckCircle2 size={13} color="#10b981" />
                      <Text style={[styles.actionPillText, { color: '#10b981' }]}>Saved</Text>
                    </>
                  ) : (
                    <>
                      <DownloadCloud size={13} color={colors.amber} />
                      <Text style={styles.actionPillText}>Save</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setLyricsOpen((v) => !v)}
                  style={({ pressed }) => [
                    styles.actionPill,
                    lyricsOpen && styles.actionPillActive,
                    pressed && styles.pressed,
                  ]}
                  hitSlop={8}
                  accessibilityLabel="Toggle Lyrics"
                >
                  <MessageSquareQuote
                    size={13}
                    color={lyricsOpen ? colors.amber : colors.text2}
                  />
                  <Text style={[styles.actionPillText, lyricsOpen && styles.actionPillTextActive]}>
                    Lyrics
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Audio Equalizer & Stream Status Bar */}
            <View style={styles.equalizerStatusBar}>
              <View style={styles.liveBadge}>
                <View
                  style={[
                    styles.liveIndicatorDot,
                    { backgroundColor: isPlaying ? '#10b981' : colors.text3 },
                  ]}
                />
                <Text style={styles.liveIndicatorText}>
                  {isPlaying ? 'STREAMING' : 'PAUSED'}
                </Text>
              </View>

              {/* Dynamic Equalizer Waveform Bars */}
              <View style={styles.equalizerRow}>
                <Animated.View style={[styles.eqBar, eq1Style]} />
                <Animated.View style={[styles.eqBar, eq2Style]} />
                <Animated.View style={[styles.eqBar, eq3Style]} />
                <Animated.View style={[styles.eqBar, eq4Style]} />
              </View>
            </View>

            {/* Full-Width Scrubber Deck with Monospace Timecodes & Smooth PanResponder */}
            <View
              ref={scrubberViewRef}
              onLayout={(e) => {
                setBarWidth(e.nativeEvent.layout.width);
                measureScrubber();
              }}
              {...panResponder.panHandlers}
              style={styles.progressHit}
              accessibilityLabel="Track Scrubber"
            >
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${ratio * 100}%` }]}>
                  <View
                    style={[
                      styles.progressKnob,
                      isScrubbing && styles.progressKnobActive,
                    ]}
                  />
                </View>
              </View>
            </View>

            <View style={styles.times}>
              <Text style={[styles.time, isScrubbing && styles.timeScrubbing]}>
                {fmt(displayPos)}
              </Text>
              <Text style={styles.time}>{fmt(duration)}</Text>
            </View>

            {/* Spotify-Inspired Tactile Transport Controls Deck */}
            <View style={styles.controls}>
              {/* Shuffle button */}
              <Pressable
                onPress={() => {
                  shuffleQueue();
                  void hapticLight();
                }}
                disabled={!isHost}
                style={({ pressed }) => [
                  styles.sideBtn,
                  !isHost && styles.disabled,
                  pressed && styles.pressed,
                ]}
                hitSlop={10}
                accessibilityLabel="Shuffle queue"
              >
                <Shuffle size={20} color={colors.text3} />
              </Pressable>

              {/* Previous button */}
              <Pressable
                onPress={() => {
                  previousTrack();
                  void hapticMedium();
                }}
                disabled={!canControl}
                style={({ pressed }) => [
                  styles.ctlBtn,
                  !canControl && styles.disabled,
                  pressed && styles.pressed,
                ]}
                hitSlop={12}
                accessibilityLabel="Previous track"
              >
                <SkipBack size={26} color={colors.text1} fill={colors.text1} />
              </Pressable>

              {/* Center Play / Pause 72px Button with Warm Amber Halo */}
              <Pressable
                onPress={() => {
                  togglePlay();
                  void hapticMedium();
                }}
                disabled={!canControl}
                style={({ pressed }) => [
                  styles.playBtnWrap,
                  !canControl && styles.disabled,
                  pressed && styles.pressed,
                ]}
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                <LinearGradient
                  colors={['#ffb03a', '#ff9f1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.playBtn}
                >
                  {isPlaying ? (
                    <Pause size={28} color="#08080a" fill="#08080a" />
                  ) : (
                    <Play size={28} color="#08080a" fill="#08080a" style={{ marginLeft: 3 }} />
                  )}
                </LinearGradient>
              </Pressable>

              {/* Next button */}
              <Pressable
                onPress={() => {
                  nextTrack();
                  void hapticMedium();
                }}
                disabled={!canControl}
                style={({ pressed }) => [
                  styles.ctlBtn,
                  !canControl && styles.disabled,
                  pressed && styles.pressed,
                ]}
                hitSlop={12}
                accessibilityLabel="Next track"
              >
                <SkipForward size={26} color={colors.text1} fill={colors.text1} />
              </Pressable>

              {/* Repeat button */}
              <Pressable
                onPress={() => {
                  toggleRepeat();
                  void hapticLight();
                }}
                disabled={!canControl}
                style={({ pressed }) => [
                  styles.sideBtn,
                  !canControl && styles.disabled,
                  pressed && styles.pressed,
                ]}
                hitSlop={10}
                accessibilityLabel="Toggle repeat"
              >
                <Repeat size={20} color={loop ? colors.amber : colors.text3} />
                {loop ? <View style={styles.loopDot} /> : null}
              </Pressable>
            </View>

            {/* Minimal In-Sync & Skip Status Strip */}
            <View style={styles.syncStrip}>
              <View style={styles.syncStatusLeft}>
                <View
                  style={[
                    styles.syncIndicatorDot,
                    { backgroundColor: syncReady ? colors.green : colors.amber },
                  ]}
                />
                <Text style={styles.syncStatusText} numberOfLines={1}>
                  {syncReady ? `In sync with ${roomName || 'Room'}` : 'Syncing live stream…'}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.voteSkipPill, pressed && styles.pressed]}
                onPress={() => {
                  voteSkip();
                  void hapticHeavy();
                }}
                hitSlop={8}
                accessibilityLabel="Vote to skip track"
              >
                <View style={styles.voteSkipContent}>
                  <SkipForward size={12} color={colors.amber} fill={colors.amber} />
                  <Text style={styles.voteSkipText}>
                    Skip {skipVotes.votes}/{skipVotes.required || '–'}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Compact Quick Reactions Bar */}
            <View style={styles.reactionsBar}>
              {REACTION_OPTIONS.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    sendReaction(r.id);
                    void hapticLight();
                  }}
                  style={({ pressed }) => [styles.reactionPill, pressed && styles.pressed]}
                  accessibilityLabel={`React with ${r.label}`}
                >
                  {r.icon}
                  <Text style={styles.reactionPillText}>{r.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Synced Karaoke Lyrics Panel */}
            {lyricsOpen ? (
              <View style={styles.lyricsCard}>
                <View style={styles.lyricsHeader}>
                  <View style={styles.lyricsHeaderTitleRow}>
                    <Text style={styles.lyricsHeaderTitle}>Lyrics</Text>
                    {lyrics.synced ? (
                      <View style={styles.syncedBadge}>
                        <Text style={styles.syncedBadgeText}>SYNCED</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => setLyricsOpen(false)} hitSlop={8}>
                    <Text style={styles.lyricsCloseText}>Close</Text>
                  </Pressable>
                </View>

                {lyricsLoading ? (
                  <View style={styles.lyricsEmptyState}>
                    <Text style={styles.lyricsHint}>Finding lyrics…</Text>
                  </View>
                ) : lyrics.lines.length === 0 ? (
                  <View style={styles.lyricsEmptyState}>
                    <Text style={styles.lyricsHint}>No lyrics available for this track</Text>
                  </View>
                ) : (
                  <ScrollView
                    ref={lyricsScrollRef}
                    nestedScrollEnabled={true}
                    style={styles.lyricsScrollList}
                    contentContainerStyle={styles.lyricsContentContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    {lyrics.lines.map((item, index) => {
                      const isActive = lyrics.synced && index === activeIdx;
                      const isPast = lyrics.synced && index < activeIdx;
                      return (
                        <Pressable
                          key={`lyric-${index}`}
                          onPress={() => {
                            if (canControl && lyrics.synced && item.timeMs >= 0) {
                              seekToMs(item.timeMs);
                            }
                          }}
                          style={[
                            styles.lyricLineContainer,
                            isActive && styles.lyricLineActiveContainer,
                          ]}
                        >
                          <Text
                            style={[
                              styles.lyricLine,
                              isActive && styles.lyricActive,
                              isPast && styles.lyricPast,
                            ]}
                          >
                            {item.text}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : null}

            {!canControl ? (
              <Text style={styles.guestNotice}>
                Host controls playback · Your audio stays strictly in sync
              </Text>
            ) : null}
          </>
        ) : (
          /* Empty Room State — Spotify Jam Collaborative Deck */
          <View style={styles.emptyContainer}>
            {/* Collaborative Session Status Pill */}
            <View style={styles.emptySessionPill}>
              <View style={styles.emptyLiveDot} />
              <Text style={styles.emptySessionText}>
                {isHost ? 'You are the Room Host' : 'Collaborative Jam'} · Anyone can add music
              </Text>
            </View>

            <Text style={styles.emptyTitle}>The queue is empty</Text>
            <Text style={styles.emptySubtitle}>
              Search any track, paste a link, or pick a starter vibe below to kick off the session!
            </Text>

            {/* Spotify-style Direct Quick Search Bar */}
            <Pressable
              onPress={goQueue}
              style={({ pressed }) => [styles.emptySearchCard, pressed && styles.pressed]}
              accessibilityLabel="Search tracks to add"
            >
              <View style={styles.emptySearchIconWrap}>
                <Search size={16} color={colors.amber} />
              </View>
              <Text style={styles.emptySearchPlaceholder}>
                Search songs, artists, or paste links…
              </Text>
              <View style={styles.emptySearchAddBtn}>
                <Plus size={14} color="#08080a" strokeWidth={3} />
              </View>
            </Pressable>

            {/* Big Prominent Add Track Button */}
            <Pressable
              onPress={goQueue}
              style={({ pressed }) => [styles.addTrackButton, pressed && styles.pressed]}
              accessibilityLabel="Add songs to queue"
            >
              <LinearGradient
                colors={['#ffb03a', '#ff9f1c']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addTrackGradient}
                pointerEvents="none"
              >
                <Plus size={18} color="#08080a" strokeWidth={2.6} />
                <Text style={styles.addTrackButtonText}>Add Songs to Queue</Text>
              </LinearGradient>
            </Pressable>

            {/* Quick-Start Instant Starter Vibes */}
            <View style={styles.starterSection}>
              <View style={styles.starterHeader}>
                <Sparkles size={14} color={colors.amber} />
                <Text style={styles.starterSectionTitle}>Instant Starter Vibes</Text>
                <Text style={styles.starterSectionSubtitle}>1-tap queue</Text>
              </View>
              <View style={styles.starterGrid}>
                {STARTER_VIBES.map((v) => (
                  <View key={v.id} style={styles.starterCard}>
                    <Pressable
                      style={styles.starterCardMain}
                      onPress={() => {
                        if (canControl) {
                          playNow(v);
                          toast(`Playing "${v.track_name}"`);
                        } else {
                          addTrack(v);
                          toast(`Added "${v.track_name}" to queue`);
                        }
                        void hapticMedium();
                      }}
                    >
                      <Image source={{ uri: v.album_art_url }} style={styles.starterArt} contentFit="cover" />
                      <View style={styles.starterMeta}>
                        <Text style={styles.starterTitle} numberOfLines={1}>{v.track_name}</Text>
                        <Text style={styles.starterArtist} numberOfLines={1}>
                          {v.artist} · {fmt(v.duration_ms)}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.starterActionsRow}>
                      {canControl ? (
                        <Pressable
                          onPress={() => {
                            playNow(v);
                            toast(`Playing "${v.track_name}"`);
                            void hapticMedium();
                          }}
                          style={({ pressed }) => [styles.starterMiniPlayBtn, pressed && styles.pressed]}
                          hitSlop={6}
                          accessibilityLabel={`Play ${v.track_name} now`}
                        >
                          <Play size={11} color={colors.amber} fill={colors.amber} style={{ marginLeft: 1 }} />
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => {
                          addTrack(v);
                          toast(`Added "${v.track_name}" to queue`);
                          void hapticLight();
                        }}
                        style={({ pressed }) => [styles.starterAddPill, pressed && styles.pressed]}
                        hitSlop={6}
                        accessibilityLabel={`Add ${v.track_name} to queue`}
                      >
                        <Plus size={13} color="#08080a" strokeWidth={2.8} />
                        <Text style={styles.starterAddPillText}>Add</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08080a',
  },
  ambientBloom: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 440,
    zIndex: 0,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xl * 2,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  // Modern Hero Artwork Card Styles
  artworkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  artworkAura: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: 'rgba(255, 159, 28, 0.16)',
    transform: [{ scale: 1.04 }],
    opacity: 0.6,
  },
  artworkCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#12121a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 10,
  },
  art: {
    width: '100%',
    height: '100%',
  },
  artFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  artFallbackIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  artFallbackTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 16,
    color: colors.text1,
    textAlign: 'center',
    maxWidth: 240,
  },
  artFallbackSub: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  // Modern Empty State Card
  emptyArtworkCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  emptyArtworkGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    position: 'relative',
  },
  emptyArtworkPulseGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
  },
  emptyArtworkIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 159, 28, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 159, 28, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyArtworkTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: '#ffffff',
    textAlign: 'center',
  },
  emptyArtworkSubtitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    color: colors.amber,
    letterSpacing: 1.4,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  emptyArtworkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginTop: 2,
  },
  emptyArtworkLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  emptyArtworkPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: colors.text2,
  },
  // Spotify Track Info Row
  trackInfoRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  trackMetaCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  trackName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 24,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  artist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 16,
    color: colors.text2,
    marginTop: 3,
  },
  trackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 5,
  },
  actionPillActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.18)',
    borderColor: colors.amber,
  },
  actionPillSaved: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  actionPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text2,
  },
  actionPillTextActive: {
    color: colors.amber,
  },
  // Equalizer Status Row
  equalizerStatusBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveIndicatorText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10,
    color: colors.text3,
    letterSpacing: 1,
  },
  equalizerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
    gap: 3.5,
  },
  eqBar: {
    width: 3.5,
    backgroundColor: colors.amber,
    borderRadius: 2,
  },
  // Full-width Scrubber Deck
  progressHit: {
    width: '100%',
    paddingVertical: 12,
  },
  progressBg: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amber,
    borderRadius: 2.5,
    position: 'relative',
    justifyContent: 'center',
  },
  progressKnob: {
    position: 'absolute',
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  progressKnobActive: {
    transform: [{ scale: 1.5 }],
    backgroundColor: '#ffffff',
    shadowColor: colors.amber,
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 8,
  },
  times: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: spacing.md,
  },
  time: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: colors.text3,
    fontVariant: ['tabular-nums'],
  },
  timeScrubbing: {
    color: colors.amber,
    fontFamily: fontFamily.displayBold,
  },
  // Spotify Transport Controls Deck
  controls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
    marginVertical: spacing.sm,
  },
  sideBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sideGlyph: {
    fontSize: 22,
    color: colors.text3,
  },
  activeGlyph: {
    color: colors.amber,
  },
  loopDot: {
    position: 'absolute',
    bottom: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  ctlBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctlGlyph: {
    fontSize: 28,
    color: colors.text1,
  },
  playBtnWrap: {
    borderRadius: 36,
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 10,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    fontSize: 28,
    color: '#08080a',
    marginLeft: 2,
  },
  // Minimal In-Sync Status Strip
  syncStrip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: spacing.xs,
  },
  syncStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  syncIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  syncStatusText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text2,
    flexShrink: 1,
  },
  voteSkipPill: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  voteSkipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  voteSkipText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.amber,
  },
  // Compact Quick Reactions Strip
  reactionsBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: 6,
  },
  reactionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    borderRadius: 12,
  },
  reactionPillText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10.5,
    color: colors.text2,
  },
  // Synced Karaoke Lyrics Card
  lyricsCard: {
    width: '100%',
    maxHeight: 280,
    backgroundColor: 'rgba(16, 16, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    borderRadius: 20,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.xs,
  },
  lyricsHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lyricsHeaderTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: colors.text1,
  },
  syncedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncedBadgeText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 9,
    color: colors.green,
    letterSpacing: 0.5,
  },
  lyricsCloseText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.text3,
  },
  lyricsScrollList: {
    maxHeight: 220,
  },
  lyricsContentContainer: {
    paddingVertical: spacing.sm,
  },
  lyricLineContainer: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  lyricLineActiveContainer: {
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
  },
  lyricLine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    lineHeight: 22,
  },
  lyricActive: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.amber,
    lineHeight: 26,
    textShadowColor: 'rgba(255, 159, 28, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  lyricPast: {
    opacity: 0.28,
  },
  lyricsEmptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  lyricsHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
  },
  guestNotice: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text3,
    marginTop: spacing.md,
    textAlign: 'center',
    opacity: 0.75,
  },
  // Empty State Styles — Spotify Jam Deck
  emptyContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  emptySessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: spacing.xs,
  },
  emptyLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  emptySessionText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text2,
    letterSpacing: 0.2,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    color: colors.text1,
    marginTop: spacing.xs,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    maxWidth: 300,
  },
  emptySearchCard: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111116',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.24)',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginTop: spacing.md,
    gap: 10,
  },
  emptySearchIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchPlaceholder: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: colors.text3,
  },
  emptySearchAddBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTrackButton: {
    marginTop: spacing.sm,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  addTrackGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    gap: 8,
  },
  addTrackGlyph: {
    fontSize: 16,
    color: '#08080a',
    fontWeight: 'bold',
  },
  addTrackButtonText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14.5,
    color: '#08080a',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  containerCentered: {
    paddingVertical: 0,
  },
  starterSection: {
    width: '100%',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  starterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    width: '100%',
  },
  starterSectionTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: colors.amber,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  starterSectionSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginLeft: 'auto',
  },
  starterGrid: {
    gap: 8,
    width: '100%',
  },
  starterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111117',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 14,
    padding: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  starterCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 6,
  },
  starterArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1a1a24',
  },
  starterMeta: {
    flex: 1,
  },
  starterTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: colors.text1,
  },
  starterArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 2,
  },
  starterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  starterMiniPlayBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  starterAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: radius.full,
  },
  starterAddPillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#08080a',
    fontWeight: 'bold',
  },
});
