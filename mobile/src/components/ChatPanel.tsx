/**
 * Chat tab message panel:
 * - High-contrast message bubbles with Discord avatars & deterministic color-coded initials
 * - Host badges (Host crown)
 * - Message timestamps (HH:MM AM/PM)
 * - Animated typing indicator
 * - Quick emoji reactions dock
 * - Mention tapping (tap author or avatar to mention)
 * - Smooth auto-scroll & keyboard handling
 */
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  MessageSquare,
  Send,
  Heart,
  Flame,
  Sparkles,
  ThumbsUp,
  Music,
  UserPlus,
  LogOut,
} from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';
import { hapticLight } from '../utils/haptics';

const CHAT_REACTIONS = [
  { id: 'heart', icon: <Heart size={14} color="#ef4444" fill="#ef4444" /> },
  { id: 'fire', icon: <Flame size={14} color="#f97316" fill="#f97316" /> },
  { id: 'sparkles', icon: <Sparkles size={14} color={colors.amber} fill={colors.amber} /> },
  { id: 'thumbsup', icon: <ThumbsUp size={14} color="#3b82f6" fill="#3b82f6" /> },
  { id: 'music', icon: <Music size={14} color="#a855f7" /> },
];

export interface ChatPanelRef {
  insertMention: (userName: string) => void;
}

