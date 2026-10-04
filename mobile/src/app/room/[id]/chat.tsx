/**
 * Chat tab:
 * - Active room presence strip with online avatars & host indicators
 * - Tap any member in presence strip to @mention in chat
 * - Upgraded ChatPanel with Discord avatars, reaction dock, and message bubbles
 */
import React, { useCallback, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { colors, spacing } from '../../../theme';
import { fontFamily } from '../../../fonts';
import { useRoom } from '../../../state/RoomContext';
import { ChatPanel, ChatPanelRef, initials, nameColor } from '../../../components/ChatPanel';

export default function ChatTab() {
  const { listeners, setChatFocused, me } = useRoom();
  const chatPanelRef = useRef<ChatPanelRef>(null);
  const params = useLocalSearchParams<{ id: string; mention?: string }>();

  // Opening the chat tab clears the unread badge and handles mentions
  useFocusEffect(
    useCallback(() => {
      setChatFocused(true);
      if (params.mention) {
        chatPanelRef.current?.insertMention(params.mention);
      }
      return () => setChatFocused(false);
    }, [setChatFocused, params.mention]),
  );

  const handleMemberPress = (userName: string) => {
    chatPanelRef.current?.insertMention(userName);
  };

  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Active room presence strip */}
        <View style={styles.presenceSection}>
          <View style={styles.presenceHeader}>
            <View style={styles.livePulseDot} />
            <Text style={styles.presenceTitle}>
              IN ROOM ({listeners.length})
            </Text>
            <Text style={styles.presenceSub}>Tap to @mention</Text>
          </View>

          <FlatList
            horizontal
            data={listeners}
            keyExtractor={(l) => l.user_id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presenceList}
            renderItem={({ item }) => {
              const isMe = me && item.user_id === me.id;
              return (
                <Pressable
                  style={styles.person}
                  onPress={() => handleMemberPress(item.user_name)}
                  hitSlop={6}
                >
                  <View style={[styles.avatarWrap, item.is_host && styles.avatarWrapHost]}>
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.avatarImg}
                        contentFit="cover"
                        transition={200}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatarFallback,
                          { backgroundColor: nameColor(item.user_name) },
                        ]}
                      >
                        <Text style={styles.avatarInitial}>{initials(item.user_name)}</Text>
                      </View>
                    )}
                    <View style={styles.onlineDot} />
                    {item.is_host ? (
                      <View style={styles.hostStarBadge}>
                        <Crown size={8} color="#08080a" />
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.personName} numberOfLines={1}>
                    {isMe ? 'You' : item.user_name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Chat message stream and input */}
        <View style={styles.chat}>
          <ChatPanel ref={chatPanelRef} onMentionUser={handleMemberPress} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  presenceSection: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.xs,
  },
  presenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  presenceTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 10.5,
    color: colors.text3,
    letterSpacing: 1,
  },
  presenceSub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10.5,
    color: colors.text3,
    opacity: 0.6,
    marginLeft: 'auto',
  },
  presenceList: {
    paddingVertical: 2,
    gap: spacing.md,
  },
  person: {
    alignItems: 'center',
    width: 58,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    position: 'relative',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarWrapHost: {
    borderColor: colors.amber,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    backgroundColor: colors.bgSurface,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.displayBold,
    fontSize: 15,
    color: '#08080a',
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.bgBase,
  },
  hostStarBadge: {
    position: 'absolute',
    top: -3,
    left: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostStar: {
    fontSize: 9,
    color: '#08080a',
    fontWeight: 'bold',
  },
  personName: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    color: colors.text2,
    marginTop: 3,
    textAlign: 'center',
  },
  chat: {
    flex: 1,
  },
});
