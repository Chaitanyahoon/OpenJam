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
import { router } from 'expo-router';
import { useSocket } from './SocketContext';
import { usePlayer } from '../audio/PlayerContext';
import { SyncEngine } from '../sync/engine';
import { streamUrl, getStoredSession, deleteRoom, updateRoom, type ApiUser } from '../api';
import { recordTrackPlayed, consumePendingSoloQueue } from '../storage/history';
import {
  updateMediaNotification,
  dismissMediaNotification,
  registerMediaActionListener,
} from '../notifications';
import { useToast } from '../components/ToastContext';
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
import { useRoomChat } from './useRoomChat';
import { useRoomReactions, type FlyingReaction } from './useRoomReactions';

export type { FlyingReaction };

const PING_INTERVAL_MS = 30_000;
const DRIFT_CORRECT_MS = 2500;

export type RoomConnectionState = 'joining' | 'connected' | 'reconnecting' | 'offline';

export interface RoomApi {
  roomId: string;
  isSolo: boolean;
  roomName: string;
  isHost: boolean;
  canControl: boolean;
  connectionState: RoomConnectionState;
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
  guestControls: boolean;
  syncReady: boolean;
  joinError: string | null;
  roomClosed: boolean;
  me: ApiUser | null;
  // actions
  retryJoin: () => void;
  toggleGuestControls: () => void;
  sendChat: (content: string) => void;
  sendReaction: (emoji: string) => void;
  dismissReaction: (key: string) => void;
  addTrack: (track: TrackInfo) => void;
  addMultipleTracks: (tracks: TrackInfo[]) => void;
  playNow: (track: TrackInfo) => void;
  voteTrack: (queueItemId: string) => void;
  voteSkip: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  toggleRepeat: () => void;
  shuffleQueue: () => void;
  seekToMs: (ms: number) => void;
  removeTrack: (queueItemId: string) => void;
  reorderQueue: (orderedIds: string[]) => void;
  transferHost: (targetUserId: string) => void;
  kickUser: (targetUserId: string) => void;
  setTyping: (typing: boolean) => void;
  clearUnreadChat: () => void;
  setChatFocused: (focused: boolean) => void;
  closeRoom: () => Promise<void>;
  updateRoomDetails: (data: { name?: string; genre_tags?: string[] }) => Promise<void>;
}

function normalizeQueueList(items?: any[]): QueueItem[] {
  return (items ?? []).map((i) => ({
    ...i,
    queue_item_id: i.queue_item_id || i.id || '',
    added_by: i.added_by || i.added_by_name || 'Jammer',
  }));
}

