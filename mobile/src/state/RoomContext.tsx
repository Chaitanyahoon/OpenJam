/**
 * Room state machine — the heart of the mobile app.
 * Ports frontend-next/app/room/[id]/RoomClient.js socket logic:
 * join/rejoin, NTP sync application, queue, chat, reactions, presence.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { useSocket } from './SocketContext';
import { usePlayer } from '../audio/PlayerContext';
import { SyncEngine } from '../sync/engine';
import { streamUrl, getStoredSession, type ApiUser } from '../api';
import {
  C2S,
  S2C,
  type ChatMessage,
  type JoinSuccessPayload,
  type ListenerInfo,
  type PlaybackSyncPayload,
  type QueueItem,
  type ReactionEvent,
  type SyncPongPayload,
  type TrackInfo,
} from '../sync/protocol';

const PING_INTERVAL_MS = 30_000;
const DRIFT_CORRECT_MS = 1500;

export interface FlyingReaction extends ReactionEvent {
  key: string;
}

interface RoomApi {
  roomId: string;
  roomName: string;
  isHost: boolean;
  canControl: boolean;
  queue: QueueItem[];
  nowPlaying: TrackInfo | null;
  isPlaying: boolean;
  loop: boolean;
  listeners: ListenerInfo[];
  messages: ChatMessage[];
  unreadChat: number;
  typingUsers: string[];
  reactions: FlyingReaction[];
  skipVotes: { votes: number; required: number };
  syncReady: boolean;
  joinError: string | null;
  roomClosed: boolean;
  me: ApiUser | null;
  // actions
  sendChat: (content: string) => void;
  sendReaction: (emoji: string) => void;
  dismissReaction: (key: string) => void;
  addTrack: (track: TrackInfo) => void;
  voteTrack: (queueItemId: string) => void;
  voteSkip: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleRepeat: () => void;
  shuffleQueue: () => void;
  seekToMs: (ms: number) => void;
  removeTrack: (queueItemId: string) => void;
  setTyping: (typing: boolean) => void;
  clearUnreadChat: () => void;
  setChatFocused: (focused: boolean) => void;
}

const Ctx = createContext<RoomApi | null>(null);

export function RoomProvider({
  roomId,
  password,
  children,
}: {
  roomId: string;
  password?: string;
  children: React.ReactNode;
}) {
  const { socket, connect } = useSocket();
  const player = usePlayer();

  const [roomName, setRoomName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [reactions, setReactions] = useState<FlyingReaction[]>([]);
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 0 });
  const [guestControls, setGuestControls] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomClosed, setRoomClosed] = useState(false);
  const [me, setMe] = useState<ApiUser | null>(null);

  const engineRef = useRef(new SyncEngine());
  const trackUriRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const isHostRef = useRef(false);
  const meRef = useRef<ApiUser | null>(null);
  const chatFocusedRef = useRef(false);
  const seenMsgIds = useRef(new Set<string>());
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const playerRef = useRef(player);
  playerRef.current = player;

  useEffect(() => {
    getStoredSession().then((s) => {
      meRef.current = s.user;
      setMe(s.user);
    });
  }, []);

  const ping = useCallback(() => {
    const s = socketRef.current;
    if (s?.connected && AppState.currentState === 'active') {
      s.emit(C2S.SYNC_PING, { t0: Date.now() });
    }
  }, []);

  /** Apply a playback_sync payload to the local player. */
  const applyPlaybackSync = useCallback(async (data: PlaybackSyncPayload) => {
    const p = playerRef.current;
    const engine = engineRef.current;
    const target = engine.targetPositionMs(data, isHostRef.current);
    const shouldPlay = !!data.is_playing && !data.is_buffering;

    const newNowPlaying: TrackInfo | null = data.track_uri
      ? {
          track_uri: data.track_uri,
          track_name: data.track_name ?? 'Unknown track',
          artist: data.artist ?? 'Unknown artist',
          album_art_url: data.album_art_url,
          duration_ms: data.duration_ms,
        }
      : null;

    if (data.track_uri && data.track_uri !== trackUriRef.current) {
      trackUriRef.current = data.track_uri;
      setNowPlaying(newNowPlaying);
      p.loadTrack(streamUrl(data.track_uri), {
        title: newNowPlaying?.track_name ?? 'OpenJam',
        artist: newNowPlaying?.artist,
        artworkUrl: newNowPlaying?.album_art_url,
      });
      await p.seekToMs(target);
      if (shouldPlay) p.play();
      else p.pause();
      playingRef.current = shouldPlay;
    } else {
      const drift = Math.abs(p.positionMs() - target);
      if (shouldPlay !== playingRef.current) {
        if (shouldPlay) p.play();
        else p.pause();
        playingRef.current = shouldPlay;
      } else if (drift > DRIFT_CORRECT_MS) {
        await p.seekToMs(target);
      }
    }
    setIsPlaying(shouldPlay);
    if (typeof data.loop === 'boolean' && data.loop !== loopRef.current) {
      loopRef.current = data.loop;
      setLoop(data.loop);
    }
  }, []);

  const doJoin = useCallback(() => {
    const s = socketRef.current;
    if (!s) return;
    engineRef.current.reset();
    setSyncReady(false);
    s.emit(C2S.JOIN_ROOM, {
      room_id: roomId,
      password: password || '',
      avatar_url: meRef.current?.avatar_url || null,
    });
    // kick off offset measurement immediately
    s.emit(C2S.SYNC_PING, { t0: Date.now() });
  }, [roomId, password]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = (await connect()) ?? socketRef.current;
      if (!mounted || !s) {
        setJoinError('Could not connect. Check your connection and retry.');
        return;
      }

      const onConnect = () => {
        // Every (re)connect: fresh offset, rejoin, then ask for live state.
        doJoin();
        const sc = socketRef.current;
        sc?.emit('sync_request', {});
      };
      const onPong = (data: SyncPongPayload) => {
        if (engineRef.current.measure(data) !== null && engineRef.current.reliable) {
          setSyncReady(true);
        }
      };
      const onJoinSuccess = (data: JoinSuccessPayload) => {
        setRoomName(data.room?.name ?? '');
        const hostId = data.room?.host_user_id;
        const mine = !!hostId && !!meRef.current && hostId === meRef.current.id;
        isHostRef.current = mine;
        setIsHost(mine);
        setQueue(data.queue ?? []);
        setListeners(data.listeners ?? []);
        if (data.now_playing) {
          trackUriRef.current = data.now_playing.track_uri;
          setNowPlaying(data.now_playing);
        }
        if (data.playback) {
          void applyPlaybackSync({
            position_ms: data.playback.position_ms,
            is_playing: data.playback.is_playing,
            server_timestamp: data.playback.server_timestamp,
            ...(data.now_playing ?? {}),
          });
        }
      };
      const onJoinError = (data: { message?: string }) => {
        setJoinError(data?.message || 'Could not join room');
      };
      const onPlaybackSync = (data: PlaybackSyncPayload) => {
        void applyPlaybackSync(data);
      };
      const onTrackChanged = (data: TrackInfo) => {
        // playback_sync follows right behind; preload metadata early
        if (data?.track_uri) {
          playerRef.current.updateMeta({
            title: data.track_name,
            artist: data.artist,
            artworkUrl: data.album_art_url,
          });
        }
      };
      const onQueueUpdated = (data: { queue?: QueueItem[] }) =>
        setQueue(data?.queue ?? []);
      const onListenerCount = (data: { listeners?: ListenerInfo[]; count?: number }) =>
        setListeners(data?.listeners ?? []);
      const onHostChanged = (data: { host_user_id?: string }) => {
        const mine =
          !!data?.host_user_id && !!meRef.current && data.host_user_id === meRef.current.id;
        isHostRef.current = mine;
        setIsHost(mine);
      };
      const onChatHistory = (data: { messages?: ChatMessage[] }) => {
        const msgs = data?.messages ?? [];
        msgs.forEach((m) => seenMsgIds.current.add(m.id));
        setMessages(msgs.slice(-200));
      };
      const onChatMessage = (m: ChatMessage) => {
        if (!m || seenMsgIds.current.has(m.id)) return;
        seenMsgIds.current.add(m.id);
        setMessages((prev) => [...prev.slice(-199), m]);
        // unread badge: only when the chat tab isn't in front and it isn't ours
        if (!chatFocusedRef.current && m.user_id !== meRef.current?.id) {
          setUnreadChat((n) => n + 1);
        }
      };
      const onChatAck = (ack: { id: string; temp_id?: string }) => {
        if (!ack?.temp_id) return;
        seenMsgIds.current.add(ack.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === ack.temp_id ? { ...m, id: ack.id } : m)),
        );
      };
      const onReaction = (r: ReactionEvent) => {
        if (!r?.emoji) return;
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setReactions((prev) => [...prev.slice(-19), { ...r, key }]);
      };
      const onTyping = (d: { user_name?: string; user_id?: string }) => {
        const name = d?.user_name;
        if (!name || (meRef.current && name === meRef.current.display_name)) return;
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      };
      const onStopTyping = (d: { user_name?: string }) => {
        if (!d?.user_name) return;
        setTypingUsers((prev) => prev.filter((n) => n !== d.user_name));
      };
      const onSkipVotes = (d: { votes?: number; required?: number }) =>
        setSkipVotes({ votes: d?.votes ?? 0, required: d?.required ?? 0 });
      const onGuestControls = (d: { enabled?: boolean } | boolean) =>
        setGuestControls(typeof d === 'boolean' ? d : !!d?.enabled);
      const onRoomClosed = () => setRoomClosed(true);

      s.on(S2C.CONNECT, onConnect);
      s.on(S2C.SYNC_PONG, onPong);
      s.on(S2C.JOIN_SUCCESS, onJoinSuccess);
      s.on(S2C.JOIN_ERROR, onJoinError);
      s.on(S2C.PLAYBACK_SYNC, onPlaybackSync);
      s.on(S2C.TRACK_CHANGED, onTrackChanged);
      s.on(S2C.QUEUE_UPDATED, onQueueUpdated);
      s.on(S2C.LISTENER_COUNT, onListenerCount);
      s.on(S2C.HOST_CHANGED, onHostChanged);
      s.on(S2C.CHAT_HISTORY, onChatHistory);
      s.on(S2C.CHAT_MESSAGE, onChatMessage);
      s.on('chat_ack', onChatAck);
      s.on(S2C.REACTION, onReaction);
      s.on(S2C.TYPING, onTyping);
      s.on(S2C.STOP_TYPING, onStopTyping);
      s.on(S2C.SKIP_VOTES_UPDATED, onSkipVotes);
      s.on(S2C.GUEST_CONTROLS_UPDATED, onGuestControls);
      s.on(S2C.ROOM_CLOSED, onRoomClosed);

      if (s.connected) onConnect();
      const pingTimer = setInterval(ping, PING_INTERVAL_MS);

      return () => {};
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // leave on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.emit(C2S.LEAVE_ROOM, { room_id: roomId });
    };
  }, [roomId]);

  const emitPlaybackUpdate = useCallback(
    (isPlaying: boolean) => {
      socketRef.current?.emit(C2S.PLAYBACK_UPDATE, {
        room_id: roomId,
        position_ms: Math.round(playerRef.current.positionMs()),
        is_playing: isPlaying,
      });
    },
    [roomId],
  );

  const sendChat = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || !socketRef.current) return;
      const tempId = `temp_${Math.random().toString(36).slice(2, 10)}`;
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
    [roomId],
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      socketRef.current?.emit(C2S.SEND_REACTION, { room_id: roomId, emoji });
      // show our own reaction instantly too
      const key = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setReactions((prev) => [
        ...prev.slice(-19),
        { key, emoji, user_id: 'me', user_name: 'You' },
      ]);
    },
    [roomId],
  );

  const dismissReaction = useCallback((key: string) => {
    setReactions((prev) => prev.filter((r) => r.key !== key));
  }, []);

  const addTrack = useCallback(
    (track: TrackInfo) => {
      socketRef.current?.emit(C2S.ADD_TO_QUEUE, {
        room_id: roomId,
        track_uri: track.track_uri,
        track_name: track.track_name,
        artist: track.artist,
        album_art_url: track.album_art_url,
        duration_ms: track.duration_ms,
      });
    },
    [roomId],
  );

  const voteTrack = useCallback(
    (queueItemId: string) => {
      socketRef.current?.emit(C2S.VOTE_TRACK, { room_id: roomId, queue_item_id: queueItemId });
    },
    [roomId],
  );

  const voteSkip = useCallback(() => {
    socketRef.current?.emit(C2S.VOTE_SKIP, { room_id: roomId });
  }, [roomId]);

  const canControl = isHost || guestControls;

  const togglePlay = useCallback(() => {
    if (!canControl) return;
    const p = playerRef.current;
    const next = !playingRef.current;
    if (next) p.play();
    else p.pause();
    playingRef.current = next;
    setIsPlaying(next);
    emitPlaybackUpdate(next);
  }, [canControl, emitPlaybackUpdate]);

  const nextTrack = useCallback(() => {
    if (!canControl) return;
    socketRef.current?.emit(C2S.NEXT_TRACK, { room_id: roomId });
  }, [canControl, roomId]);

  const previousTrack = useCallback(() => {
    if (!canControl) return;
    socketRef.current?.emit(C2S.PREVIOUS_TRACK, { room_id: roomId });
  }, [canControl, roomId]);

  const toggleRepeat = useCallback(() => {
    if (!canControl) return;
    const next = !loopRef.current;
    socketRef.current?.emit(C2S.TOGGLE_REPEAT, { room_id: roomId, loop: next });
    // server echoes back via playback_sync -> loop; optimistic flip for snappiness
    loopRef.current = next;
    setLoop(next);
  }, [canControl, roomId]);

  const shuffleQueue = useCallback(() => {
    if (!isHostRef.current) return;
    socketRef.current?.emit(C2S.SHUFFLE_QUEUE, { room_id: roomId });
  }, [roomId]);

  const clearUnreadChat = useCallback(() => setUnreadChat(0), []);
  const setChatFocused = useCallback((focused: boolean) => {
    chatFocusedRef.current = focused;
    if (focused) setUnreadChat(0);
  }, []);

  const seekToMs = useCallback(
    (ms: number) => {
      if (!canControl) return;
      void playerRef.current.seekToMs(ms).then(() => emitPlaybackUpdate(true));
    },
    [canControl, emitPlaybackUpdate],
  );

  const removeTrack = useCallback(
    (queueItemId: string) => {
      if (!isHost) return;
      socketRef.current?.emit(C2S.REMOVE_FROM_QUEUE, {
        room_id: roomId,
        queue_item_id: queueItemId,
      });
    },
    [isHost, roomId],
  );

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    [roomId],
  );

  const value = useMemo<RoomApi>(
    () => ({
      roomId,
      roomName,
      isHost,
      canControl,
      queue,
      nowPlaying,
      isPlaying,
      loop,
      listeners,
      messages,
      unreadChat,
      typingUsers,
      reactions,
      skipVotes,
      syncReady,
      joinError,
      roomClosed,
      me,
      sendChat,
      sendReaction,
      dismissReaction,
      addTrack,
      voteTrack,
      voteSkip,
      togglePlay,
      nextTrack,
      previousTrack,
      toggleRepeat,
      shuffleQueue,
      seekToMs,
      removeTrack,
      setTyping,
      clearUnreadChat,
      setChatFocused,
    }),
    [
      roomId, roomName, isHost, canControl, queue, nowPlaying, isPlaying,
      loop, listeners, messages, unreadChat, typingUsers, reactions, skipVotes, syncReady,
      joinError, roomClosed, me, sendChat, sendReaction, dismissReaction,
      addTrack, voteTrack, voteSkip, togglePlay, nextTrack, previousTrack,
      toggleRepeat, shuffleQueue, seekToMs, removeTrack, setTyping,
      clearUnreadChat, setChatFocused,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoom(): RoomApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
