import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CheckCircle2,
  Clock,
  Heart,
  Music,
  Play,
  Shuffle,
} from 'lucide-react-native';
import type { TrackInfo } from '../../sync/protocol';
import type { PlayedTrack } from '../../storage/history';
import { colors, radius, spacing } from '../../theme';
import { fontFamily } from '../../fonts';

export interface MusicShelvesProps {
  favoriteTracks: TrackInfo[];
  recentTracks: PlayedTrack[];
  downloadedUris: Set<string>;
  onPlayLikedTrack: (track: TrackInfo) => void;
  onShuffleLiked: () => void;
  onPlayRecentTrack: (track: PlayedTrack) => void;
  onClearRecent: () => void;
}

export const MusicShelves: React.FC<MusicShelvesProps> = ({
  favoriteTracks,
  recentTracks,
  downloadedUris,
  onPlayLikedTrack,
  onShuffleLiked,
  onPlayRecentTrack,
  onClearRecent,
}) => {
  const hasLiked = favoriteTracks && favoriteTracks.length > 0;
  const hasRecent = recentTracks && recentTracks.length > 0;

  if (!hasLiked && !hasRecent) return null;

  return (
    <>
      {/* 1-Tap Liked Songs Shelf */}
      {hasLiked && (
        <View style={styles.likedSection}>
          <View style={styles.likedHeader}>
            <View style={styles.likedTitleWrap}>
              <Heart size={13} color="#ef4444" fill="#ef4444" />
              <Text style={styles.likedTitle}>LIKED SONGS</Text>
              <View style={styles.likedCountBadge}>
                <Text style={styles.likedCountText}>{favoriteTracks.length}</Text>
              </View>
            </View>

            <Pressable
              onPress={onShuffleLiked}
              style={({ pressed }) => [styles.likedShufflePill, pressed && styles.pressed]}
              accessibilityLabel="Shuffle Play all liked songs"
            >
              <Shuffle size={12} color="#08080a" strokeWidth={2.4} />
              <Text style={styles.likedShufflePillText}>Shuffle Play</Text>
            </Pressable>
          </View>

          {/* Horizontal carousel of liked songs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.likedScroll}
            style={styles.likedScrollView}
          >
            {favoriteTracks.map((trk) => (
              <Pressable
                key={trk.track_uri}
                onPress={() => onPlayLikedTrack(trk)}
                style={({ pressed }) => [styles.likedTrackCard, pressed && styles.pressed]}
              >
                <View style={styles.likedArtWrap}>
                  {trk.album_art_url ? (
                    <Image
                      source={{ uri: trk.album_art_url }}
                      style={styles.likedArtImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.likedArtFallback}>
                      <Music size={20} color={colors.amber} />
                    </View>
                  )}
                  <View style={styles.likedPlayOverlay}>
                    <Play size={10} color="#08080a" fill="#08080a" />
                  </View>
                  {downloadedUris.has(trk.track_uri) && (
                    <View style={styles.downloadedCornerBadge}>
                      <CheckCircle2 size={10} color="#10b981" />
                    </View>
                  )}
                </View>
                <Text style={styles.likedTrackName} numberOfLines={1}>
                  {trk.track_name}
                </Text>
                <Text style={styles.likedTrackArtist} numberOfLines={1}>
                  {trk.artist || 'Unknown Artist'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 1-Tap Recently Played Shelf */}
      {hasRecent && (
        <View style={styles.recentSection}>
          <View style={styles.recentHeader}>
            <View style={styles.recentTitleWrap}>
              <Clock size={13} color={colors.amber} />
              <Text style={styles.recentTitle}>RECENTLY PLAYED</Text>
              <View style={styles.recentCountBadge}>
                <Text style={styles.recentCountText}>{recentTracks.length}</Text>
              </View>
            </View>

            <Pressable
              onPress={onClearRecent}
              hitSlop={8}
              style={({ pressed }) => [styles.recentClearBtn, pressed && styles.pressed]}
              accessibilityLabel="Clear recently played history"
            >
              <Text style={styles.recentClearText}>Clear</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentScroll}
            style={styles.recentScrollView}
          >
            {recentTracks.slice(0, 15).map((trk) => (
              <Pressable
                key={`${trk.track_uri}-${trk.playedAt}`}
                onPress={() => onPlayRecentTrack(trk)}
                style={({ pressed }) => [styles.recentTrackCard, pressed && styles.pressed]}
              >
                <View style={styles.recentArtWrap}>
                  {trk.album_art_url ? (
                    <Image
                      source={{ uri: trk.album_art_url }}
                      style={styles.recentArtImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.recentArtFallback}>
                      <Music size={18} color={colors.amber} />
                    </View>
                  )}
                  <View style={styles.recentPlayOverlay}>
                    <Play size={9} color="#08080a" fill="#08080a" />
                  </View>
                  {downloadedUris.has(trk.track_uri) && (
                    <View style={styles.downloadedCornerBadge}>
                      <CheckCircle2 size={10} color="#10b981" />
                    </View>
                  )}
                </View>
                <Text style={styles.recentTrackName} numberOfLines={1}>
                  {trk.track_name}
                </Text>
                <Text style={styles.recentTrackArtist} numberOfLines={1}>
                  {trk.artist || 'Unknown'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  likedSection: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  likedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  likedTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likedTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  likedCountBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  likedCountText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: '#ef4444',
  },
  likedShufflePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  likedShufflePillText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#08080a',
  },
  likedScrollView: {
    marginHorizontal: -spacing.md,
  },
  likedScroll: {
    gap: 12,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
  },
  likedTrackCard: {
    width: 120,
  },
  likedArtWrap: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
    position: 'relative',
  },
  likedArtImage: {
    width: '100%',
    height: '100%',
  },
  likedArtFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
  },
  likedPlayOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  downloadedCornerBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(88, 8, 10, 0.85)',
    borderRadius: 9,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  likedTrackName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 2,
  },
  likedTrackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10.5,
    color: colors.text3,
  },

  recentSection: {
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  recentTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.text2,
  },
  recentCountBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
  },
  recentCountText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  recentClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recentClearText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
  },
  recentScrollView: {
    marginHorizontal: -spacing.md,
  },
  recentScroll: {
    gap: 12,
    paddingVertical: 4,
    paddingLeft: spacing.md,
    paddingRight: spacing.md + 14,
  },
  recentTrackCard: {
    width: 110,
  },
  recentArtWrap: {
    width: 110,
    height: 110,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 6,
    position: 'relative',
  },
  recentArtImage: {
    width: '100%',
    height: '100%',
  },
  recentArtFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
  },
  recentPlayOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  recentTrackName: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: '#ffffff',
    marginBottom: 2,
  },
  recentTrackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.text3,
  },
  pressed: {
    opacity: 0.8,
  },
});
