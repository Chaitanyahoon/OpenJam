import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { ApiUser } from '../api';
import { C2S, type ChatMessage } from '../sync/protocol';

export function reconcileIncomingChatMessage(
  currentList: ChatMessage[],
  incoming: ChatMessage,
  seenIds: Set<string>,
  myUserId?: string,
  myUserName?: string,
): ChatMessage[] {
  if (seenIds.has(incoming.id)) return currentList;
  seenIds.add(incoming.id);

  // 1. Direct deterministic match if server returned temp_id
  if (incoming.temp_id) {
    const tempIdx = currentList.findIndex((m) => m.id === incoming.temp_id);
    if (tempIdx !== -1) {
      const next = [...currentList];
      next[tempIdx] = incoming;
      return next;
    }
  }

  // 2. Check if this message is from current user and matches a pending optimistic message
  const isFromMe =
    Boolean(myUserId && incoming.user_id === myUserId) ||
    Boolean(myUserName && incoming.user_name === myUserName) ||
    incoming.user_id === 'me';

  if (isFromMe) {
    const optIndex = currentList.findIndex(
      (m) =>
        m.id.startsWith('temp_') &&
        (m.user_id === incoming.user_id || m.user_id === 'me' || (myUserName && m.user_name === myUserName)) &&
        m.content.trim() === incoming.content.trim(),
    );
    if (optIndex !== -1) {
      const next = [...currentList];
      next[optIndex] = incoming;
      return next;
    }
  }

  // Prevent duplicate if already in state
  if (currentList.some((m) => m.id === incoming.id)) {
    return currentList;
  }

  return [...currentList.slice(-199), incoming];
}

export function updateTypingUsersList(
  currentTyping: string[],
  incomingUserName: string | undefined,
  myUserName?: string,
  isTyping = true,
): string[] {
  if (!incomingUserName || (myUserName && incomingUserName === myUserName)) {
    return currentTyping;
  }
  if (isTyping) {
    return currentTyping.includes(incomingUserName)
      ? currentTyping
      : [...currentTyping, incomingUserName];
  } else {
    return currentTyping.filter((u) => u !== incomingUserName);
  }
}

export function reconcileChatAck(
  currentList: ChatMessage[],
  ack: { id: string; temp_id?: string },
  seenIds: Set<string>,
): ChatMessage[] {
  if (!ack?.temp_id) return currentList;
  seenIds.add(ack.id);
  const alreadyHasServerMsg = currentList.some((m) => m.id === ack.id);
  if (alreadyHasServerMsg) {
    return currentList.filter((m) => m.id !== ack.temp_id);
  }
  return currentList.map((m) => (m.id === ack.temp_id ? { ...m, id: ack.id } : m));
}

export interface UseRoomChatOptions {
  roomId: string;
  socketRef: React.MutableRefObject<Socket | null>;
  meRef: React.MutableRefObject<ApiUser | null>;
}

export interface RoomChatApi {
  messages: ChatMessage[];
  unreadChat: number;
  typingUsers: string[];
  sendChat: (content: string) => void;
  setTyping: (typing: boolean) => void;
  clearUnreadChat: () => void;
  setChatFocused: (focused: boolean) => void;
  handleChatHistory: (data: { messages?: ChatMessage[] }) => void;
  handleChatMessage: (m: ChatMessage) => void;
  handleChatAck: (ack: { id: string; temp_id?: string }) => void;
  handleTyping: (d: { user_name?: string; user_id?: string }) => void;
  handleStopTyping: (d: { user_name?: string }) => void;
  addSystemMessage: (content: string, system_type: 'join' | 'leave' | 'host') => void;
  clearChat: () => void;
}

/**
 * useRoomChat — Encapsulates live chat, optimistic reconciliation, unread badge counters,
 * typing indicators, and system broadcast events.
 */