export function nameColor(name?: string | null): string {
  if (!name) return '#ff9f1c';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = ['#ff9f1c', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#eab308'];
  return palette[Math.abs(hash) % palette.length];
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/[\s-_]+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTimestamp(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const mm = m < 10 ? `0${m}` : m;
  return `${h}:${mm} ${ampm}`;
}

export const ChatPanel = forwardRef<ChatPanelRef, { onMentionUser?: (name: string) => void }>(
  function ChatPanel({ onMentionUser }, ref) {
    const { messages, typingUsers, sendChat, setTyping, me, listeners, sendReaction } = useRoom();
    const [input, setInput] = useState('');
    const listRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);
    const isNearBottomRef = useRef(true);

    useImperativeHandle(ref, () => ({
      insertMention: (userName: string) => {
        const mention = `@${userName} `;
        setInput((prev) => (prev.endsWith(' ') || prev.length === 0 ? `${prev}${mention}` : `${prev} ${mention}`));
        inputRef.current?.focus();
      },
    }));

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 80;
      isNearBottomRef.current =
        layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    };

    const submit = () => {
      const text = input.trim();
      if (!text) return;
      sendChat(text);
      setInput('');
      setTyping(false);
      isNearBottomRef.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleMention = (userName: string) => {
      if (onMentionUser) {
        onMentionUser(userName);
      } else {
        const mention = `@${userName} `;
        setInput((prev) => (prev.endsWith(' ') || prev.length === 0 ? `${prev}${mention}` : `${prev} ${mention}`));
        inputRef.current?.focus();
      }
    };

    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            if (isNearBottomRef.current) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          renderItem={({ item }) => {
            if (item.is_system) {
              let icon = <Sparkles size={11} color={colors.amber} />;
              let isAmber = false;
              if (item.system_type === 'join') {
                icon = <UserPlus size={11} color={colors.green} />;
              } else if (item.system_type === 'leave') {
                icon = <LogOut size={11} color={colors.text3} />;
              } else if (item.system_type === 'host') {
                icon = <Crown size={11} color={colors.amber} />;
                isAmber = true;
              }
              return (
                <View style={styles.systemRow}>
                  <View style={[styles.systemPill, isAmber && styles.systemPillHost]}>
                    {icon}
                    <Text style={[styles.systemText, isAmber && styles.systemTextHost]}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              );
            }

            const mine = me && item.user_id === me.id;
            const isHostMsg = listeners.some((l) => l.user_id === item.user_id && l.is_host);

            if (mine) {
              return (
                <View style={styles.bubbleRowMine}>
                  <View style={styles.bubbleMine}>
                    <Text style={styles.textMine}>{item.content}</Text>
                    <Text style={styles.timeMine}>{formatTimestamp(item.timestamp)}</Text>
                  </View>
                </View>
              );
            }

            return (
              <View style={styles.bubbleRowOther}>
                <Pressable onPress={() => handleMention(item.user_name)} hitSlop={4}>
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
                </Pressable>

                <View style={styles.bubbleOther}>
                  <View style={styles.authorRow}>
                    <Pressable onPress={() => handleMention(item.user_name)} hitSlop={4}>
                      <Text style={[styles.authorName, { color: nameColor(item.user_name) }]}>
                        {item.user_name}
                      </Text>
                    </Pressable>
                    {isHostMsg ? (
                      <View style={styles.hostBadge}>
                        <Crown size={9} color={colors.amber} />
                        <Text style={styles.hostBadgeText}>Host</Text>
                      </View>
                    ) : null}
                    <Text style={styles.timestamp}>{formatTimestamp(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.textOther}>{item.content}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <MessageSquare size={26} color={colors.text3} opacity={0.5} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                Say hi, drop a track recommendation, or mention a listener!
              </Text>
            </View>
          }
        />

        {typingUsers.length > 0 ? (
          <View style={styles.typingContainer}>
            <View style={styles.typingDot} />
            <Text style={styles.typingText}>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </Text>
          </View>
        ) : null}

        {/* Quick Vector Reactions Bar */}
        <View style={styles.reactionsRow}>
          {CHAT_REACTIONS.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                sendReaction(r.id);
                void hapticLight();
              }}
              style={({ pressed }) => [styles.reactionChip, pressed && styles.pressed]}
              hitSlop={6}
              accessibilityLabel={`React with ${r.id}`}
            >
              {r.icon}
            </Pressable>
          ))}
        </View>

        {/* Chat Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={(t) => {
              setInput(t);
              setTyping(t.length > 0);
            }}
            placeholder="Say something or tap @member to mention…"
            placeholderTextColor={colors.text3}
            onSubmitEditing={submit}
            returnKeyType="send"
          />

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              !input.trim() && styles.sendBtnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={submit}
            disabled={!input.trim()}
          >
            {input.trim() ? (
              <LinearGradient
                colors={['#ffb03a', '#ff9f1c']}
                style={styles.sendGradient}
              >
                <Send size={16} color="#08080a" />
              </LinearGradient>
            ) : (
              <View style={styles.sendDisabledInner}>
                <Send size={16} color={colors.text3} />
              </View>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  // Bubble for current user
  bubbleRowMine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginVertical: 3,
  },
  bubbleMine: {
    maxWidth: '80%',
    backgroundColor: 'rgba(255, 159, 28, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 159, 28, 0.35)',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  textMine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: '#ffffff',
    lineHeight: 21,
  },
  timeMine: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10,
    color: colors.amber,
    opacity: 0.8,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  // Bubble for other users
  bubbleRowOther: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    gap: 10,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgSurface,
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.displayBold,
    fontSize: 14,
    color: '#08080a',
  },
  bubbleOther: {
    flex: 1,
    maxWidth: '82%',
    backgroundColor: 'rgba(22, 22, 34, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 18,
    borderTopLeftRadius: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
    flexWrap: 'wrap',
  },
  authorName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 13,
  },
  hostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 159, 28, 0.4)',
  },
  hostBadgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    color: colors.amber,
  },
  timestamp: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 10.5,
    color: colors.text3,
    marginLeft: 'auto',
  },
  textOther: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 15,
    color: colors.text1,
    lineHeight: 21,
  },
  // Empty State
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 1.5,
    paddingHorizontal: spacing.lg,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyIcon: {
    fontSize: 26,
    opacity: 0.5,
  },
  emptyTitle: {
    fontFamily: fontFamily.displayBold,
    fontSize: 17,
    color: colors.text1,
  },
  emptySub: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 13,
    color: colors.text3,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  // Typing
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingBottom: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.amber,
  },
  typingText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: 8,
  },
  reactionChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(22, 22, 32, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    fontFamily: fontFamily.bodyRegular,
    color: colors.text1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabledInner: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIconActive: {
    color: '#08080a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sendIconDisabled: {
    color: colors.text3,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  systemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  systemPillHost: {
    backgroundColor: 'rgba(255, 159, 28, 0.08)',
    borderColor: 'rgba(255, 159, 28, 0.25)',
  },
  systemText: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 11,
    color: colors.text3,
  },
  systemTextHost: {
    fontFamily: fontFamily.bodyMedium,
    color: colors.amber,
  },
});
