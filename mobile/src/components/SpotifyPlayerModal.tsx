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
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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
  Headphones,
  Smartphone,
  Volume2,
  Plus,
  Check,
  MessageSquareQuote,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { usePlayer, usePlayerStatus } from '../audio/PlayerContext';
import { useOptionalRoom } from '../state/RoomContext';
import { fetchLyrics, type Lyrics, activeLyricIndex } from '../audio/lyrics';
import {
  downloadTrackToVault,
  isTrackDownloaded,
  subscribeDownloadProgress,
  type TrackDownloadProgress,
} from '../storage/vault';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { useToast } from './ToastContext';
import { getAmbientPalette } from '../utils/palette';
import { getBackendUrl, createRoom, getStoredSession } from '../api';
import { DevicePickerModal } from './DevicePickerModal';
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
    addToQueue,
    removeFromQueue,
    activeAudioDevice,
    setAudioDevice,
    radioAutoPlay,
    toggleRadioAutoPlay,
  } = usePlayer();

  const { playing, durationMs } = usePlayerStatus();

  const [currentPosMs, setCurrentPosMs] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(0);
  const [scrubSpeed, setScrubSpeed] = useState(1.0);
  const [showQueue, setShowQueue] = useState(false);
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<TrackDownloadProgress | null>(null);

  // Recommendations state for Queue panel
  const [recommendations, setRecommendations] = useState<TrackInfo[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [addedRecUris, setAddedRecUris] = useState<Set<string>>(new Set());

  const lastTouchXRef = useRef(0);
  const startYRef = useRef(0);
  const trackBarWidthRef = useRef(SCREEN_WIDTH - 64);

  const optionalRoom = useOptionalRoom();

  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);

  const heartScale = useSharedValue(1);
  const animatedHeartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const palette = useMemo(
    () => getAmbientPalette(currentTrack?.track_name, currentTrack?.artist, currentTrack?.album_art_url),
    [currentTrack?.track_name, currentTrack?.artist, currentTrack?.album_art_url],
  );

  // Fetch real-time synced lyrics
  useEffect(() => {
    if (!currentTrack?.track_name) {
      setLyrics(null);
      return;
    }
    let cancelled = false;
    setLyricsLoading(true);
    fetchLyrics(
      currentTrack.artist || '',
      currentTrack.track_name,
      (durationMs || 180000) / 1000,
    )
      .then((l) => {
        if (!cancelled) {
          setLyrics(l);
          setLyricsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLyricsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.track_name, currentTrack?.artist, durationMs]);

  const activeLineIdx = useMemo(() => {
    if (!lyrics?.lines?.length) return -1;
    return activeLyricIndex(lyrics.lines, currentPosMs);
  }, [lyrics, currentPosMs]);

  // Fetch non-intrusive 3-5 recommendations based on current track when queue panel opens
  useEffect(() => {
    if (!showQueue || !currentTrack?.track_name) return;
    let cancelled = false;
    setLoadingRecommendations(true);
    const seed = `${currentTrack.track_name} ${currentTrack.artist || ''}`.trim();
    const backendUrl = getBackendUrl();
    fetch(`${backendUrl}/search/recommendations?seed=${encodeURIComponent(seed)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TrackInfo[]) => {
        if (!cancelled && Array.isArray(data)) {
          setRecommendations(data.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRecommendations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showQueue, currentTrack?.track_name, currentTrack?.artist]);

  const handleAddRecToQueue = (track: TrackInfo) => {
    if (addedRecUris.has(track.track_uri)) return;
    void hapticLight();
    setAddedRecUris((prev) => new Set(prev).add(track.track_uri));
    addToQueue(track);
    toast(`Added "${track.track_name}" to queue`, 'success');
  };

  // Center active lyric line in lyrics sheet
  useEffect(() => {
    if (showLyricsModal && activeLineIdx >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTo({
        y: Math.max(0, activeLineIdx * 48 - 140),
        animated: true,
      });
    }
  }, [activeLineIdx, showLyricsModal]);

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
    heartScale.value = withSequence(
      withTiming(1.35, { duration: 110 }),
      withSpring(1.0, { damping: 10, stiffness: 220 }),
    );
    void hapticMedium();
    const liked = await toggleLike();
    toast(liked ? 'Added to Liked Songs' : 'Removed from Liked Songs', 'info');
  };

  const handleStartLiveJam = async () => {
    if (!currentTrack) {
      toast('No song currently playing to start a Jam', 'info');
      return;
    }
    void hapticMedium();
    setShowDevicePicker(false);
    toast('Starting Live Jam…', 'info');
    try {
      const session = await getStoredSession();
      const hostName = session.user?.display_name || session.user?.discord_username || 'Jammer';
      const newRoom = await createRoom({
        name: `${hostName}'s Jam`,
        description: `Live Jam with ${currentTrack.track_name}`,
        genre_tags: ['live', 'jam'],
        allow_guest_controls: true,
      });

      const inviteUrl = `https://www.openjam.fun/room/${newRoom.id}`;
      try {
        await Share.share({
          message: `Join my Live Jam on OpenJam!\n${inviteUrl}`,
          title: `${hostName}'s Live Jam`,
        });
      } catch {}

      toast('Live Jam started! Invite link ready 🎶', 'success');
      setPlayerModalOpen(false);
      router.push({
        pathname: '/room/[id]/player',
        params: { id: newRoom.id, name: newRoom.name },
      });
    } catch {
      toast('Could not create Live Jam room', 'error');
    }
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
              <View>
                <Text style={styles.queueHeading}>Up Next</Text>
                <Text style={styles.queueSubheading}>
                  {queue.slice(currentIndex + 1).length > 0
                    ? `${queue.slice(currentIndex + 1).length} track${queue.slice(currentIndex + 1).length === 1 ? '' : 's'} queued`
                    : 'Queue is empty'}
                </Text>
              </View>
              <View style={styles.queueHeaderActions}>
                <Pressable
                  onPress={() => void handleStartLiveJam()}
                  style={styles.startJamPill}
                  accessibilityLabel="Start Live Jam with friends"
                >
                  <Radio size={12} color="#08080a" />
                  <Text style={styles.startJamText}>Live Jam</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void hapticLight();
                    toggleRadioAutoPlay();
                  }}
                  style={[styles.radioPill, !radioAutoPlay && styles.radioPillOff]}
                  accessibilityLabel="Toggle Spotify Radio Auto-Play"
                >
                  <Radio size={12} color={radioAutoPlay ? colors.amber : '#888899'} />
                  <Text style={[styles.radioText, !radioAutoPlay && styles.radioTextOff]}>
                    {radioAutoPlay ? 'Auto-Play' : 'Off'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.queueList} contentContainerStyle={styles.queueContent}>
              {/* Section: Now Playing */}
              {currentTrack && (
                <View style={styles.queueSection}>
                  <Text style={styles.queueSectionTitle}>NOW PLAYING</Text>
                  <View style={[styles.queueItem, styles.queueItemActive]}>
                    <Image
                      source={{ uri: currentTrack.album_art_url || 'https://openjam.fun/default_art.png' }}
                      style={styles.queueItemArt}
                      contentFit="cover"
                    />
                    <View style={styles.queueItemInfo}>
                      <Text style={[styles.queueItemTitle, { color: colors.amber }]} numberOfLines={1}>
                        {currentTrack.track_name}
                      </Text>
                      <Text style={styles.queueItemArtist} numberOfLines={1}>
                        {currentTrack.artist || 'Unknown Artist'}
                      </Text>
                    </View>
                    <View style={styles.queueEqualizerIndicator}>
                      <View style={[styles.queueEqBar, { height: 12 }]} />
                      <View style={[styles.queueEqBar, { height: 7 }]} />
                      <View style={[styles.queueEqBar, { height: 14 }]} />
                    </View>
                  </View>
                </View>
              )}

              {/* Section: Next In Queue (User-Queued only) */}
              <View style={styles.queueSection}>
                <Text style={styles.queueSectionTitle}>UP NEXT</Text>
                {queue.slice(currentIndex + 1).length === 0 ? (
                  <View style={styles.emptyQueueBox}>
                    <Sparkles size={20} color={colors.amber} style={{ marginBottom: 6 }} />
                    <Text style={styles.emptyQueueTitle}>No More Tracks Queued</Text>
                    <Text style={styles.emptyQueueSubtitle}>
                      {radioAutoPlay
                        ? 'OpenJam Radio will curate matching music when this track finishes.'
                        : 'Add tracks from recommendations below or enable Auto-Play.'}
                    </Text>
                  </View>
                ) : (
                  queue.slice(currentIndex + 1).map((track, relativeIdx) => {
                    const actualIdx = currentIndex + 1 + relativeIdx;
                    return (
                      <Pressable
                        key={`${track.track_uri}_${actualIdx}`}
                        onPress={() => {
                          void hapticLight();
                          void playTrack(track);
                        }}
                        style={styles.queueItem}
                      >
                        <Image
                          source={{ uri: track.album_art_url || 'https://openjam.fun/default_art.png' }}
                          style={styles.queueItemArt}
                          contentFit="cover"
                        />
                        <View style={styles.queueItemInfo}>
                          <Text style={styles.queueItemTitle} numberOfLines={1}>
                            {track.track_name}
                          </Text>
                          <Text style={styles.queueItemArtist} numberOfLines={1}>
                            {track.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            void hapticLight();
                            removeFromQueue(actualIdx);
                          }}
                          hitSlop={10}
                          style={styles.queueTrashBtn}
                          accessibilityLabel={`Remove ${track.track_name} from queue`}
                        >
                          <Trash2 size={16} color="#888899" />
                        </Pressable>
                      </Pressable>
                    );
                  })
                )}
              </View>

              {/* Section: Recommended For You (Curated, user-adds only) */}
              <View style={styles.queueSection}>
                <View style={styles.recSectionHeader}>
                  <Text style={styles.queueSectionTitle}>RECOMMENDED FOR YOU</Text>
                  <Text style={styles.recSectionSubtitle}>Tap + to add to queue</Text>
                </View>

                {loadingRecommendations && recommendations.length === 0 ? (
                  <View style={styles.recLoadingWrap}>
                    <ActivityIndicator size="small" color={colors.amber} />
                    <Text style={styles.recLoadingText}>Finding similar tracks…</Text>
                  </View>
                ) : recommendations.length === 0 ? (
                  <View style={styles.emptyQueueBox}>
                    <Music2 size={18} color="#888899" style={{ marginBottom: 4 }} />
                    <Text style={styles.emptyQueueSubtitle}>No extra recommendations found.</Text>
                  </View>
                ) : (
                  recommendations.map((recTrack) => {
                    const isAdded = addedRecUris.has(recTrack.track_uri);
                    return (
                      <View key={recTrack.track_uri} style={styles.queueItem}>
                        <Image
                          source={{ uri: recTrack.album_art_url || 'https://openjam.fun/default_art.png' }}
                          style={styles.queueItemArt}
                          contentFit="cover"
                        />
                        <View style={styles.queueItemInfo}>
                          <Text style={styles.queueItemTitle} numberOfLines={1}>
                            {recTrack.track_name}
                          </Text>
                          <Text style={styles.queueItemArtist} numberOfLines={1}>
                            {recTrack.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => handleAddRecToQueue(recTrack)}
                          disabled={isAdded}
                          hitSlop={8}
                          style={[styles.recAddBtn, isAdded && styles.recAddBtnDisabled]}
                          accessibilityLabel={isAdded ? 'Added to queue' : `Add ${recTrack.track_name} to queue`}
                        >
                          {isAdded ? (
                            <View style={styles.recAddedPill}>
                              <Check size={13} color={colors.green} />
                              <Text style={styles.recAddedText}>Added</Text>
                            </View>
                          ) : (
                            <View style={styles.recAddPill}>
                              <Plus size={14} color="#ffffff" />
                              <Text style={styles.recAddText}>Add</Text>
                            </View>
                          )}
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
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

            {/* Track Info & Action Buttons (Offline Vault + Heart) */}
            <View style={styles.trackInfoRow}>
              <View style={styles.trackTextCol}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {currentTrack.track_name}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {currentTrack.artist || 'Unknown Artist'}
                </Text>
              </View>

              <View style={styles.trackActionsRow}>
                <Pressable
                  onPress={handleDownload}
                  hitSlop={10}
                  style={styles.actionIconBtn}
                  accessibilityLabel="Save song to Offline Vault"
                >
                  {downloadProgress?.state === 'downloading' ? (
                    <ActivityIndicator size="small" color={colors.amber} />
                  ) : isDownloaded ? (
                    <CheckCircle2 size={24} color={colors.green} />
                  ) : (
                    <DownloadCloud size={24} color="#9999aa" />
                  )}
                </Pressable>

                <Pressable
                  onPress={handleToggleLike}
                  hitSlop={10}
                  style={styles.heartBtn}
                  accessibilityLabel={isLiked ? 'Unlike song' : 'Like song'}
                >
                  <Animated.View style={animatedHeartStyle}>
                    <Heart
                      size={26}
                      color={isLiked ? palette.accent : '#9999aa'}
                      fill={isLiked ? palette.accent : 'transparent'}
                    />
                  </Animated.View>
                </Pressable>
              </View>
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

            {/* Device Route Bar & Queue Button */}
            <View style={styles.deviceRouteBar}>
              <Pressable
                onPress={() => {
                  void hapticLight();
                  setShowDevicePicker(true);
                }}
                style={styles.deviceRoutePill}
                accessibilityLabel="Select audio output device"
              >
                {activeAudioDevice === 'room' && optionalRoom?.roomName ? (
                  <>
                    <Radio size={14} color="#22c55e" />
                    <Text style={styles.deviceRouteText} numberOfLines={1}>
                      Jam: {optionalRoom.roomName}
                    </Text>
                  </>
                ) : activeAudioDevice === 'bluetooth' ? (
                  <>
                    <Volume2 size={14} color={palette.accent} />
                    <Text style={[styles.deviceRouteText, { color: palette.accent }]} numberOfLines={1}>
                      Bluetooth Audio
                    </Text>
                  </>
                ) : activeAudioDevice === 'wired' ? (
                  <>
                    <Headphones size={14} color={palette.accent} />
                    <Text style={[styles.deviceRouteText, { color: palette.accent }]} numberOfLines={1}>
                      Wired Headphones
                    </Text>
                  </>
                ) : (
                  <>
                    <Smartphone size={14} color={palette.accent} />
                    <Text style={[styles.deviceRouteText, { color: palette.accent }]} numberOfLines={1}>
                      Phone Speaker
                    </Text>
                  </>
                )}
                <View style={styles.deviceActiveDot} />
              </Pressable>

              <Pressable
                onPress={() => {
                  void hapticLight();
                  setShowQueue(true);
                }}
                style={styles.queuePill}
                accessibilityLabel="View Up Next queue"
              >
                <ListMusic size={15} color="#ffffff" />
                <Text style={styles.queuePillText}>
                  Queue ({Math.max(0, queue.length - 1)})
                </Text>
              </Pressable>
            </View>

            {/* Lyrics Peek Card (Spotify Style) */}
            {lyrics && lyrics.lines.length > 0 && (
              <Pressable
                onPress={() => {
                  void hapticMedium();
                  setShowLyricsModal(true);
                }}
                style={[styles.lyricsPeekCard, { borderColor: `${palette.accent}44` }]}
                accessibilityLabel="Expand lyrics"
              >
                <View style={styles.lyricsPeekHeader}>
                  <View style={styles.lyricsPeekTitleRow}>
                    <MessageSquareQuote size={13} color={palette.accent} />
                    <Text style={[styles.lyricsPeekTitle, { color: palette.accent }]}>LYRICS</Text>
                  </View>
                  <Text style={styles.lyricsExpandHint}>Tap to expand</Text>
                </View>
                <Text style={styles.lyricsCurrentLine} numberOfLines={1}>
                  {activeLineIdx >= 0 ? lyrics.lines[activeLineIdx].text : lyrics.lines[0]?.text}
                </Text>
                {activeLineIdx >= 0 && activeLineIdx + 1 < lyrics.lines.length && (
                  <Text style={styles.lyricsNextLine} numberOfLines={1}>
                    {lyrics.lines[activeLineIdx + 1].text}
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* Synced Real-Time Karaoke Lyrics Fullsheet Modal */}
        <Modal
          visible={showLyricsModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowLyricsModal(false)}
        >
          <View style={[styles.lyricsModalContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <LinearGradient
              colors={[palette.top, palette.mid, palette.bottom]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.lyricsModalHeader}>
              <Pressable
                onPress={() => {
                  void hapticLight();
                  setShowLyricsModal(false);
                }}
                hitSlop={14}
                style={styles.headerBtn}
                accessibilityLabel="Close lyrics"
              >
                <ChevronDown size={28} color="#ffffff" />
              </Pressable>

              <View style={styles.headerCenter}>
                <Text style={styles.headerEyebrow}>KARAOKE LYRICS</Text>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {currentTrack.track_name}
                </Text>
              </View>

              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              ref={lyricsScrollRef}
              style={styles.lyricsScroll}
              contentContainerStyle={styles.lyricsContent}
              showsVerticalScrollIndicator={false}
            >
              {lyrics?.lines.map((line, idx) => {
                const isActive = idx === activeLineIdx;
                const isPast = idx < activeLineIdx;
                return (
                  <Pressable
                    key={`${line.timeMs}_${idx}`}
                    onPress={() => {
                      void hapticLight();
                      void seekToMs(line.timeMs);
                    }}
                    style={[styles.lyricLineRow, isActive && styles.lyricLineRowActive]}
                  >
                    <Text
                      style={[
                        styles.lyricText,
                        isActive && styles.lyricTextActive,
                        isPast && styles.lyricTextPast,
                      ]}
                    >
                      {line.text}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

        {/* Connect to a Device Modal */}
        <DevicePickerModal
          visible={showDevicePicker}
          onClose={() => setShowDevicePicker(false)}
          activeDevice={activeAudioDevice}
          onSelectDevice={setAudioDevice}
          onStartLiveJam={handleStartLiveJam}
          roomName={optionalRoom?.roomName}
        />
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
  trackActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
  queueSubheading: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#888899',
    marginTop: 2,
  },
  queueSection: {
    marginTop: 14,
  },
  queueSectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#888899',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  queueHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startJamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.amber,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: radius.full,
    gap: 5,
  },
  startJamText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10.5,
    color: '#08080a',
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
  radioPillOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  radioTextOff: {
    color: '#888899',
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
  queueEqualizerIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
    height: 14,
    paddingRight: 4,
  },
  queueEqBar: {
    width: 2.5,
    backgroundColor: colors.amber,
    borderRadius: 1,
  },
  emptyQueueBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyQueueTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 14,
    color: '#ffffff',
    marginBottom: 4,
  },
  emptyQueueSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#888899',
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  queueTrashBtn: {
    padding: 6,
    borderRadius: radius.full,
  },
  deviceRouteBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 12,
  },
  deviceRoutePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 7,
    maxWidth: '65%',
  },
  deviceRouteText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: '#ffffff',
  },
  deviceActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
    marginLeft: 2,
  },
  queuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  queuePillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: '#ffffff',
  },
  recSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recSectionSubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: '#777788',
  },
  recLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  recLoadingText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#888899',
  },
  recAddBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  recAddBtnDisabled: {
    opacity: 0.8,
  },
  recAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 4,
  },
  recAddText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: '#ffffff',
  },
  recAddedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    gap: 4,
  },
  recAddedText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11.5,
    color: colors.green,
  },
  lyricsPeekCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
  },
  lyricsPeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  lyricsPeekTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lyricsPeekTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  lyricsExpandHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
  },
  lyricsCurrentLine: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 22,
  },
  lyricsNextLine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
    lineHeight: 18,
  },
  lyricsModalContainer: {
    flex: 1,
    backgroundColor: '#08080a',
  },
  lyricsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 100,
    gap: 16,
  },
  lyricLineRow: {
    paddingVertical: 6,
  },
  lyricLineRowActive: {
    transform: [{ scale: 1.02 }],
  },
  lyricText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.35)',
    lineHeight: 30,
  },
  lyricTextActive: {
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 34,
  },
  lyricTextPast: {
    color: 'rgba(255, 255, 255, 0.55)',
  },
});
