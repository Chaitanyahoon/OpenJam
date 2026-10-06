/**
 * ImportPlaylistModal — Universal Spotify & YouTube Playlist Importer
 *
 * Supports importing public playlists into:
 * 1. Live Room Queue (mode='queue')
 * 2. Personal Saved Playlists (mode='save')
 *
 * Zero emojis — strictly Lucide vector icons.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  X,
  ListMusic,
  Check,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Music,
  DownloadCloud,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { importExternalPlaylist, isPlaylistUrl, type ImportedPlaylistTrack } from '../api';
import type { TrackInfo } from '../sync/protocol';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface ImportPlaylistModalProps {
  visible: boolean;
  initialUrl?: string;
  mode?: 'queue' | 'save';
  onClose: () => void;
  onAddToQueue?: (tracks: TrackInfo[]) => void;
  onSaveToPlaylists?: (name: string, tracks: TrackInfo[]) => void;
}

export function ImportPlaylistModal({
  visible,
  initialUrl = '',
  mode = 'queue',
  onClose,
  onAddToQueue,
  onSaveToPlaylists,
}: ImportPlaylistModalProps) {
  const [url, setUrl] = useState(initialUrl);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedTracks, setExtractedTracks] = useState<ImportedPlaylistTrack[]>([]);

  useEffect(() => {
    if (visible) {
      setUrl(initialUrl);
      setError(null);
      setExtractedTracks([]);
      setPlaylistTitle('');
      if (initialUrl && isPlaylistUrl(initialUrl)) {
        void handleScan(initialUrl);
      }
    }
  }, [visible, initialUrl]);

  const detectSource = (text: string): 'spotify' | 'youtube' | 'unknown' => {
    const clean = text.toLowerCase();
    if (clean.includes('spotify.com/playlist/')) return 'spotify';
    if (clean.includes('youtube.com') || clean.includes('youtu.be')) return 'youtube';
    return 'unknown';
  };

  const handleScan = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : url).trim();
    if (!targetUrl) {
      setError('Please enter a Spotify or YouTube playlist link');
      return;
    }

    if (!isPlaylistUrl(targetUrl)) {
      setError('Invalid link. Must be a public Spotify or YouTube playlist URL.');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedTracks([]);

    try {
      const tracks = await importExternalPlaylist(targetUrl);
      if (!tracks || tracks.length === 0) {
        setError('No playable tracks found. Make sure the playlist is set to Public.');
      } else {
        setExtractedTracks(tracks);
        const sourceName = detectSource(targetUrl) === 'spotify' ? 'Spotify' : 'YouTube';
        setPlaylistTitle(`Imported ${sourceName} Playlist`);
        void hapticMedium();
      }
    } catch (err: any) {
      const msg = err?.message || 'Could not fetch playlist. Please check link and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAction = () => {
    if (extractedTracks.length === 0) return;

    const mappedTracks: TrackInfo[] = extractedTracks.map((t) => ({
      track_uri: t.uri,
      track_name: t.name,
      artist: t.artist || 'Unknown Artist',
      album_art_url: t.album_art_url,
      duration_ms: t.duration_ms || 0,
    }));

    if (mode === 'queue') {
      onAddToQueue?.(mappedTracks);
    } else {
      const nameToSave = playlistTitle.trim() || 'Imported Playlist';
      onSaveToPlaylists?.(nameToSave, mappedTracks);
    }

    void hapticMedium();
    onClose();
  };

  const source = detectSource(url);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheetContainer}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.badgeIconWrap}>
                  <DownloadCloud size={18} color={colors.amber} />
                </View>
                <View>
                  <Text style={styles.sheetTitle}>
                    {mode === 'queue' ? 'Import to Queue' : 'Import Playlist'}
                  </Text>
                  <Text style={styles.sheetSub}>Spotify & YouTube Music Playlists</Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
                <X size={18} color={colors.text2} />
              </Pressable>
            </View>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <View style={styles.inputRow}>
                <TextInput
                  value={url}
                  onChangeText={(val) => {
                    setUrl(val);
                    setError(null);
                  }}
                  placeholder="Paste Spotify or YouTube playlist link…"
                  placeholderTextColor={colors.text3}
                  style={styles.urlInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectTextOnFocus
                  onSubmitEditing={() => handleScan()}
                  returnKeyType="go"
                />
                {url.length > 0 ? (
                  <Pressable
                    onPress={() => {
                      setUrl('');
                      setExtractedTracks([]);
                      setError(null);
                    }}
                    hitSlop={8}
                    style={styles.inputClearBtn}
                  >
                    <X size={14} color={colors.text3} />
                  </Pressable>
                ) : null}
              </View>

              {/* Source Tag Badge */}
              {source !== 'unknown' ? (
                <View style={styles.sourceTagRow}>
                  <View style={styles.sourceBadge}>
                    <Sparkles size={11} color={colors.amber} />
                    <Text style={styles.sourceBadgeText}>
                      Detected {source === 'spotify' ? 'Spotify' : 'YouTube'} Playlist
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Scan Trigger Button */}
              {extractedTracks.length === 0 ? (
                <Pressable
                  onPress={() => handleScan()}
                  disabled={loading || !url.trim()}
                  style={({ pressed }) => [
                    styles.scanBtn,
                    (!url.trim() || loading) && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#08080a" />
                  ) : (
                    <>
                      <Text style={styles.scanBtnText}>Scan Playlist</Text>
                      <ArrowRight size={16} color="#08080a" strokeWidth={2.4} />
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color={colors.red} style={{ marginTop: 2 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Loading Indicator */}
            {loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.amber} />
                <Text style={styles.loadingText}>Fetching playlist tracks from source…</Text>
              </View>
            ) : null}

            {/* Results Preview */}
            {extractedTracks.length > 0 ? (
              <View style={styles.resultsContainer}>
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsCount}>
                    {extractedTracks.length} TRACKS FOUND
                  </Text>
                  <Pressable
                    onPress={() => {
                      setExtractedTracks([]);
                      setUrl('');
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.changeLinkText}>Change Link</Text>
                  </Pressable>
                </View>

                {mode === 'save' ? (
                  <View style={styles.nameEditWrap}>
                    <Text style={styles.fieldLabel}>PLAYLIST TITLE</Text>
                    <TextInput
                      value={playlistTitle}
                      onChangeText={setPlaylistTitle}
                      placeholder="Enter playlist name"
                      placeholderTextColor={colors.text3}
                      style={styles.nameInput}
                    />
                  </View>
                ) : null}

                {/* Track Preview List */}
                <FlatList
                  data={extractedTracks}
                  keyExtractor={(item, index) => `${item.uri}_${index}`}
                  showsVerticalScrollIndicator={true}
                  style={styles.previewList}
                  renderItem={({ item, index }) => (
                    <View style={styles.trackRow}>
                      <Text style={styles.trackIndex}>#{index + 1}</Text>
                      {item.album_art_url ? (
                        <Image
                          source={{ uri: item.album_art_url }}
                          style={styles.trackArt}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.trackArt, styles.trackArtPlaceholder]}>
                          <Music size={14} color={colors.text3} />
                        </View>
                      )}
                      <View style={styles.trackMeta}>
                        <Text style={styles.trackName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                          {item.artist}
                        </Text>
                      </View>
                    </View>
                  )}
                />

                {/* Confirm Action Button */}
                <Pressable
                  onPress={handleConfirmAction}
                  style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
                >
                  <Check size={18} color="#08080a" strokeWidth={2.4} />
                  <Text style={styles.confirmBtnText}>
                    {mode === 'queue'
                      ? `Add All (${extractedTracks.length}) to Queue`
                      : `Save (${extractedTracks.length}) to Library`}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
  },
  sheetContainer: {
    backgroundColor: '#121217',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 18,
    color: colors.text1,
  },
  sheetSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  urlInput: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13.5,
    color: colors.text1,
    paddingVertical: 0,
  },
  inputClearBtn: {
    padding: 4,
  },
  sourceTagRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  sourceBadgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.amber,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: 14,
    height: 46,
    marginTop: 12,
  },
  scanBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#08080a',
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.red,
    lineHeight: 16,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 12,
  },
  loadingText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text2,
  },
  resultsContainer: {
    marginTop: spacing.sm,
    maxHeight: 380,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 8,
  },
  resultsCount: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    color: colors.amber,
    letterSpacing: 0.8,
  },
  changeLinkText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    color: colors.text3,
    textDecorationLine: 'underline',
  },
  nameEditWrap: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10,
    color: colors.text3,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  nameInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.text1,
  },
  previewList: {
    maxHeight: 210,
    marginBottom: 12,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  trackIndex: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
    width: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  trackArt: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  trackArtPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackMeta: {
    flex: 1,
  },
  trackName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12.5,
    color: colors.text1,
  },
  trackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text2,
    marginTop: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.amber,
    borderRadius: 14,
    height: 48,
    marginTop: 4,
  },
  confirmBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#08080a',
  },
});
