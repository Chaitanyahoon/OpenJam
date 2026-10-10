import { useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { C2S, type ReactionEvent } from '../sync/protocol';

export interface FlyingReaction extends ReactionEvent {
  key: string;
}

export function appendFlyingReaction<T extends { key: string; emoji: string }>(
  currentReactions: T[],
  newReaction: T,
  maxCapacity = 20,
): T[] {
  return [...currentReactions.slice(-(maxCapacity - 1)), newReaction];
}

export interface UseRoomReactionsOptions {
  roomId: string;
  socketRef: React.MutableRefObject<Socket | null>;
}

export interface RoomReactionsApi {
  reactions: FlyingReaction[];
  sendReaction: (emoji: string) => void;
  dismissReaction: (key: string) => void;
  handleIncomingReaction: (r: ReactionEvent) => void;
  clearReactions: () => void;
}

/**
 * useRoomReactions — Encapsulates flying emoji reactions, network broadcast,
 * and capacity pruning for collaborative jam rooms.
 */
export function useRoomReactions({ roomId, socketRef }: UseRoomReactionsOptions): RoomReactionsApi {
  const [reactions, setReactions] = useState<FlyingReaction[]>([]);

  const sendReaction = useCallback(
    (emoji: string) => {
      socketRef.current?.emit(C2S.SEND_REACTION, { room_id: roomId, emoji });
      // Display local reaction instantly
      const key = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setReactions((prev) =>
        appendFlyingReaction(prev, { key, emoji, user_id: 'me', user_name: 'You' }),
      );
    },
    [roomId, socketRef],
  );

  const dismissReaction = useCallback((key: string) => {
    setReactions((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const handleIncomingReaction = useCallback((r: ReactionEvent) => {
    if (!r?.emoji) return;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setReactions((prev) => appendFlyingReaction(prev, { ...r, key }));
  }, []);

  const clearReactions = useCallback(() => {
    setReactions([]);
  }, []);

  return {
    reactions,
    sendReaction,
    dismissReaction,
    handleIncomingReaction,
    clearReactions,
  };
}
