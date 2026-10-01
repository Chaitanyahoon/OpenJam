/** Chat tab: messages, typing indicator, input, emoji reactions. */
import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { fontFamily } from '../fonts';
import { useRoom } from '../state/RoomContext';

const QUICK_EMOJI = ['❤️', '🔥', '👏', '😂', '🎶', '💯', '🙌', '😭'];

export function ChatPanel() {
  const { messages, typingUsers, sendChat, sendReaction, setTyping, me } = useRoom();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const submit = () => {
    if (!input.trim()) return;
    sendChat(input);
    setInput('');
    setTyping(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = me && item.user_id === me.id;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine && styles.bubbleMine]}>
                {!mine ? <Text style={styles.author}>{item.user_name}</Text> : null}
                <Text style={styles.text}>{item.content}</Text>
              </View>
            </View>
          );
        }}
      />

      {typingUsers.length > 0 ? (
        <Text style={styles.typing}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
        </Text>
      ) : null}

      <View style={styles.reactions}>
        {QUICK_EMOJI.map((e) => (
          <Pressable key={e} onPress={() => sendReaction(e)} style={styles.emojiBtn}>
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={(t) => {
            setInput(t);
            setTyping(t.length > 0);
          }}
          placeholder="Say something…"
          placeholderTextColor={colors.text3}
          onSubmitEditing={submit}
          returnKeyType="send"
        />
        <Pressable style={styles.sendBtn} onPress={submit}>
          <Text style={styles.sendText}>➤</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  bubbleMine: { backgroundColor: 'rgba(255,159,28,0.16)' },
  author: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 12,
    color: colors.amber,
    marginBottom: 2,
  },
  text: { fontFamily: fontFamily.bodyRegular, fontSize: 15, color: colors.text1 },
  typing: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: 12,
    color: colors.text3,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  reactions: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    gap: 4,
    justifyContent: 'space-between',
  },
  emojiBtn: { padding: 6 },
  emoji: { fontSize: 24 },
  inputRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderAmber,
    borderRadius: radius.full,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontFamily: fontFamily.bodyRegular,
    color: colors.text1,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#08080a', fontSize: 18 },
});
