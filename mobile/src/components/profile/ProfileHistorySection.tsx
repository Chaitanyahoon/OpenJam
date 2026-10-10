import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Music, Play, Shuffle, Trash2 } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';
import type { PlayedTrack } from '../../storage/history';
import { formatRelativeTime } from '../../utils/format';

export interface ProfileHistorySectionProps {
  recentTracks: PlayedTrack[];
  onPlayTrack: (track: PlayedTrack) => void;
  onPlayAll?: () => void;
  onShuffle?: () => void;
  onClear?: () => void;
  showClear?: boolean;
}

export function ProfileHistorySection({
  recentTracks,
  onPlayTrack,
  onPlayAll,
  onShuffle,
  onClear,
  showClear = true,
}: ProfileHistorySectionProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>RECENTLY PLAYED ({recentTracks.length})</Text>
        {recentTracks.length > 0 ? (
          <View style={styles.actionsRow}>
            {onPlayAll ? (
              <Pressable
                onPress={onPlayAll}
                style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
                hitSlop={6}
                accessibilityLabel="Play all recently played tracks"
              >
                <Play size={10} color="#08080a" fill="#08080a" />
                <Text style={styles.pillBtnText}>Play All</Text>
              </Pressable>
            ) : null}
            {onShuffle ? (
              <Pressable
                onPress={onShuffle}
                style={({ pressed }) => [styles.pillOutlineBtn, pressed && styles.pressed]}
                hitSlop={6}
                accessibilityLabel="Shuffle recently played tracks"
              >
                <Shuffle size={10} color={colors.amber} />
                <Text style={styles.pillOutlineText}>Shuffle</Text>
              </Pressable>
            ) : null}
            {showClear && onClear ? (
              <Pressable onPress={onClear} hitSlop={6} style={styles.clearBtn} accessibilityLabel="Clear history">
                <Trash2 size={12} color={colors.red} />
                <Text style={styles.clearBtnText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {recentTracks.length === 0 ? (
        <View style={styles.emptyState}>
          <Music size={32} color={colors.text3} opacity={0.4} />
          <Text style={styles.emptyTitle}>No songs played yet</Text>
          <Text style={styles.emptySubtitle}>
            Tracks you jam to in community rooms are remembered here.
          </Text>
        </View>
      ) : (
        recentTracks.map((item, idx) => (
          <Pressable
            key={`${item.track_uri}-${idx}`}
            onPress={() => onPlayTrack(item)}
            style={({ pressed }) => [styles.trackRow, pressed && styles.pressed]}
            accessibilityLabel={`Play ${item.track_name} by ${item.artist}`}
          >
            {item.album_art_url ? (
              <Image source={{ uri: item.album_art_url }} style={styles.artwork} contentFit="cover" />
            ) : (
              <View style={[styles.artwork, styles.artworkFallback]}>
                <Music size={14} color={colors.amber} />
              </View>
            )}

            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>
                {item.track_name}
              </Text>
              <Text style={styles.artistName} numberOfLines={1}>
                {item.artist}
              </Text>
              <Text style={styles.trackMeta}>
                {item.roomName ? `${item.roomName} • ` : ''}
                {formatRelativeTime(item.playedAt || (item as any).played_at)}
              </Text>
            </View>

            <View style={styles.playActionBox}>
              <Play size={12} color={colors.amber} fill={colors.amber} />
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: colors.text3,
    letterSpacing: 0.8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.amber,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#08080a',
  },
  pillOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  pillOutlineText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  clearBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.red,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: colors.text2,
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radius.md,
    padding: 8,
    marginBottom: 6,
  },
  artwork: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 10,
  },
  artworkFallback: {
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.text1,
  },
  artistName: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    marginTop: 1,
  },
  trackMeta: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.text3,
    opacity: 0.7,
    marginTop: 2,
  },
  playActionBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  pressed: {
    opacity: 0.8,
  },
});
