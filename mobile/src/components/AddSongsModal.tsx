/**
 * AddSongsModal — Interactive Song Picker & Search for Playlists
 *
 * Unified with SoloSearchModal to eliminate duplicate search logic,
 * giving playlists instant starter vibes, offline vault tracks, and recent searches.
 */
import React from 'react';
import { SoloSearchModal } from './SoloSearchModal';
import { addTrackToOfflinePlaylist } from '../storage/history';
import type { TrackInfo } from '../sync/protocol';

export interface AddSongsModalProps {
  visible: boolean;
  playlistId: string;
  playlistName: string;
  existingTrackUris?: Set<string>;
  onClose: () => void;
  onTrackAdded: (track: TrackInfo) => void;
  onTracksBulkAdded?: (tracks: TrackInfo[]) => void;
}

export function AddSongsModal({
  visible,
  playlistId,
  playlistName,
  existingTrackUris,
  onClose,
  onTrackAdded,
}: AddSongsModalProps) {
  return (
    <SoloSearchModal
      visible={visible}
      mode="playlist"
      playlistName={playlistName}
      existingTrackUris={existingTrackUris}
      onClose={onClose}
      onTrackSelect={(track) => {
        void addTrackToOfflinePlaylist(playlistId, track);
        onTrackAdded(track);
      }}
    />
  );
}
