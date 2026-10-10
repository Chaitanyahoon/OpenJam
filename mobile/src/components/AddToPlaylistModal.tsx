/**
 * AddToPlaylistModal — Fast 1-Tap Save Track to Offline Playlists
 *
 * Allows saving the currently playing track to any existing playlist
 * or creating a new playlist on the fly.
 */
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  ListPlus,
  Plus,
  Check,
  Disc,
  FolderPlus,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import {
  getOfflinePlaylists,
  addTrackToOfflinePlaylist,
  saveOfflinePlaylist,
  type OfflinePlaylist,
} from '../storage/history';
import type { TrackInfo } from '../sync/protocol';
import { useToast } from './ToastContext';
import { hapticLight, hapticMedium } from '../utils/haptics';

interface AddToPlaylistModalProps {
  visible: boolean;
  track: TrackInfo | null;
  onClose: () => void;
}

export function AddToPlaylistModal({
  visible,
  track,
  onClose,
}: AddToPlaylistModalProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [playlists, setPlaylists] = useState<OfflinePlaylist[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible && track) {
      void loadPlaylists();
      setIsCreating(false);
      setNewTitle('');
    }
  }, [visible, track]);

  const loadPlaylists = async () => {
    try {
      const list = await getOfflinePlaylists();
      setPlaylists(list);
      if (track) {
        const contains = new Set<string>();
        list.forEach((p) => {
          if (p.tracks.some((t) => t.track_uri === track.track_uri)) {
            contains.add(p.id);
          }
        });
        setAddedPlaylistIds(contains);
      }
    } catch {}
  };

  const handleAddToPlaylist = async (pl: OfflinePlaylist) => {
    if (!track) return;
    if (addedPlaylistIds.has(pl.id)) return;

    void hapticMedium();
    setAddedPlaylistIds((prev) => new Set(prev).add(pl.id));
    await addTrackToOfflinePlaylist(pl.id, track);
    toast(`Added to "${pl.name}"`, 'success');
  };

  const handleCreateAndAdd = async () => {
    const clean = newTitle.trim();
    if (!clean || !track) return;

    try {
      void hapticMedium();
      const created = await saveOfflinePlaylist(clean, [track]);
      setPlaylists((prev) => [created, ...prev]);
      setAddedPlaylistIds((prev) => new Set(prev).add(created.id));
      setNewTitle('');
      setIsCreating(false);
      toast(`Created "${clean}" and added track`, 'success');
    } catch {
      toast('Could not create playlist', 'error');
    }
  };

  if (!track) return null;

  const bottomPad = Math.max(insets.bottom, 20) + 12;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetWrap}>
          <View style={[styles.sheetContainer, { paddingBottom: bottomPad }]}>
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <ListPlus size={18} color={colors.amber} />
                </View>
                <View>
                  <Text style={styles.headerTitle}>Add to Playlist</Text>
                  <Text style={styles.headerSub} numberOfLines={1}>
                    {track.track_name} • {track.artist}
                  </Text>
                </View>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                <X size={18} color={colors.text2} />
              </Pressable>
            </View>

            {/* Create New Playlist Bar */}
            {isCreating ? (
              <View style={styles.createBox}>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Enter playlist name…"
                  placeholderTextColor={colors.text3}
                  style={styles.createInput}
                  autoFocus
                  onSubmitEditing={handleCreateAndAdd}
                  returnKeyType="done"
                />
                <Pressable
                  onPress={handleCreateAndAdd}
                  disabled={!newTitle.trim()}
                  style={({ pressed }) => [
                    styles.saveCreateBtn,
                    !newTitle.trim() && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.saveCreateBtnText}>Create & Add</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsCreating(false);
                    setNewTitle('');
                  }}
                  hitSlop={8}
                >
                  <X size={18} color={colors.text3} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  void hapticLight();
                  setIsCreating(true);
                }}
                style={({ pressed }) => [styles.newPlaylistBtn, pressed && styles.pressed]}
              >
                <FolderPlus size={17} color={colors.amber} />
                <Text style={styles.newPlaylistBtnText}>+ New Playlist</Text>
              </Pressable>
            )}

            {/* Playlists List */}
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              style={styles.playlistList}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => {
                const isAdded = addedPlaylistIds.has(item.id);
                return (
                  <Pressable
                    onPress={() => void handleAddToPlaylist(item)}
                    disabled={isAdded}
                    style={({ pressed }) => [
                      styles.playlistRow,
                      pressed && !isAdded && styles.pressed,
                    ]}
                  >
                    <View style={styles.playlistDiscWrap}>
                      <Disc size={18} color={colors.amber} />
                    </View>
                    <View style={styles.playlistMeta}>
                      <Text style={styles.playlistTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.playlistCount}>
                        {item.tracks.length} track{item.tracks.length === 1 ? '' : 's'}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.addCheckBtn,
                        isAdded && styles.addCheckBtnDone,
                      ]}
                    >
                      {isAdded ? (
                        <Check size={14} color="#10b981" strokeWidth={2.6} />
                      ) : (
                        <Plus size={15} color="#08080a" strokeWidth={2.4} />
                      )}
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No playlists yet. Create your first one above!</Text>
                </View>
              }
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    width: '100%',
    maxWidth: 580,
    alignSelf: 'center',
  },
  sheetContainer: {
    backgroundColor: '#121217',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '75%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 159, 28, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    color: colors.text1,
  },
  headerSub: {
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
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255, 159, 28, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.25)',
    marginBottom: spacing.sm,
  },
  newPlaylistBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 13,
    color: colors.amber,
  },
  createBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  createInput: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: 13,
    color: colors.text1,
    paddingVertical: 6,
  },
  saveCreateBtn: {
    backgroundColor: colors.amber,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  saveCreateBtnText: {
    fontFamily: fontFamily.displayBold,
    fontSize: 12,
    color: '#08080a',
  },
  playlistList: {
    maxHeight: 280,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  playlistDiscWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistMeta: {
    flex: 1,
  },
  playlistTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13.5,
    color: colors.text1,
  },
  playlistCount: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11.5,
    color: colors.text3,
    marginTop: 2,
  },
  addCheckBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCheckBtnDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  emptyWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12.5,
    color: colors.text3,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
});
