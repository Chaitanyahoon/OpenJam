/** Queue tab: track search + add, upvoting, host removal. Minimalist rows. */
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
  const { queue, nowPlaying, isHost, addTrack, voteTrack, removeTrack } = useRoom();
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
            placeholder="Search tracks…"
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
          ListHeaderComponent={
            nowPlaying ? (
              <View>
                <Text style={styles.sectionLabel}>Now playing</Text>
                <View style={styles.row}>
                  {nowPlaying.album_art_url ? (
                    <Image source={{ uri: nowPlaying.album_art_url }} style={styles.art} />
                  ) : (
                    <View style={[styles.art, styles.artFallback]} />
                  )}
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>
                      {nowPlaying.track_name}
                    </Text>
                    <Text style={styles.artist} numberOfLines={1}>
                      {nowPlaying.artist}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.sectionLabel, styles.upNext]}>Up next</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {nowPlaying
                ? 'Nothing up next — search above to add.'
                : 'Queue is empty — search above to add the first track.'}
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
              <Pressable
                style={styles.voteBtn}
                onPress={() => voteTrack(item.queue_item_id)}
                hitSlop={10}
              >
                <Text style={styles.voteText}>▲ {item.votes ?? 0}</Text>
              </Pressable>
              {isHost ? (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => removeTrack(item.queue_item_id)}
                  hitSlop={10}
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
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  sectionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.text3,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  upNext: { marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  pressed: { opacity: 0.7 },
  art: { width: 48, height: 48, borderRadius: 8 },
  artFallback: { backgroundColor: colors.bgSurface },
  info: { flex: 1, marginLeft: spacing.md },
  name: { fontFamily: fontFamily.bodyMedium, fontSize: 15, color: colors.text1 },
  artist: { fontFamily: fontFamily.bodyRegular, fontSize: 13, color: colors.text3, marginTop: 1 },
  add: { fontSize: 22, color: colors.amber, paddingHorizontal: spacing.sm },
  voteBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  voteText: { fontFamily: fontFamily.bodyMedium, fontSize: 14, color: colors.amber },
  removeBtn: { padding: spacing.sm },
  removeText: { color: colors.text3, fontSize: 15 },
  empty: {
    fontFamily: fontFamily.bodyRegular,
    color: colors.text3,
    marginTop: spacing.xl,
    fontSize: 14,
  },
});
