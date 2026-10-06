/**
 * Socket.IO protocol — event names + payload types.
 * Mirrors docs/API_DOCUMENTATION.md §2 and the events used in
 * frontend-next/app/room/[id]/RoomClient.js.
 */

/** Client -> server events */
export const C2S = {
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  SEND_CHAT: 'send_chat',
  SEND_REACTION: 'send_reaction',
  ADD_TO_QUEUE: 'add_to_queue',
  ADD_MULTIPLE_TO_QUEUE: 'add_multiple_to_queue',
  REMOVE_FROM_QUEUE: 'remove_from_queue',
  REORDER_QUEUE: 'reorder_queue',
  SHUFFLE_QUEUE: 'shuffle_queue',
  VOTE_TRACK: 'vote_track',
  VOTE_SKIP: 'vote_skip',
  NEXT_TRACK: 'next_track',
  PREVIOUS_TRACK: 'previous_track',
  PLAY_NOW: 'play_now',
  PLAYBACK_UPDATE: 'playback_update',
  TOGGLE_REPEAT: 'toggle_repeat',
  TOGGLE_GUEST_CONTROLS: 'toggle_guest_controls',
  SET_GUEST_NAME: 'set_guest_name',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
  SYNC_PING: 'sync_ping',
  TRANSFER_HOST: 'transfer_host',
  KICK_USER: 'kick_user',
} as const;

/** Server -> client events */
export const S2C = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_SUCCESS: 'join_success',
  JOIN_ERROR: 'join_error',
  CHAT_HISTORY: 'chat_history',
  CHAT_MESSAGE: 'chat_message',
  REACTION: 'reaction',
  TYPING: 'typing',
  STOP_TYPING: 'stop_typing',
  LISTENER_COUNT: 'listener_count',
  QUEUE_UPDATED: 'queue_updated',
  QUEUE_ERROR: 'queue_error',
  PLAYBACK_SYNC: 'playback_sync',
  TRACK_CHANGED: 'track_changed',
  SKIP_VOTES_UPDATED: 'skip_votes_updated',
  SYNC_PONG: 'sync_pong',
  ROOM_CLOSED: 'room_closed',
  HOST_CHANGED: 'host_changed',
  USER_JOINED: 'user_joined',
  USER_LEFT: 'user_left',
  GUEST_CONTROLS_UPDATED: 'guest_controls_updated',
  ROOM_UPDATED: 'room_updated',
  KICKED_FROM_ROOM: 'kicked_from_room',
} as const;

export interface TrackInfo {
  track_uri: string;
  track_name: string;
  artist: string;
  album_art_url?: string;
  duration_ms?: number;
}

export interface QueueItem extends TrackInfo {
  queue_item_id: string;
  id?: string;
  votes?: number;
  added_by?: string;
  added_by_name?: string;
  status?: string;
  has_voted?: boolean;
}

export interface PlaybackSyncPayload {
  position_ms: number;
  duration_ms?: number;
  is_playing: boolean;
  is_buffering?: boolean;
  loop?: boolean;
  server_timestamp?: number;
  track_uri?: string;
  track_name?: string;
  artist?: string;
  album_art_url?: string;
}

export interface SyncPongPayload {
  t0: number;
  t1: number;
  t2: number;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  timestamp: number | string;
  avatar_url?: string | null;
  is_system?: boolean;
  system_type?: 'join' | 'leave' | 'host' | 'skip' | 'info';
}

export interface ReactionEvent {
  user_id: string;
  user_name: string;
  emoji: string;
}

export interface ListenerInfo {
  user_id: string;
  user_name: string;
  avatar_url?: string | null;
  is_host?: boolean;
}

export interface JoinSuccessPayload {
  room_id: string;
  is_host?: boolean;
  host_user_id?: string;
  room?: {
    id: string;
    name: string;
    host_user_id: string;
    host_name?: string;
    host_avatar_url?: string | null;
    listener_count?: number;
    is_private?: boolean;
    allow_guest_controls?: boolean;
    genre_tags?: string[];
    description?: string;
  };
  queue: QueueItem[];
  now_playing: TrackInfo | null;
  playback: {
    position_ms?: number;
    positionMs?: number;
    duration_ms?: number;
    durationMs?: number;
    is_playing?: boolean;
    isPlaying?: boolean;
    is_buffering?: boolean;
    server_timestamp?: number;
  } | null;
  listeners: ListenerInfo[];
  allow_guest_controls?: boolean;
}

