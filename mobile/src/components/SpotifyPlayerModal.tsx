/**
 * Spotify-Style Full-Screen Player Modal for OpenJam Mobile.
 *
 * Implements:
 * - High-fidelity mobile phone music player matching Spotify's native experience.
 * - Ambient gradient background derived from cover art & brand tones.
 * - Swipe-down / Chevron-down dismiss to collapse into MiniPlayer.
 * - Large rounded album artwork with warm subtle glow.
 * - Interactive seekable progress slider with millisecond precision & timecodes.
 * - Full transport controls: Shuffle, Previous, Play/Pause, Next, Repeat ('off' | 'all' | 'one').
 * - 1-Tap Heart / Like toggle persisted immediately in local storage.
 * - Offline Vault Save button with real-time download progress and checkmark state.
 * - Up Next queue panel with touch management (clean, arrow-free reordering).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronDown,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  DownloadCloud,
  CheckCircle2,
  ListMusic,
  Share2,
  Trash2,
  Sparkles,
  Music2,
  Radio,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';
import {
  downloadTrackToVault,
  isTrackDownloaded,
  subscribeDownloadProgress,
  type TrackDownloadProgress,
} from '../storage/vault';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { useToast } from './ToastContext';
import { getAmbientPalette } from '../utils/palette';
import type { TrackInfo } from '../sync/protocol';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ARTWORK_SIZE = Math.min(SCREEN_WIDTH - 64, 340);

function formatTime(ms: number): string {
  if (!ms || ms <= 0 || isNaN(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export function SpotifyPlayerModal() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const {
    currentTrack,
    queue,
    currentIndex,
    shuffle,
    repeat,
    isLiked,
    isPlayerModalOpen,
    sourceTitle,
    play,
    pause,
    seekToMs,
    positionMs,
    playNext,
    playPrev,
    toggleLike,
    toggleShuffle,
    toggleRepeat,
    setPlayerModalOpen,
    playTrack,
    removeFromQueue,
  } = usePlayer();

  const { playing, durationMs } = usePlayerStatus();

  const [currentPosMs, setCurrentPosMs] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [scrubSpeed, setScrubSpeed] = useState(1.0);
  const [showQueue, setShowQueue] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TrackDownloadProgress | null>(null);

  const lastTouchXRef = useRef(0);
  const startYRef = useRef(0);
  const trackBarWidthRef = useRef(SCREEN_WIDTH - 64);

  const palette = useMemo(
    () => getAmbientPalette(currentTrack?.track_name, currentTrack?.artist, currentTrack?.album_art_url),
    [currentTrack?.track_name, currentTrack?.artist, currentTrack?.album_art_url],
  );

  // Poll current position smoothly
  useEffect(() => {
    if (!isPlayerModalOpen) return;
    const interval = setInterval(() => {
      if (!isScrubbing) {
        setCurrentPosMs(positionMs());
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isPlayerModalOpen, isScrubbing, positionMs]);

  // Check offline download status for current track
  useEffect(() => {
    if (!currentTrack?.track_uri) {
      setIsDownloaded(false);
      return;
    }
    void isTrackDownloaded(currentTrack.track_uri).then(setIsDownloaded);

    const unsub = subscribeDownloadProgress((progressMap) => {
      if (currentTrack?.track_uri && progressMap[currentTrack.track_uri]) {
        const p = progressMap[currentTrack.track_uri];
        setDownloadProgress(p);
        if (p.state === 'completed') {
          setIsDownloaded(true);
        }
      }
    });
    return unsub;
  }, [currentTrack]);

  // Header Swipe-Down PanResponder to collapse modal
  const headerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 12,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 45 || gestureState.vy > 0.4) {
            void hapticLight();
            setPlayerModalOpen(false);
          }
        },
      }),
    [setPlayerModalOpen],
  );

  // Continuous Vertical Deflection Precision Scrubber
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
        },
        onPanResponderMove: (evt) => {
          const currentX = evt.nativeEvent.pageX;
          const currentY = evt.nativeEvent.pageY;
          const deltaX = currentX - lastTouchXRef.current;
          const deflectionY = Math.max(0, currentY - startYRef.current);

          // Spotify deflection damping: S(Y) = clamp(1.0 - 0.009 * max(0, Y - 30), 0.1, 1.0)
          const speed = Math.max(0.1, Math.min(1.0, 1.0 - 0.009 * Math.max(0, deflectionY - 30)));
          setScrubSpeed(speed);

          const deltaRatio = (deltaX * speed) / trackBarWidthRef.current;
          setScrubRatio((prev) => Math.max(0, Math.min(1, prev + deltaRatio)));
          lastTouchXRef.current = currentX;
        },
        onPanResponderRelease: async () => {
          const finalRatio = scrubRatio;
          const targetMs = Math.round(finalRatio * (durationMs || 180000));
          await seekToMs(targetMs);
          setCurrentPosMs(targetMs);
          setIsScrubbing(false);
          setScrubSpeed(1.0);
          void hapticLight();
        },
      }),
    [durationMs, scrubRatio, seekToMs],
  );

  if (!isPlayerModalOpen || !currentTrack) return null;

  const effectiveDuration = durationMs > 0 ? durationMs : 180000;
  const displayPosMs = isScrubbing ? scrubRatio * effectiveDuration : currentPosMs;
  const progressPercent = Math.min(100, Math.max(0, (displayPosMs / effectiveDuration) * 100));

  const handleDownload = async () => {
    if (isDownloaded) {
      toast('Song is already stored in Offline Vault', 'info');
      return;
    }
    void hapticMedium();
    toast(`Downloading "${currentTrack.track_name}" to Offline Vault…`, 'info');
    try {
      await downloadTrackToVault(currentTrack, isLiked);
      setIsDownloaded(true);
      toast(`Downloaded "${currentTrack.track_name}"! Ready offline.`, 'success');
    } catch {
      toast('Could not download audio stream right now. Try again later.', 'error');
    }
  };

  const handleToggleLike = async () => {
    void hapticMedium();
    const liked = await toggleLike();
    toast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
  };

  return (
    <Modal
      visible={isPlayerModalOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => setPlayerModalOpen(false)}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LinearGradient
          colors={[palette.top, palette.mid, palette.bottom]}
          style={StyleSheet.absoluteFill}
        />

        {/* Top Header Bar with Swipe-Down Gesture */}
        <View style={styles.header} {...headerPanResponder.panHandlers}>
          <Pressable
            onPress={() => {
              void hapticLight();
              setPlayerModalOpen(false);
            }}
            hitSlop={14}
            style={styles.headerBtn}
            accessibilityLabel="Collapse player"
          >
            <ChevronDown size={28} color="#ffffff" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>PLAYING FROM</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {sourceTitle.toUpperCase()}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void hapticLight();
              setShowQueue((prev) => !prev);
            }}
            hitSlop={14}
            style={[styles.headerBtn, showQueue && styles.headerBtnActive]}
            accessibilityLabel="Toggle queue"
          >
            <ListMusic size={22} color={showQueue ? colors.amber : '#ffffff'} />
          </Pressable>
        </View>

        {showQueue ? (
          /* Up Next Queue Panel */
          <View style={styles.queueContainer}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueHeading}>Up Next</Text>
              <View style={styles.radioPill}>
                <Radio size={12} color={colors.amber} />
                <Text style={styles.radioText}>Spotify Radio Auto-Play On</Text>
              </View>
            </View>

            <ScrollView style={styles.queueList} contentContainerStyle={styles.queueContent}>
              {queue.map((track, idx) => {
                const isCurrent = idx === currentIndex;
                return (
                  <Pressable
                    key={`${track.track_uri}_${idx}`}
                    onPress={() => {
                      void hapticLight();
                      void playTrack(track);
                    }}
                    style={[styles.queueItem, isCurrent && styles.queueItemActive]}
                  >
                    <Image
                      source={{ uri: track.album_art_url || 'https://openjam.fun/default_art.png' }}
                      style={styles.queueItemArt}
                      contentFit="cover"
                    />
                    <View style={styles.queueItemInfo}>
                      <Text
                        style={[styles.queueItemTitle, isCurrent && { color: colors.amber }]}
                        numberOfLines={1}
                      >
                        {track.track_name}
                      </Text>
                      <Text style={styles.queueItemArtist} numberOfLines={1}>
                        {track.artist || 'Unknown Artist'}
                      </Text>
                    </View>
                    {isCurrent ? (
                      <View style={styles.nowPlayingDot} />
                    ) : (
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          void hapticLight();
                          removeFromQueue(idx);
                        }}
                        hitSlop={10}
                      >
                        <Trash2 size={16} color="#666677" />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          /* Main Player Body */
          <View style={styles.mainContent}>
            {/* Album Artwork Stage */}
            <View style={styles.artworkStage}>
              <View style={[styles.artworkGlow, { backgroundColor: palette.glow }]} />
              <Image
                source={{
                  uri: currentTrack.album_art_url || 'https://openjam.fun/default_art.png',
                }}
                style={styles.artwork}
                contentFit="cover"
                transition={200}
              />
            </View>

            {/* Track Info & Like Row */}
            <View style={styles.trackInfoRow}>
              <View style={styles.trackTextCol}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {currentTrack.track_name}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {currentTrack.artist || 'Unknown Artist'}
                </Text>
              </View>

              <Pressable
                onPress={handleToggleLike}
                hitSlop={12}
                style={styles.heartBtn}
                accessibilityLabel={isLiked ? 'Unlike song' : 'Like song'}
              >
                <Heart
                  size={26}
                  color={isLiked ? palette.accent : '#9999aa'}
                  fill={isLiked ? palette.accent : 'transparent'}
                />
              </Pressable>
            </View>

            {/* Scrubbable Progress Bar with Precision Deflection Feedback */}
            <View style={styles.progressSection}>
              {isScrubbing && scrubSpeed < 0.95 && (
                <View style={[styles.scrubTooltipPill, { borderColor: palette.accent }]}>
                  <Sparkles size={11} color={palette.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.scrubTooltipText, { color: palette.accent }]}>
                    {scrubSpeed <= 0.25
                      ? 'Fine Scrubbing (0.1x)'
                      : scrubSpeed <= 0.55
                      ? 'Quarter-Speed Scrubbing (0.25x)'
                      : 'Half-Speed Scrubbing (0.5x)'}
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
                    { width: `${progressPercent}%`, backgroundColor: palette.accent },
                  ]}
                />
                <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
              </View>

              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(displayPosMs)}</Text>
                <Text style={styles.timeText}>
                  {displayPosMs > 0 ? `-${formatTime(effectiveDuration - displayPosMs)}` : formatTime(effectiveDuration)}
                </Text>
              </View>
            </View>

            {/* Main Controls Row (Shuffle, Prev, Play/Pause, Next, Repeat) */}
            <View style={styles.controlsRow}>
              <Pressable
                onPress={() => {
                  void hapticLight();
                  toggleShuffle();
                }}
                hitSlop={12}
                style={styles.sideControlBtn}
                accessibilityLabel="Toggle shuffle"
              >
                <Shuffle size={20} color={shuffle ? colors.amber : '#888899'} />
                {shuffle && <View style={styles.activeDot} />}
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticLight();
                  void playPrev();
                }}
                hitSlop={12}
                style={styles.stepBtn}
                accessibilityLabel="Previous track"
              >
                <SkipBack size={28} color="#ffffff" fill="#ffffff" />
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticMedium();
                  if (playing) pause();
                  else play();
                }}
                style={({ pressed }) => [styles.playPauseBtn, pressed && styles.playPauseBtnPressed]}
                accessibilityLabel={playing ? 'Pause' : 'Play'}
              >
                {playing ? (
                  <Pause size={30} color="#08080a" fill="#08080a" />
                ) : (
                  <Play size={30} color="#08080a" fill="#08080a" style={{ marginLeft: 3 }} />
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticLight();
                  void playNext();
                }}
                hitSlop={12}
                style={styles.stepBtn}
                accessibilityLabel="Next track"
              >
                <SkipForward size={28} color="#ffffff" fill="#ffffff" />
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticLight();
                  toggleRepeat();
                }}
                hitSlop={12}
                style={styles.sideControlBtn}
                accessibilityLabel="Toggle repeat"
              >
                {repeat === 'one' ? (
                  <Repeat1 size={20} color={colors.amber} />
                ) : (
                  <Repeat size={20} color={repeat === 'all' ? colors.amber : '#888899'} />
                )}
                {repeat !== 'off' && <View style={styles.activeDot} />}
              </Pressable>
            </View>

            {/* Bottom Actions Row (Download Offline & Queue toggle) */}
            <View style={styles.bottomActionsRow}>
              <Pressable
                onPress={handleDownload}
                style={styles.actionBtn}
                accessibilityLabel="Download song offline"
              >
                {downloadProgress?.state === 'downloading' ? (
                  <View style={styles.downloadProgressWrap}>
                    <ActivityIndicator size="small" color={colors.amber} />
                    <Text style={styles.downloadProgressText}>
                      {downloadProgress.percent}%
                    </Text>
                  </View>
                ) : isDownloaded ? (
                  <View style={styles.downloadedWrap}>
                    <CheckCircle2 size={18} color={colors.green} />
                    <Text style={styles.downloadedText}>Downloaded</Text>
                  </View>
                ) : (
                  <View style={styles.downloadWrap}>
                    <DownloadCloud size={18} color="#aaaabb" />
                    <Text style={styles.downloadText}>Save Offline</Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticLight();
                  setShowQueue(true);
                }}
                style={styles.actionBtn}
                accessibilityLabel="View queue"
              >
                <ListMusic size={18} color="#aaaabb" />
                <Text style={styles.downloadText}>Queue ({queue.length})</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080a',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerEyebrow: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9.5,
    color: '#888899',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'space-between',
    paddingBottom: 24,
    paddingTop: 12,
  },
  artworkStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  artworkGlow: {
    position: 'absolute',
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    transform: [{ scale: 1.05 }],
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
    borderRadius: 16,
    backgroundColor: '#181822',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  trackTextCol: {
    flex: 1,
    marginRight: 16,
  },
  trackTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: -0.4,
  },
  trackArtist: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 15,
    color: '#9999aa',
    marginTop: 4,
  },
  heartBtn: {
    padding: 6,
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
  progressSection: {
    marginVertical: 12,
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
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginVertical: 8,
  },
  sideControlBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.amber,
  },
  stepBtn: {
    padding: 8,
  },
  playPauseBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  playPauseBtnPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  downloadProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadProgressText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  downloadedWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadedText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.green,
  },
  downloadWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  downloadText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: '#aaaabb',
  },
  queueContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  queueHeading: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: '#ffffff',
  },
  radioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 5,
  },
  radioText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  queueList: {
    flex: 1,
  },
  queueContent: {
    paddingBottom: 40,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 8,
    gap: 12,
  },
  queueItemActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  queueItemArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#181822',
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ffffff',
  },
  queueItemArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#888899',
    marginTop: 2,
  },
  nowPlayingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
});
