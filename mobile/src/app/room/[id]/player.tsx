/**
 * Playing tab — mirrors the PWA's MusicPlayer card:
 * square artwork with EQ bars, track info, progress, transport
 * (shuffle/prev/play/next/repeat), like, volume, lyrics toggle,
 * skip votes. Amber-glow Vinyl & Analog Dark styling.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, glowShadow, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { usePlayer, usePlayerStatus } from '../../../audio/PlayerContext';
import { activeLyricIndex, fetchLyrics, type Lyrics } from '../../../audio/lyrics';
import { isFavourite, toggleFavourite } from '../../../audio/favourites';

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** One animated equalizer bar (PWA parity: animated EQ over artwork). */
function EqBar({ delay, maxH }: { delay: number; maxH: number }) {
  const h = useSharedValue(4);
  useEffect(() => {
    h.value = withRepeat(
      withTiming(maxH, { duration: 420 + delay, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [h, delay, maxH]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.eqBar, style]} />;
}

function EqBars() {
  return (
    <View style={styles.eqWrap}>
      <EqBar delay={0} maxH={22} />
      <EqBar delay={120} maxH={30} />
      <EqBar delay={60} maxH={18} />
      <EqBar delay={200} maxH={26} />
    </View>
  );
}

export default function PlayerTab() {
  const {
    nowPlaying,
    isPlaying,
    loop,
    canControl,
    isHost,
    roomName,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleRepeat,
    shuffleQueue,
    seekToMs,
    voteSkip,
    skipVotes,
    syncReady,
  } = useRoom();
  const player = usePlayer();
  const { durationMs } = usePlayerStatus();

  const [pos, setPos] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [volWidth, setVolWidth] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<Lyrics>({ lines: [], synced: false });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const lyricsListRef = useRef<FlatList>(null);

  useEffect(() => {
    const t = setInterval(() => setPos(player.positionMs()), 500);
    return () => clearInterval(t);
  }, [player]);

  // like state follows the track (PWA: local favourites)
  useEffect(() => {
    const uri = nowPlaying?.track_uri;
    if (!uri) {
      setLiked(false);
      return;
    }
    isFavourite(uri).then(setLiked).catch(() => setLiked(false));
  }, [nowPlaying?.track_uri]);

  // lyrics follow the track (PWA: LRCLIB auto-fetch)
  useEffect(() => {
    setLyrics({ lines: [], synced: false });
    setLyricsLoading(false);
    if (!nowPlaying?.track_name) return;
    let cancelled = false;
    setLyricsLoading(true);
    const durSec = (durationMs || nowPlaying.duration_ms || 0) / 1000;
    fetchLyrics(nowPlaying.artist ?? '', nowPlaying.track_name, durSec)
      .then((l) => {
        if (!cancelled) setLyrics(l);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLyricsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nowPlaying?.track_uri, nowPlaying?.track_name, nowPlaying?.artist]); // eslint-disable-line react-hooks/exhaustive-deps

  const duration = durationMs || nowPlaying?.duration_ms || 0;
  const ratio = duration > 0 ? Math.min(1, pos / duration) : 0;
  const activeIdx = lyrics.synced ? activeLyricIndex(lyrics.lines, pos) : -1;

  useEffect(() => {
    if (lyricsOpen && activeIdx >= 0) {
      lyricsListRef.current?.scrollToIndex({ index: activeIdx, viewPosition: 0.4 });
    }
  }, [activeIdx, lyricsOpen]);

  const onSeekPress = (e: { nativeEvent: { locationX: number } }) => {
    if (!canControl || duration <= 0) return;
    const r = Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, barWidth)));
    seekToMs(r * duration);
  };

  const onVolumePress = (e: { nativeEvent: { locationX: number } }) => {
    const r = Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, volWidth)));
    player.setVolume(r);
  };

  const onLike = useCallback(async () => {
    if (!nowPlaying?.track_uri) return;
    const next = await toggleFavourite(
      nowPlaying.track_uri,
      nowPlaying.track_name,
      nowPlaying.artist,
    );
    setLiked(next);
  }, [nowPlaying]);

  const art = nowPlaying?.album_art_url;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.roomName} numberOfLines={1}>
            {roomName}
          </Text>
          <View style={styles.syncBadge}>
            <View
              style={[styles.syncDot, { backgroundColor: syncReady ? colors.green : colors.amber }]}
            />
            <Text style={styles.syncText}>{syncReady ? 'in sync' : 'syncing…'}</Text>
          </View>
        </View>

        <View style={[styles.artCard, glowShadow]}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} resizeMode="cover" />
          ) : (
            <View style={[styles.art, styles.artFallback]}>
              <Text style={styles.artGlyph}>♪</Text>
            </View>
          )}
          {isPlaying ? (
            <View style={styles.eqOverlay}>
              <EqBars />
            </View>
          ) : null}
        </View>

        <Text style={styles.trackName} numberOfLines={1}>
          {nowPlaying?.track_name ?? 'Nothing playing'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {nowPlaying?.artist ?? 'Add a track to the queue'}
        </Text>

        <Pressable
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onPress={onSeekPress}
          style={styles.progressHit}
        >
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
          </View>
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{fmt(pos)}</Text>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={shuffleQueue}
            disabled={!isHost}
            style={[styles.sideBtn, !isHost && styles.disabled]}
            accessibilityLabel="Shuffle queue"
          >
            <Text style={styles.sideGlyph}>🔀</Text>
          </Pressable>
          <Pressable
            onPress={previousTrack}
            disabled={!canControl}
            style={[styles.ctlBtn, !canControl && styles.disabled]}
          >
            <Text style={styles.ctlGlyph}>⏮</Text>
          </Pressable>
          <Pressable
            onPress={togglePlay}
            disabled={!canControl}
            style={[styles.playBtn, !canControl && styles.disabled]}
          >
            <Text style={styles.playGlyph}>{isPlaying ? '⏸' : '▶'}</Text>
          </Pressable>
          <Pressable
            onPress={nextTrack}
            disabled={!canControl}
            style={[styles.ctlBtn, !canControl && styles.disabled]}
          >
            <Text style={styles.ctlGlyph}>⏭</Text>
          </Pressable>
          <Pressable
            onPress={toggleRepeat}
            disabled={!canControl}
            style={[styles.sideBtn, !canControl && styles.disabled]}
            accessibilityLabel="Toggle repeat"
          >
            <Text style={[styles.sideGlyph, loop && styles.activeGlyph]}>🔁</Text>
            {loop ? <View style={styles.loopDot} /> : null}
          </Pressable>
        </View>

        <View style={styles.utils}>
          <Pressable onPress={onLike} style={styles.utilBtn} hitSlop={10}>
            <Text style={[styles.utilGlyph, liked && styles.likedGlyph]}>
              {liked ? '♥' : '♡'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowVolume((v) => !v)}
            style={styles.utilBtn}
            hitSlop={10}
          >
            <Text style={[styles.utilGlyph, showVolume && styles.activeGlyph]}>
              {player.volume === 0 ? '🔇' : '🔊'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setLyricsOpen((v) => !v)}
            style={styles.utilBtn}
            hitSlop={10}
          >
            <Text style={[styles.utilGlyph, lyricsOpen && styles.activeGlyph]}>🎙</Text>
          </Pressable>
        </View>

        {showVolume ? (
          <Pressable
            onLayout={(e) => setVolWidth(e.nativeEvent.layout.width)}
            onPress={onVolumePress}
            style={styles.volumeHit}
          >
            <View style={styles.volumeBg}>
              <View style={[styles.volumeFill, { width: `${player.volume * 100}%` }]} />
            </View>
            <Text style={styles.volumeLabel}>{Math.round(player.volume * 100)}%</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.skipBtn} onPress={voteSkip}>
          <Text style={styles.skipText}>
            Vote to skip ({skipVotes.votes}/{skipVotes.required || '–'})
          </Text>
        </Pressable>
        {!canControl ? (
          <Text style={styles.hint}>Only the host can control playback</Text>
        ) : null}

        {lyricsOpen ? (
          <View style={styles.lyricsBox}>
            <Text style={styles.lyricsTitle}>Lyrics</Text>
            {lyricsLoading ? (
              <Text style={styles.lyricsHint}>Fetching lyrics…</Text>
            ) : lyrics.lines.length === 0 ? (
              <Text style={styles.lyricsHint}>No lyrics found for this track</Text>
            ) : (
              <FlatList
                ref={lyricsListRef}
                data={lyrics.lines}
                keyExtractor={(_, i) => String(i)}
                scrollEnabled={false}
                onScrollToIndexFailed={() => {}}
                renderItem={({ item, index }) => (
                  <Text
                    style={[
                      styles.lyricLine,
                      lyrics.synced && index === activeIdx && styles.lyricActive,
                      lyrics.synced && index < activeIdx && styles.lyricPast,
                    ]}
                  >
                    {item.text}
                  </Text>
                )}
              />
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const ART = 300;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  scroll: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, alignItems: 'center', paddingBottom: spacing.xl },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  roomName: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 18,
    color: colors.text1,
    flex: 1,
  },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3 },
  artCard: {
    width: ART,
    height: ART,
    borderRadius: 28,
    overflow: 'hidden',
    marginVertical: spacing.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderAmber,
  },
  art: { width: '100%', height: '100%' },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artGlyph: { fontSize: 72, color: colors.amber, opacity: 0.5 },
  eqOverlay: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eqWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 30 },
  eqBar: { width: 4, borderRadius: 2, backgroundColor: colors.amber },
  trackName: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 22,
    color: colors.text1,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  artist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: colors.text3,
    marginTop: 2,
  },
  progressHit: { width: '100%', paddingVertical: spacing.md },
  progressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.amber,
    borderRadius: 3,
    shadowColor: colors.amber,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  times: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.sm,
  },
  time: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  sideBtn: { padding: spacing.sm, alignItems: 'center' },
  sideGlyph: { fontSize: 24, color: colors.text3 },
  activeGlyph: { color: colors.amber },
  loopDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
    marginTop: 2,
  },
  ctlBtn: { padding: spacing.md },
  ctlGlyph: { fontSize: 30, color: colors.text1 },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.amber,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  playGlyph: { fontSize: 30, color: '#08080a', marginLeft: 3 },
  disabled: { opacity: 0.35 },
  utils: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  utilBtn: { padding: spacing.sm },
  utilGlyph: { fontSize: 24, color: colors.text3 },
  likedGlyph: { color: '#ff4d6d' },
  volumeHit: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  volumeBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  volumeFill: { height: '100%', backgroundColor: colors.amber, borderRadius: 2 },
  volumeLabel: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3, width: 40, textAlign: 'right' },
  skipBtn: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  skipText: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.amber },
  hint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: spacing.sm,
  },
  lyricsBox: {
    width: '100%',
    marginTop: spacing.lg,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  lyricsTitle: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 16,
    color: colors.text1,
    marginBottom: spacing.sm,
  },
  lyricsHint: { fontFamily: fontFamily.bodyRegular, fontSize: 13, color: colors.text3 },
  lyricLine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: colors.text3,
    textAlign: 'center',
    paddingVertical: 6,
    lineHeight: 22,
  },
  lyricPast: { opacity: 0.55 },
  lyricActive: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.amber,
    fontSize: 17,
  },
});
