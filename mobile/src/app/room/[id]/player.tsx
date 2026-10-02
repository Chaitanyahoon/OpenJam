/**
 * Playing tab — minimalist: artwork, whisper-thin progress, monochrome
 * transport with one amber play button, "Up next | Lyrics" text links.
 */
import React, { useEffect, useRef, useState } from 'react';
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
import { router } from 'expo-router';
import { colors, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { usePlayer, usePlayerStatus } from '../../../audio/PlayerContext';
import { activeLyricIndex, fetchLyrics, type Lyrics } from '../../../audio/lyrics';

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlayerTab() {
  const {
    roomId,
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
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyrics, setLyrics] = useState<Lyrics>({ lines: [], synced: false });
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsListRef = useRef<FlatList>(null);

  useEffect(() => {
    const t = setInterval(() => setPos(player.positionMs()), 500);
    return () => clearInterval(t);
  }, [player]);

  // lyrics follow the track (LRCLIB)
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

  const goQueue = () =>
    router.push({ pathname: '/room/[id]/queue', params: { id: roomId } });

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

        <View style={styles.artCard}>
          {art ? (
            <Image source={{ uri: art }} style={styles.art} resizeMode="cover" />
          ) : (
            <View style={[styles.art, styles.artFallback]}>
              <Text style={styles.artGlyph}>♪</Text>
            </View>
          )}
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
            <Text style={styles.sideGlyph}>⇄</Text>
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
            <Text style={[styles.sideGlyph, loop && styles.activeGlyph]}>↻</Text>
          </Pressable>
        </View>

        <View style={styles.links}>
          <Pressable onPress={goQueue} hitSlop={10}>
            <Text style={styles.link}>Up next</Text>
          </Pressable>
          <View style={styles.linkDivider} />
          <Pressable onPress={() => setLyricsOpen((v) => !v)} hitSlop={10}>
            <Text style={[styles.link, lyricsOpen && styles.linkActive]}>Lyrics</Text>
          </Pressable>
        </View>

        {lyricsOpen ? (
          <View style={styles.lyricsBox}>
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

        <Pressable style={styles.skipLink} onPress={voteSkip} hitSlop={10}>
          <Text style={styles.skipText}>
            Vote to skip ({skipVotes.votes}/{skipVotes.required || '–'})
          </Text>
        </Pressable>
        {!canControl ? (
          <Text style={styles.hint}>Only the host can control playback</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const ART = 280;

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
    fontFamily: fontFamily.bodyMedium,
    fontSize: 16,
    color: colors.text1,
    flex: 1,
  },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 7, height: 7, borderRadius: 3.5 },
  syncText: { fontFamily: fontFamily.bodyRegular, fontSize: 12, color: colors.text3 },
  artCard: {
    width: ART,
    height: ART,
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: spacing.lg,
    backgroundColor: colors.bgSurface,
  },
  art: { width: '100%', height: '100%' },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  artGlyph: { fontSize: 64, color: colors.text3, opacity: 0.5 },
  trackName: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 21,
    color: colors.text1,
    textAlign: 'center',
  },
  artist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 14,
    color: colors.text3,
    marginTop: 4,
  },
  progressHit: { width: '100%', paddingVertical: spacing.md },
  progressBg: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.bgSurface,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.amber, borderRadius: 2 },
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
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  sideBtn: { padding: spacing.sm },
  sideGlyph: { fontSize: 22, color: colors.text3 },
  activeGlyph: { color: colors.amber },
  ctlBtn: { padding: spacing.sm },
  ctlGlyph: { fontSize: 28, color: colors.text1 },
  playBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 26, color: '#08080a', marginLeft: 3 },
  disabled: { opacity: 0.3 },
  links: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  link: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.text3 },
  linkActive: { color: colors.amber },
  linkDivider: { width: 1, height: 14, backgroundColor: colors.hairline },
  lyricsBox: { width: '100%', marginTop: spacing.lg },
  lyricsHint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
  },
  lyricLine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: colors.text3,
    textAlign: 'center',
    paddingVertical: 6,
    lineHeight: 22,
  },
  lyricPast: { opacity: 0.5 },
  lyricActive: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.text1,
    fontSize: 17,
  },
  skipLink: { marginTop: spacing.xl },
  skipText: { fontFamily: fontFamily.bodyRegular, fontSize: 13, color: colors.amber },
  hint: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: spacing.sm,
  },
});
