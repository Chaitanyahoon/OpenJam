/** Player tab: vinyl, track info, progress, transport controls. */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { usePlayer, usePlayerStatus } from '../../../audio/PlayerContext';
import { Vinyl } from '../../../components/Vinyl';

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PlayerTab() {
  const {
    nowPlaying,
    isPlaying,
    canControl,
    roomName,
    togglePlay,
    nextTrack,
    previousTrack,
    seekToMs,
    voteSkip,
    skipVotes,
    syncReady,
  } = useRoom();
  const player = usePlayer();
  const { durationMs } = usePlayerStatus();
  const [pos, setPos] = useState(0);
  const barRef = useRef<View>(null);
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPos(player.positionMs()), 500);
    return () => clearInterval(t);
  }, [player]);

  const duration = durationMs || nowPlaying?.duration_ms || 0;
  const ratio = duration > 0 ? Math.min(1, pos / duration) : 0;

  const onSeekPress = (e: { nativeEvent: { locationX: number } }) => {
    if (!canControl || duration <= 0) return;
    const r = Math.min(1, Math.max(0, e.nativeEvent.locationX / Math.max(1, barWidth)));
    seekToMs(r * duration);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
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

        <View style={styles.vinylWrap}>
          <Vinyl artworkUrl={nowPlaying?.album_art_url} playing={isPlaying} />
        </View>

        <Text style={styles.trackName} numberOfLines={1}>
          {nowPlaying?.track_name ?? 'Nothing playing'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {nowPlaying?.artist ?? 'Join a room and add tracks'}
        </Text>

        <Pressable
          ref={barRef}
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
        </View>

        <Pressable style={styles.skipBtn} onPress={voteSkip}>
          <Text style={styles.skipText}>
            Vote to skip ({skipVotes.votes}/{skipVotes.required || '–'})
          </Text>
        </Pressable>
        {!canControl ? (
          <Text style={styles.hint}>Only the host can control playback</Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgBase },
  container: { flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center' },
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
  vinylWrap: { marginVertical: spacing.md },
  trackName: {
    fontFamily: fontFamily.displaySemiBold,
    fontSize: 22,
    color: colors.text1,
    marginTop: spacing.sm,
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
    gap: spacing.lg,
    marginTop: spacing.lg,
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
});
