import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckCircle2, HardDrive, Music, Play, Shuffle } from 'lucide-react-native';
import {
  formatBytesPure,
  type VaultTrack,
  type VaultStats,
} from '../../storage/vault';
import { colors, radius } from '../../theme';
import { fontFamily } from '../../fonts';

export interface PersonalStatsCardProps {
  vaultTracks: VaultTrack[];
  vaultStats: VaultStats | null;
  currentTrackUri?: string;
  onPlayVaultTrack?: (track: VaultTrack) => void;
  onPlayTrack?: (track: VaultTrack) => void;
  onShuffleVault?: () => void;
  onShuffleAll?: () => void;
  onManageVault?: () => void;
  onOpenVault?: () => void;
}

export const PersonalStatsCard: React.FC<PersonalStatsCardProps> = ({
  vaultTracks,
  vaultStats,
  currentTrackUri,
  onPlayVaultTrack,
  onPlayTrack,
  onShuffleVault,
  onShuffleAll,
  onManageVault,
  onOpenVault,
}) => {
  const handlePlay = (track: VaultTrack) => {
    if (onPlayVaultTrack) onPlayVaultTrack(track);
    else if (onPlayTrack) onPlayTrack(track);
  };

  const handleShuffle = () => {
    if (onShuffleVault) onShuffleVault();
    else if (onShuffleAll) onShuffleAll();
  };

  const handleManage = () => {
    if (onManageVault) onManageVault();
    else if (onOpenVault) onOpenVault();
  };

  const hasTracks = vaultTracks && vaultTracks.length > 0;

  return (
    <View style={styles.vaultShelfSection}>
      <View style={styles.vaultShelfHeader}>
        <View style={styles.vaultShelfTitleWrap}>
          <HardDrive size={15} color={colors.amber} />
          <Text style={styles.vaultShelfTitle}>OFFLINE VAULT</Text>
          <View style={styles.vaultShelfBadge}>
            <Text style={styles.vaultShelfBadgeText}>{vaultTracks ? vaultTracks.length : 0}</Text>
          </View>
          {vaultStats && (
            <Text style={styles.vaultShelfGaugeText}>
              • {vaultStats.formattedSize}
            </Text>
          )}
        </View>

        {hasTracks && (
          <Pressable
            onPress={handleShuffle}
            style={({ pressed }) => [styles.vaultShuffleBtn, pressed && styles.pressed]}
            accessibilityLabel="Shuffle offline vault"
          >
            <Shuffle size={12} color="#08080a" strokeWidth={2.4} />
            <Text style={styles.vaultShuffleText}>Shuffle Play</Text>
          </Pressable>
        )}
      </View>

      {hasTracks ? (
        <View style={styles.vaultTrackList}>
          {vaultTracks.map((trk) => {
            const isTrkPlaying = Boolean(
              currentTrackUri &&
                (currentTrackUri === trk.track_uri || currentTrackUri === trk.local_file_uri),
            );
            return (
              <Pressable
                key={trk.track_uri}
                onPress={() => handlePlay(trk)}
                style={({ pressed }) => [
                  styles.vaultTrackRow,
                  isTrkPlaying && styles.vaultTrackRowActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Play ${trk.track_name} by ${trk.artist}`}
              >
                <View style={styles.vaultArtWrap}>
                  {trk.album_art_url ? (
                    <Image
                      source={{ uri: trk.album_art_url }}
                      style={styles.vaultArtImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.vaultArtFallback}>
                      <Music size={18} color={colors.amber} />
                    </View>
                  )}
                  <View style={styles.vaultReadyBadge}>
                    <CheckCircle2 size={10} color="#10b981" />
                  </View>
                </View>

                <View style={styles.vaultTrackMeta}>
                  <Text
                    style={[
                      styles.vaultTrackName,
                      isTrkPlaying && styles.vaultTrackNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {trk.track_name}
                  </Text>
                  <Text style={styles.vaultTrackArtist} numberOfLines={1}>
                    {trk.artist || 'Unknown'} {trk.file_size_bytes ? `• ${formatBytesPure(trk.file_size_bytes)}` : ''}
                  </Text>
                </View>

                <View style={styles.vaultPlayBtn}>
                  <Play
                    size={12}
                    color={isTrkPlaying ? colors.amber : '#ffffff'}
                    fill={isTrkPlaying ? colors.amber : '#ffffff'}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.vaultEmptyCard}>
          <HardDrive size={24} color={colors.amber} />
          <Text style={styles.vaultEmptyTitle}>No Downloaded Songs</Text>
          <Text style={styles.vaultEmptySubtitle}>
            Like songs or tap Download in the Offline Vault to listen without internet.
          </Text>
          <Pressable
            onPress={handleManage}
            style={({ pressed }) => [styles.vaultManageBtn, pressed && styles.pressed]}
          >
            <Text style={styles.vaultManageBtnText}>Manage Downloads</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  vaultShelfSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  vaultShelfHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  vaultShelfTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  vaultShelfTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  vaultShelfBadge: {
    backgroundColor: 'rgba(255, 159, 28, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  vaultShelfBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  vaultShelfGaugeText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: '#8e8e9f',
  },
  vaultShuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.amber,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  vaultShuffleText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    color: '#08080a',
  },
  vaultTrackList: {
    gap: 6,
  },
  vaultTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  vaultTrackRowActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  vaultArtWrap: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#16161f',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  vaultArtImage: {
    width: 44,
    height: 44,
  },
  vaultArtFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultReadyBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(8, 8, 10, 0.85)',
    borderRadius: 6,
    padding: 1,
  },
  vaultTrackMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  vaultTrackName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  vaultTrackNameActive: {
    color: colors.amber,
  },
  vaultTrackArtist: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: '#8e8e9f',
    marginTop: 2,
  },
  vaultPlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultEmptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  vaultEmptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: '#ffffff',
  },
  vaultEmptySubtitle: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: '#8e8e9f',
    textAlign: 'center',
    maxWidth: 260,
  },
  vaultManageBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 159, 28, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  vaultManageBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
  },
  pressed: {
    opacity: 0.8,
  },
});
