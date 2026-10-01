/** Queue tab: track search + add, upvoting, host removal. */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';
import { searchTracks, type TrackSearchResult } from '../api';
import { Field } from './ui';

export function QueueList() {
  const { queue, isHost, addTrack, voteTrack, removeTrack } = useRoom();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      setResults(await searchTracks(q));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const renderResult = ({ item }: { item: TrackSearchResult }) => (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={() => {
        addTrack({
          track_uri: item.uri,
          track_name: item.name,
          artist: item.artist,
          album_art_url: item.album_art_url,
          duration_ms: item.duration_ms,
        });
        setResults([]);
        setQuery('');
      }}
    >
      {item.album_art_url ? (
        <Image source={{ uri: item.album_art_url }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artFallback]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <Text style={styles.add}>＋</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View style={styles.searchField}>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Search tracks to add…"
            onSubmitEditing={doSearch}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={doSearch}>
          {searching ? (
            <ActivityIndicator color="#08080a" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Add</Text>
          )}
        </Pressable>
      </View>

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(i) => i.uri}
          renderItem={renderResult}
          style={styles.results}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(i) => i.queue_item_id}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Queue is empty — search above to add the first track.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.album_art_url ? (
                <Image source={{ uri: item.album_art_url }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artFallback]} />
              )}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.track_name}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              <Pressable style={styles.voteBtn} onPress={() => voteTrack(item.queue_item_id)}>
                <Text style={styles.voteText}>▲ {item.votes ?? 0}</Text>
              </Pressable>
              {isHost ? (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeTrack(item.queue_item_id)}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  searchField: { flex: 1 },
  searchBtn: {
    backgroundColor: colors.amber,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  searchBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    color: '#08080a',
    fontSize: 15,
  },
  results: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  art: { width: 46, height: 46, borderRadius: 8 },
  artFallback: { backgroundColor: colors.bgSurface },
  info: { flex: 1, marginLeft: spacing.sm },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: 15, color: colors.text1 },
  artist: { fontFamily: fontFamily.bodyRegular, fontSize: 13, color: colors.text3 },
  add: { fontSize: 22, color: colors.amber, paddingHorizontal: spacing.sm },
  voteBtn: {
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  voteText: { fontFamily: fontFamily.bodyMedium, fontSize: 13, color: colors.amber },
  removeBtn: { padding: spacing.sm },
  removeText: { color: colors.red, fontSize: 16 },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    color: colors.text3,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