function normalizeListeners(raw?: any[], hostId?: string | null): ListenerInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => ({
    user_id: String(l.user_id || ''),
    user_name: String(l.user_name || l.display_name || 'Jammer'),
    avatar_url: l.avatar_url || null,
    is_host: Boolean(l.is_host || (hostId && l.user_id === hostId)),
  }));
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
  const toast = useToast();

  const isSolo = roomId === 'solo' || roomId.startsWith('solo');

  const [roomName, setRoomName] = useState(isSolo ? 'Solo Jam' : '');
  const [isHost, setIsHost] = useState(isSolo);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [listeners, setListeners] = useState<ListenerInfo[]>(
    isSolo
      ? [{ user_id: 'solo_user', user_name: 'You', is_host: true, avatar_url: null }]
      : [],
  );
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 0 });
  const [guestControls, setGuestControls] = useState(isSolo);
  const [syncReady, setSyncReady] = useState(isSolo);
  const [connectionState, setConnectionState] = useState<RoomConnectionState>(
    isSolo ? 'connected' : 'joining',
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [roomClosed, setRoomClosed] = useState(false);
  const [me, setMe] = useState<ApiUser | null>(null);
  const canControl = isHost || guestControls || isSolo;

  const engineRef = useRef(new SyncEngine());
  const trackUriRef = useRef<string | null>(null);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const isHostRef = useRef(isSolo);
  const hostIdRef = useRef<string | null>(null);
  const meRef = useRef<ApiUser | null>(null);
  const socketRef = useRef(socket);
  socketRef.current = socket;
  const playerRef = useRef(player);
  playerRef.current = player;
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSeqRef = useRef<number>(0);
  const lastServerTsRef = useRef<number>(0);

  const chat = useRoomChat({ roomId, socketRef, meRef });
  const reactionsCtrl = useRoomReactions({ roomId, socketRef });

  const resetJoinTimeout = useCallback(() => {
    if (joinTimeoutRef.current) {
      clearTimeout(joinTimeoutRef.current);
      joinTimeoutRef.current = null;
    }
  }, []);

  const startJoinTimeout = useCallback(() => {
    resetJoinTimeout();
    joinTimeoutRef.current = setTimeout(() => {
      setConnectionState((curr) => {
        if (curr !== 'connected') {
          setJoinError('Room connection timed out. Check your connection or retry.');
          return 'offline';
        }
        return curr;
      });
    }, 12_000);
  }, [resetJoinTimeout]);

  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    getStoredSession().then((s) => {
      tokenRef.current = s.token;
      meRef.current = s.user;
      setMe(s.user);
      if (hostIdRef.current && s.user?.id && hostIdRef.current === s.user.id) {
        isHostRef.current = true;
        setIsHost(true);
      }
    });
  }, []);

  const ping = useCallback(() => {
    const s = socketRef.current;
    if (s?.connected && AppState.currentState === 'active') {
      s.emit(C2S.SYNC_PING, { t0: Date.now() });
    }
  }, []);

  /** Apply a playback_sync payload to the local player. */
  const applyPlaybackSync = useCallback(
    async (data: PlaybackSyncPayload, forceReload = false) => {
      syncSeqRef.current += 1;
      if (
        data.server_timestamp &&
        lastServerTsRef.current &&
        data.server_timestamp < lastServerTsRef.current &&
        !forceReload
      ) {
        return;
      }
      if (data.server_timestamp) {
        lastServerTsRef.current = data.server_timestamp;
      }

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

      const isNewTrack =
        forceReload || (!!data.track_uri && data.track_uri !== trackUriRef.current);

      if (isNewTrack && data.track_uri) {
        trackUriRef.current = data.track_uri;
        setNowPlaying(newNowPlaying);
        if (newNowPlaying) {
          recordTrackPlayed(newNowPlaying, { id: roomId, name: roomName });
        }
        await p.loadTrack(data.track_uri, {
          title: newNowPlaying?.track_name ?? 'OpenJam',
          artist: newNowPlaying?.artist,
          artworkUrl: newNowPlaying?.album_art_url,
        });
        await p.seekToMs(target);
        if (shouldPlay) p.play();
        else p.pause();
        playingRef.current = shouldPlay;
      } else {
        const currentPos = p.positionMs();
        const evalResult = engineRef.current.evaluateDrift(currentPos, target);

        if (shouldPlay !== playingRef.current) {
          if (shouldPlay) p.play();
          else p.pause();
          playingRef.current = shouldPlay;
        } else if (evalResult.tier === 3 && !p.isSeekingRecently()) {
          await p.seekToMs(target);
        }
      }
      setIsPlaying(shouldPlay);
      if (typeof data.loop === 'boolean' && data.loop !== loopRef.current) {
        loopRef.current = data.loop;
        setLoop(data.loop);
      }
    },
    [roomId, roomName],
  );

  const doJoin = useCallback(async () => {
    if (isSolo) return;
    const s = socketRef.current;
    if (!s) return;
    engineRef.current.reset();
    setSyncReady(false);
    setConnectionState('joining');
    startJoinTimeout();

    const session = await getStoredSession();
    tokenRef.current = session.token;
    meRef.current = session.user;
    setMe(session.user);

    s.emit(C2S.JOIN_ROOM, {
      room_id: roomId,
      password: password || '',
      avatar_url: session.user?.avatar_url || null,
      token: session.token || undefined,
    });
    // kick off offset measurement immediately
    s.emit(C2S.SYNC_PING, { t0: Date.now() });
  }, [roomId, password, startJoinTimeout, isSolo]);

  const retryJoin = useCallback(() => {
    if (isSolo) return;
    setJoinError(null);
    setConnectionState('joining');
    void doJoin();
  }, [doJoin, isSolo]);

  useEffect(() => {
    if (isSolo) {
      setSyncReady(true);
      setConnectionState('connected');
      setIsHost(true);
      isHostRef.current = true;
      return;
    }
    let mounted = true;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let activeSocket: ReturnType<typeof useSocket>['socket'] = null;

    // Handler references — stored so we can .off() them on cleanup
    const onConnect = () => {
      void doJoin();
      socketRef.current?.emit('sync_request', {});
    };
    const onPong = (data: SyncPongPayload) => {
      if (engineRef.current.measure(data) !== null && engineRef.current.reliable) {
        setSyncReady(true);
      }
    };
    const onJoinSuccess = (data: JoinSuccessPayload) => {
      if (!mounted) return;
      resetJoinTimeout();
      setConnectionState('connected');
      setJoinError(null);
      setRoomName(data.room?.name ?? '');
      const hostId = data.host_user_id || data.room?.host_user_id || null;
      hostIdRef.current = hostId;
      const isHostUser =
        data.is_host === true ||
        Boolean(hostId && ((meRef.current?.id && hostId === meRef.current.id) || (me?.id && hostId === me.id)));
      isHostRef.current = isHostUser;
      setIsHost(isHostUser);
      if (typeof data.allow_guest_controls === 'boolean') {
        setGuestControls(data.allow_guest_controls);
      }
      setQueue(normalizeQueueList(data.queue));
      setListeners(normalizeListeners(data.listeners, hostId));
      if (data.now_playing) {
        setNowPlaying(data.now_playing);
      }
      if (data.playback) {
        const pos =
          typeof data.playback.position_ms === 'number'
            ? data.playback.position_ms
            : (typeof data.playback.positionMs === 'number' ? data.playback.positionMs : 0);
        const playing =
          typeof data.playback.is_playing === 'boolean'
            ? data.playback.is_playing
            : !!data.playback.isPlaying;
        void applyPlaybackSync(
          {
            position_ms: pos,
            is_playing: playing,
            server_timestamp: data.playback.server_timestamp,
            ...(data.now_playing ?? {}),
          },
          true,
        );
      }
    };
    const onJoinError = (data: { message?: string }) => {
      resetJoinTimeout();
      if (mounted) {
        setConnectionState('offline');
        setJoinError(data?.message || 'Could not join room');
      }
    };
    const onDisconnect = () => {
      if (!mounted) return;
      setConnectionState('reconnecting');
    };
    const onPlaybackSync = (data: PlaybackSyncPayload) => {
      void applyPlaybackSync(data);
    };
    const onTrackChanged = (data: TrackInfo | null) => {
      if (!mounted) return;
      if (data?.track_uri) {
        setNowPlaying(data);
        playerRef.current.updateMeta({
          title: data.track_name,
          artist: data.artist,
          artworkUrl: data.album_art_url,
        });
        recordTrackPlayed(data, { id: roomId, name: roomName });
        void applyPlaybackSync(
          {
            position_ms: 0,
            is_playing: true,
            track_uri: data.track_uri,
            track_name: data.track_name,
            artist: data.artist,
            album_art_url: data.album_art_url,
            duration_ms: data.duration_ms,
          },
          true,
        );
      } else {
        setNowPlaying(null);
        trackUriRef.current = null;
        setIsPlaying(false);
        playingRef.current = false;
        playerRef.current.pause();
      }
    };
    const onQueueUpdated = (data: { queue?: QueueItem[] }) =>
      mounted && setQueue(normalizeQueueList(data?.queue));
    const onListenerCount = (data: { listeners?: ListenerInfo[]; count?: number }) =>
      mounted && setListeners(normalizeListeners(data?.listeners, hostIdRef.current));
    const onUserJoined = (data: { user_id?: string; display_name?: string }) => {
      if (!mounted || !data?.display_name) return;
      chat.addSystemMessage(`${data.display_name} joined the room`, 'join');
    };
    const onUserLeft = (data: { user_id?: string; display_name?: string }) => {
      if (!mounted || !data?.display_name) return;
      chat.addSystemMessage(`${data.display_name} left the room`, 'leave');
    };
    const onHostChanged = (data: { host_user_id?: string; host_name?: string }) => {
      if (!mounted) return;
      if (data?.host_user_id) {
        hostIdRef.current = data.host_user_id;
      }
      const mine =
        !!data?.host_user_id &&
        Boolean((meRef.current && data.host_user_id === meRef.current.id) || (me && data.host_user_id === me.id));
      if (mine && !isHostRef.current) {
        toast('You are now the room host!', 'success');
      }
      isHostRef.current = mine;
      setIsHost(mine);
      setListeners((prev) => normalizeListeners(prev, data?.host_user_id || hostIdRef.current));
      chat.addSystemMessage(`${data?.host_name || 'A new DJ'} is now the room host`, 'host');
    };
    const onKicked = (data?: { message?: string }) => {
      if (!mounted) return;
      toast(data?.message || 'You were removed from the room by the host', 'error');
      router.replace('/');
    };
    const onChatHistory = (data: { messages?: ChatMessage[] }) => {
      if (!mounted) return;
      chat.handleChatHistory(data);
    };
    const onChatMessage = (m: ChatMessage) => {
      if (!mounted) return;
      chat.handleChatMessage(m);
    };
    const onChatAck = (ack: { id: string; temp_id?: string }) => {
      if (!mounted) return;
      chat.handleChatAck(ack);
    };
    const onReaction = (r: ReactionEvent) => {
      if (!mounted) return;
      reactionsCtrl.handleIncomingReaction(r);
    };
    const onTyping = (d: { user_name?: string; user_id?: string }) => {
      if (!mounted) return;
      chat.handleTyping(d);
    };
    const onStopTyping = (d: { user_name?: string }) => {
      if (!mounted) return;
      chat.handleStopTyping(d);
    };
    const onSkipVotes = (d: { votes?: number; required?: number }) => {
      if (mounted) setSkipVotes({ votes: d?.votes ?? 0, required: d?.required ?? 0 });
    };
    const onGuestControls = (d: { allow_guest_controls?: boolean; enabled?: boolean } | boolean) => {
      const enabled =
        typeof d === 'boolean'
          ? d
          : d?.allow_guest_controls !== undefined
            ? !!d.allow_guest_controls
            : !!d?.enabled;
      if (mounted) {
        setGuestControls(enabled);
        toast(enabled ? 'Guest playback controls enabled' : 'Guest playback controls disabled', 'info');
      }
    };
    const onRoomUpdated = (data: { name?: string; genre_tags?: string[]; allow_guest_controls?: boolean }) => {
      if (!mounted || !data) return;
      if (data.name) setRoomName(data.name);
      if (data.allow_guest_controls !== undefined) setGuestControls(!!data.allow_guest_controls);
      toast('Room details updated', 'info');
    };
    const onQueueError = (data: { message?: string }) => {
      if (mounted) toast(data?.message || 'Queue error', 'error');
    };
    const onRoomClosed = () => {
      if (mounted) setRoomClosed(true);
    };

    (async () => {
      const s = (await connect()) ?? socketRef.current;
      if (!mounted || !s) {
        if (mounted) setJoinError('Could not connect. Check your connection and retry.');
        return;
      }
      activeSocket = s;

      s.on(S2C.CONNECT, onConnect);
      s.on(S2C.DISCONNECT, onDisconnect);
      s.on(S2C.SYNC_PONG, onPong);
      s.on(S2C.JOIN_SUCCESS, onJoinSuccess);
      s.on(S2C.JOIN_ERROR, onJoinError);
      s.on(S2C.PLAYBACK_SYNC, onPlaybackSync);
      s.on(S2C.TRACK_CHANGED, onTrackChanged);
      s.on(S2C.QUEUE_UPDATED, onQueueUpdated);
      s.on(S2C.QUEUE_ERROR, onQueueError);
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
      s.on(S2C.ROOM_UPDATED, onRoomUpdated);
      s.on(S2C.ROOM_CLOSED, onRoomClosed);
      s.on(S2C.USER_JOINED, onUserJoined);
      s.on(S2C.USER_LEFT, onUserLeft);
      s.on(S2C.KICKED_FROM_ROOM, onKicked);

      if (s.connected) onConnect();
      pingTimer = setInterval(ping, PING_INTERVAL_MS);
    })();

    return () => {
      mounted = false;
      resetJoinTimeout();
      if (pingTimer) clearInterval(pingTimer);
      if (activeSocket) {
        activeSocket.off(S2C.CONNECT, onConnect);
        activeSocket.off(S2C.DISCONNECT, onDisconnect);
        activeSocket.off(S2C.SYNC_PONG, onPong);
        activeSocket.off(S2C.JOIN_SUCCESS, onJoinSuccess);
        activeSocket.off(S2C.JOIN_ERROR, onJoinError);
        activeSocket.off(S2C.PLAYBACK_SYNC, onPlaybackSync);
        activeSocket.off(S2C.TRACK_CHANGED, onTrackChanged);
        activeSocket.off(S2C.QUEUE_UPDATED, onQueueUpdated);
        activeSocket.off(S2C.QUEUE_ERROR, onQueueError);
        activeSocket.off(S2C.LISTENER_COUNT, onListenerCount);
        activeSocket.off(S2C.HOST_CHANGED, onHostChanged);
        activeSocket.off(S2C.CHAT_HISTORY, onChatHistory);
        activeSocket.off(S2C.CHAT_MESSAGE, onChatMessage);
        activeSocket.off('chat_ack', onChatAck);
        activeSocket.off(S2C.REACTION, onReaction);
        activeSocket.off(S2C.TYPING, onTyping);
        activeSocket.off(S2C.STOP_TYPING, onStopTyping);
        activeSocket.off(S2C.SKIP_VOTES_UPDATED, onSkipVotes);
        activeSocket.off(S2C.GUEST_CONTROLS_UPDATED, onGuestControls);
        activeSocket.off(S2C.ROOM_UPDATED, onRoomUpdated);
        activeSocket.off(S2C.ROOM_CLOSED, onRoomClosed);
        activeSocket.off(S2C.USER_JOINED, onUserJoined);
        activeSocket.off(S2C.USER_LEFT, onUserLeft);
        activeSocket.off(S2C.KICKED_FROM_ROOM, onKicked);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // leave on unmount
  useEffect(() => {
    return () => {
      if (!isSolo) {
        socketRef.current?.emit(C2S.LEAVE_ROOM, { room_id: roomId });
      }
    };
  }, [roomId, isSolo]);

  // Solo Mode: automatically advance queue on track completion
  useEffect(() => {
    if (!isSolo) return;
    player.setOnTrackEnded(() => {
      if (loopRef.current) {
        void playerRef.current.seekToMs(0);
        playerRef.current.play();
        return;
      }
      setQueue((prevQueue) => {
        if (prevQueue.length > 0) {
          const [next, ...rest] = prevQueue;
          const nextTrackInfo: TrackInfo = {
            track_uri: next.track_uri,
            track_name: next.track_name,
            artist: next.artist,
            album_art_url: next.album_art_url,
            duration_ms: next.duration_ms,
          };
          setNowPlaying(nextTrackInfo);
          trackUriRef.current = next.track_uri;
          setIsPlaying(true);
          playingRef.current = true;
          recordTrackPlayed(nextTrackInfo, { id: 'solo', name: 'Solo Jam' });
          void playerRef.current
            .loadTrack(next.track_uri, {
              title: next.track_name,
              artist: next.artist,
              artworkUrl: next.album_art_url,
            })
            .then(() => {
              playerRef.current.play();
            });
          return rest;
        } else {
          setIsPlaying(false);
          playingRef.current = false;
          return [];
        }
      });
    });
    return () => {
      player.setOnTrackEnded(null);
    };
  }, [isSolo, player]);

  const emitPlaybackUpdate = useCallback(
    (isPlaying: boolean) => {
      if (isSolo) return;
      socketRef.current?.emit(C2S.PLAYBACK_UPDATE, {
        room_id: roomId,
        position_ms: Math.round(playerRef.current.positionMs()),
        is_playing: isPlaying,
      });
    },
    [roomId, isSolo],
  );

  const addTrack = useCallback(
    (track: TrackInfo) => {
      if (isSolo) {
        const newItem: QueueItem = {
          queue_item_id: `solo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          track_uri: track.track_uri,
          track_name: track.track_name,
          artist: track.artist,
          album_art_url: track.album_art_url,
          duration_ms: track.duration_ms,
          added_by: meRef.current?.display_name || 'You',
          votes: 0,
        };
        setQueue((prev) => [...prev, newItem]);
        if (!nowPlaying && !playingRef.current) {
          playNow(track);
        } else {
          toast(`Added "${track.track_name}" to queue`, 'success');
        }
        return;
      }

      // Check for duplicate in queue or now playing
      const normUri = track.track_uri?.trim().toLowerCase();
      const normName = track.track_name?.trim().toLowerCase();
      const normArtist = track.artist?.trim().toLowerCase();

      const isDupQueue = queue.some((q) => {
        if (normUri && q.track_uri && q.track_uri.trim().toLowerCase() === normUri) return true;
        return (
          normName &&
          normArtist &&
          q.track_name.trim().toLowerCase() === normName &&
          q.artist.trim().toLowerCase() === normArtist
        );
      });

      const isDupPlaying =
        nowPlaying &&
        ((normUri && nowPlaying.track_uri && nowPlaying.track_uri.trim().toLowerCase() === normUri) ||
          (normName &&
            normArtist &&
            nowPlaying.track_name.trim().toLowerCase() === normName &&
            nowPlaying.artist.trim().toLowerCase() === normArtist));

      if (isDupQueue || isDupPlaying) {
        toast(`"${track.track_name}" is already in the queue`, 'info');
      }

      const emitAdd = (s: typeof socketRef.current) => {
        s?.emit(C2S.ADD_TO_QUEUE, {
          room_id: roomId,
          track_uri: track.track_uri,
          track_name: track.track_name,
          artist: track.artist,
          album_art_url: track.album_art_url,
          duration_ms: track.duration_ms,
        });
      };

      if (!socketRef.current?.connected) {
        connect().then((s) => {
          if (s) {
            emitAdd(s);
          } else {
            toast('Connecting to room queue...', 'info');
          }
        });
        return;
      }
      emitAdd(socketRef.current);
    },
    [roomId, queue, nowPlaying, connect, toast, isSolo],
  );

  const addMultipleTracks = useCallback(
    (tracks: TrackInfo[]) => {
      if (!tracks || tracks.length === 0) return;
      if (isSolo) {
        const newItems: QueueItem[] = tracks.map((t, idx) => ({
          queue_item_id: `solo_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          track_uri: t.track_uri,
          track_name: t.track_name,
          artist: t.artist,
          album_art_url: t.album_art_url,
          duration_ms: t.duration_ms,
          added_by: meRef.current?.display_name || 'You',
          votes: 0,
        }));
        setQueue((prev) => [...prev, ...newItems]);
        if (!nowPlaying && tracks.length > 0) {
          playNow(tracks[0]);
        }
        toast(`Added ${tracks.length} tracks to queue`, 'success');
        return;
      }

      const emitAddMultiple = (s: typeof socketRef.current) => {
        s?.emit(C2S.ADD_MULTIPLE_TO_QUEUE, {
          room_id: roomId,
          tracks: tracks.map((t) => ({
            uri: t.track_uri,
            track_uri: t.track_uri,
            name: t.track_name,
            track_name: t.track_name,
            artist: t.artist,
            album_art_url: t.album_art_url,
            duration_ms: t.duration_ms || 0,
          })),
        });
      };

      if (!socketRef.current?.connected) {
        connect().then((s) => {
          if (s) {
            emitAddMultiple(s);
          } else {
            toast('Connecting to room queue...', 'info');
          }
        });
        return;
      }
      emitAddMultiple(socketRef.current);
    },
    [roomId, connect, toast, isSolo, nowPlaying],
  );

  const playNow = useCallback(
    (track: TrackInfo) => {
      if (!canControl) return;
      if (isSolo) {
        setNowPlaying(track);
        trackUriRef.current = track.track_uri;
        setIsPlaying(true);
        playingRef.current = true;
        recordTrackPlayed(track, { id: 'solo', name: 'Solo Jam' });
        void playerRef.current
          .loadTrack(track.track_uri, {
            title: track.track_name,
            artist: track.artist,
            artworkUrl: track.album_art_url,
          })
          .then(() => {
            playerRef.current.play();
          });
        toast(`Playing "${track.track_name}"`, 'success');
        return;
      }

      socketRef.current?.emit(C2S.PLAY_NOW, {
        room_id: roomId,
        track_uri: track.track_uri,
        track_name: track.track_name,
        artist: track.artist,
        album_art_url: track.album_art_url,
        duration_ms: track.duration_ms,
      });
      setNowPlaying(track);
      recordTrackPlayed(track, { id: roomId, name: roomName });
      void applyPlaybackSync(
        {
          position_ms: 0,
          is_playing: true,
          track_uri: track.track_uri,
          track_name: track.track_name,
          artist: track.artist,
          album_art_url: track.album_art_url,
          duration_ms: track.duration_ms,
        },
        true,
      );
      toast(`Playing "${track.track_name}"`, 'success');
    },
    [canControl, roomId, roomName, applyPlaybackSync, toast, isSolo],
  );

  const voteTrack = useCallback(
    (queueItemId: string) => {
      if (!queueItemId) return;
      socketRef.current?.emit(C2S.VOTE_TRACK, { room_id: roomId, queue_item_id: queueItemId });
      setQueue((prev) =>
        prev.map((item) =>
          item.queue_item_id === queueItemId || item.id === queueItemId
            ? { ...item, votes: (item.votes ?? 0) + 1, has_voted: true }
            : item,
        ),
      );
      toast('Vote registered', 'info');
    },
    [roomId, toast],
  );

  const voteSkip = useCallback(() => {
    socketRef.current?.emit(C2S.VOTE_SKIP, { room_id: roomId });
    toast('Vote to skip recorded', 'info');
  }, [roomId, toast]);

  const togglePlay = useCallback(() => {
    if (!canControl) return;
    const p = playerRef.current;
    const next = !playingRef.current;
    if (next) p.play();
    else p.pause();
    playingRef.current = next;
    setIsPlaying(next);
    if (!isSolo) {
      emitPlaybackUpdate(next);
    }
  }, [canControl, emitPlaybackUpdate, isSolo]);

  const nextTrack = useCallback(() => {
    if (!canControl) return;
    if (isSolo) {
      if (queue.length > 0) {
        const [next, ...rest] = queue;
        setQueue(rest);
        playNow({
          track_uri: next.track_uri,
          track_name: next.track_name,
          artist: next.artist,
          album_art_url: next.album_art_url,
          duration_ms: next.duration_ms,
        });
      } else {
        toast('End of queue', 'info');
      }
      return;
    }
    socketRef.current?.emit(C2S.NEXT_TRACK, { room_id: roomId });
  }, [canControl, roomId, isSolo, queue, playNow, toast]);

  const previousTrack = useCallback(() => {
    if (!canControl) return;
    if (isSolo) {
      void playerRef.current.seekToMs(0);
      playerRef.current.play();
      setIsPlaying(true);
      playingRef.current = true;
      return;
    }
    socketRef.current?.emit(C2S.PREVIOUS_TRACK, { room_id: roomId });
  }, [canControl, roomId, isSolo]);

  // Ingest pending solo queue (e.g. from Liked Songs Shuffle or Recently Played on Home)
  useEffect(() => {
    if (!isSolo) return;
    const pending = consumePendingSoloQueue();
    if (!pending || pending.tracks.length === 0) return;

    const queueItems: QueueItem[] = pending.tracks.map((t, idx) => ({
      queue_item_id: `solo_${Date.now()}_${idx}`,
      track_uri: t.track_uri,
      track_name: t.track_name,
      artist: t.artist,
      album_art_url: t.album_art_url,
      duration_ms: t.duration_ms,
      added_by: 'You',
      votes: 0,
    }));

    if (pending.playTrack) {
      const restQueue = queueItems.filter(
        (q) => q.track_uri !== pending.playTrack!.track_uri,
      );
      setQueue(restQueue);
      playNow(pending.playTrack);
    } else {
      setQueue(queueItems.slice(1));
      playNow(pending.tracks[0]);
    }
  }, [isSolo, playNow]);

  // Sync persistent Android notification & lock screen media controls
  useEffect(() => {
    if (nowPlaying?.track_name) {
      void updateMediaNotification({
        title: nowPlaying.track_name,
        artist: nowPlaying.artist,
        isPlaying,
        roomId,
        artworkUrl: nowPlaying.album_art_url,
      });
    } else {
      void dismissMediaNotification();
    }
  }, [nowPlaying?.track_name, nowPlaying?.artist, nowPlaying?.album_art_url, isPlaying, roomId]);

  // Clean up media notification on room unmount
  useEffect(() => {
    return () => {
      void dismissMediaNotification();
    };
  }, []);

  // Listen to media notification actions (Play/Pause, Next, Prev)
  useEffect(() => {
    const unregister = registerMediaActionListener((action) => {
      if (action === 'play_pause') {
        togglePlay();
      } else if (action === 'next') {
        nextTrack();
      } else if (action === 'prev') {
        previousTrack();
      }
    });
    return () => {
      unregister();
    };
  }, [togglePlay, nextTrack, previousTrack]);


  const toggleRepeat = useCallback(() => {
    if (!canControl) return;
    const next = !loopRef.current;
    loopRef.current = next;
    setLoop(next);
    if (isSolo) {
      toast(next ? 'Loop enabled' : 'Loop disabled', 'info');
      return;
    }
    socketRef.current?.emit(C2S.TOGGLE_REPEAT, { room_id: roomId, loop: next });
  }, [canControl, roomId, isSolo, toast]);

  const shuffleQueue = useCallback(() => {
    if (!isHostRef.current) return;
    if (isSolo) {
      setQueue((prev) => {
        const shuffled = [...prev];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      });
      toast('Queue shuffled', 'info');
      return;
    }
    socketRef.current?.emit(C2S.SHUFFLE_QUEUE, { room_id: roomId });
    toast('Queue shuffled', 'info');
  }, [roomId, toast, isSolo]);

  const toggleGuestControls = useCallback(() => {
    if (!isHostRef.current) return;
    const nextAllow = !guestControls;
    socketRef.current?.emit(C2S.TOGGLE_GUEST_CONTROLS, { room_id: roomId, allow: nextAllow });
    setGuestControls(nextAllow);
  }, [roomId, guestControls]);

  const closeRoom = useCallback(async () => {
    if (!isHostRef.current) return;
    try {
      await deleteRoom(roomId);
      setRoomClosed(true);
    } catch (err) {
      toast('Could not close room', 'error');
    }
  }, [roomId, toast]);

  const updateRoomDetails = useCallback(
    async (data: { name?: string; genre_tags?: string[] }) => {
      if (!isHostRef.current) return;
      try {
        const res = await updateRoom(roomId, data);
        if (res.name) setRoomName(res.name);
        toast('Room updated', 'success');
      } catch (err) {
        toast('Could not update room details', 'error');
      }
    },
    [roomId, toast],
  );

  const seekToMs = useCallback(
    (ms: number) => {
      if (!canControl) return;
      void playerRef.current.seekToMs(ms).then(() => {
        if (!isSolo) emitPlaybackUpdate(true);
      });
    },
    [canControl, emitPlaybackUpdate, isSolo],
  );

  const removeTrack = useCallback(
    (queueItemId: string) => {
      if (!isHost || !queueItemId) return;
      if (isSolo) {
        setQueue((prev) =>
          prev.filter((item) => item.queue_item_id !== queueItemId && item.id !== queueItemId),
        );
        toast('Track removed', 'info');
        return;
      }
      socketRef.current?.emit(C2S.REMOVE_FROM_QUEUE, {
        room_id: roomId,
        queue_item_id: queueItemId,
      });
      setQueue((prev) =>
        prev.filter((item) => item.queue_item_id !== queueItemId && item.id !== queueItemId),
      );
      toast('Track removed', 'info');
    },
    [isHost, roomId, toast, isSolo],
  );

  const reorderQueue = useCallback(
    (orderedIds: string[]) => {
      if (!orderedIds || orderedIds.length === 0) return;
      if (!isSolo) {
        socketRef.current?.emit(C2S.REORDER_QUEUE, {
          room_id: roomId,
          ordered_ids: orderedIds,
        });
      }
      setQueue((prev) => {
        const itemMap = new Map(prev.map((item) => [item.queue_item_id || item.id || '', item]));
        const updated: QueueItem[] = [];
        for (const id of orderedIds) {
          const found = itemMap.get(id);
          if (found) {
            updated.push(found);
            itemMap.delete(id);
          }
        }
        for (const rem of itemMap.values()) {
          updated.push(rem);
        }
        return updated;
      });
    },
    [roomId, isSolo],
  );

  const transferHost = useCallback(
    (targetUserId: string) => {
      if (!isHost || !targetUserId) return;
      socketRef.current?.emit(C2S.TRANSFER_HOST, {
        room_id: roomId,
        target_user_id: targetUserId,
      });
      toast('Host transfer requested', 'info');
    },
    [isHost, roomId, toast],
  );

  const kickUser = useCallback(
    (targetUserId: string) => {
      if (!isHost || !targetUserId) return;
      socketRef.current?.emit(C2S.KICK_USER, {
        room_id: roomId,
        target_user_id: targetUserId,
      });
      toast('Listener removed from room', 'info');
    },
    [isHost, roomId, toast],
  );

  // Auto-advance on track completion & auto-recovery on fatal playback errors
  useEffect(() => {
    const p = playerRef.current;
    p.setOnTrackEnded(() => {
      if (canControl) {
        nextTrack();
      }
    });

    p.setOnTrackError((code) => {
      const errStr = String(code);
      // YouTube fatal errors: 2 (invalid param), 5 (HTML5 error), 100 (removed), 101/150 (embed disabled/region blocked)
      const isFatal = ['2', '5', '100', '101', '150'].includes(errStr);
      if (isFatal) {
        if (canControl) {
          toast(`Track unavailable on YouTube (Code ${code}). Skipping...`, 'error');
          nextTrack();
        } else {
          toast(`Track unavailable on YouTube (Code ${code}). Voting to skip...`, 'info');
          voteSkip();
        }
      }
    });

    return () => {
      p.setOnTrackEnded(null);
      p.setOnTrackError(null);
    };
  }, [canControl, nextTrack, voteSkip, toast]);

  const value = useMemo<RoomApi>(
    () => ({
      roomId,
      isSolo,
      roomName,
      isHost,
      canControl,
      connectionState,
      queue,
      nowPlaying,
      isPlaying,
      loop,
      listeners,
      messages: chat.messages,
      unreadChat: chat.unreadChat,
      typingUsers: chat.typingUsers,
      reactions: reactionsCtrl.reactions,
      skipVotes,
      guestControls,
      syncReady,
      joinError,
      roomClosed,
      me,
      retryJoin,
      toggleGuestControls,
      sendChat: chat.sendChat,
      sendReaction: reactionsCtrl.sendReaction,
      dismissReaction: reactionsCtrl.dismissReaction,
      addTrack,
      addMultipleTracks,
      playNow,
      voteTrack,
      voteSkip,
      togglePlay,
      nextTrack,
      previousTrack,
      toggleRepeat,
      shuffleQueue,
      seekToMs,
      removeTrack,
      reorderQueue,
      transferHost,
      kickUser,
      setTyping: chat.setTyping,
      clearUnreadChat: chat.clearUnreadChat,
      setChatFocused: chat.setChatFocused,
      closeRoom,
      updateRoomDetails,
    }),
    [
      roomId,
      isSolo,
      roomName,
      isHost,
      canControl,
      connectionState,
      queue,
      nowPlaying,
      isPlaying,
      loop,
      listeners,
      chat.messages,
      chat.unreadChat,
      chat.typingUsers,
      reactionsCtrl.reactions,
      skipVotes,
      guestControls,
      syncReady,
      joinError,
      roomClosed,
      me,
      retryJoin,
      toggleGuestControls,
      chat.sendChat,
      reactionsCtrl.sendReaction,
      reactionsCtrl.dismissReaction,
      addTrack,
      addMultipleTracks,
      playNow,
      voteTrack,
      voteSkip,
      togglePlay,
      nextTrack,
      previousTrack,
      toggleRepeat,
      shuffleQueue,
      seekToMs,
      removeTrack,
      reorderQueue,
      transferHost,
      kickUser,
      chat.setTyping,
      chat.clearUnreadChat,
      chat.setChatFocused,
      closeRoom,
      updateRoomDetails,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRoom(): RoomApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}

export function useOptionalRoom(): RoomApi | null {
  return useContext(Ctx);
}