export function useRoomChat({ roomId, socketRef, meRef }: UseRoomChatOptions): RoomChatApi {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const seenMsgIds = useRef(new Set<string>());
  const chatFocusedRef = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
        typingTimer.current = null;
      }
    };
  }, []);

  const clearUnreadChat = useCallback(() => {
    setUnreadChat(0);
  }, []);

  const setChatFocused = useCallback((focused: boolean) => {
    chatFocusedRef.current = focused;
    if (focused) {
      setUnreadChat(0);
    }
  }, []);

  const handleChatHistory = useCallback((data: { messages?: ChatMessage[] }) => {
    const msgs = data?.messages ?? [];
    msgs.forEach((m) => seenMsgIds.current.add(m.id));
    setMessages(msgs.slice(-200));
  }, []);

  const handleChatMessage = useCallback(
    (m: ChatMessage) => {
      if (!m || seenMsgIds.current.has(m.id)) return;
      setMessages((prev) =>
        reconcileIncomingChatMessage(
          prev,
          m,
          seenMsgIds.current,
          meRef.current?.id,
          meRef.current?.display_name,
        ),
      );
      if (!chatFocusedRef.current && m.user_id !== meRef.current?.id) {
        setUnreadChat((n) => n + 1);
      }
    },
    [meRef],
  );

  const handleChatAck = useCallback((ack: { id: string; temp_id?: string }) => {
    if (!ack?.temp_id) return;
    setMessages((prev) => reconcileChatAck(prev, ack, seenMsgIds.current));
  }, []);

  const handleTyping = useCallback(
    (d: { user_name?: string; user_id?: string }) => {
      const name = d?.user_name;
      setTypingUsers((prev) =>
        updateTypingUsersList(prev, name, meRef.current?.display_name, true),
      );
    },
    [meRef],
  );

  const handleStopTyping = useCallback(
    (d: { user_name?: string }) => {
      const name = d?.user_name;
      setTypingUsers((prev) =>
        updateTypingUsersList(prev, name, meRef.current?.display_name, false),
      );
    },
    [meRef],
  );

  const addSystemMessage = useCallback(
    (content: string, system_type: 'join' | 'leave' | 'host') => {
      const sysMsg: ChatMessage = {
        id: `sys-${system_type[0]}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        user_id: 'system',
        user_name: 'OpenJam',
        content,
        timestamp: Date.now(),
        is_system: true,
        system_type,
      };
      setMessages((prev) => [...prev.slice(-199), sysMsg]);
    },
    [],
  );

  const sendChat = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || !socketRef.current) return;
      const tempId = `temp_${Math.random().toString(36).slice(2, 10)}`;
      seenMsgIds.current.add(tempId);
      const optimistic: ChatMessage = {
        id: tempId,
        user_id: meRef.current?.id ?? 'me',
        user_name: meRef.current?.display_name ?? 'You',
        content: text,
        timestamp: Date.now(),
        avatar_url: meRef.current?.avatar_url ?? null,
      };
      setMessages((prev) => [...prev.slice(-199), optimistic]);
      socketRef.current.emit(C2S.SEND_CHAT, {
        room_id: roomId,
        message: text,
        temp_id: tempId,
      });
    },
    [roomId, socketRef, meRef],
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      const s = socketRef.current;
      if (!s) return;
      if (typing) {
        s.emit(C2S.TYPING, { room_id: roomId });
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(
          () => s.emit(C2S.STOP_TYPING, { room_id: roomId }),
          3000,
        );
      } else {
        if (typingTimer.current) clearTimeout(typingTimer.current);
        s.emit(C2S.STOP_TYPING, { room_id: roomId });
      }
    },
    [roomId, socketRef],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setUnreadChat(0);
    setTypingUsers([]);
    seenMsgIds.current.clear();
  }, []);

  return {
    messages,
    unreadChat,
    typingUsers,
    sendChat,
    setTyping,
    clearUnreadChat,
    setChatFocused,
    handleChatHistory,
    handleChatMessage,
    handleChatAck,
    handleTyping,
    handleStopTyping,
    addSystemMessage,
    clearChat,
  };
}
