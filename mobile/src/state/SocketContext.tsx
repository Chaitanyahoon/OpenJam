/**
 * Socket.IO client lifecycle.
 * Mirrors frontend-next/contexts/SocketContext.js:
 * path '/socket.io', auth { token, guest_name }, websocket+polling.
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
import { io, Socket } from 'socket.io-client';
import { getBackendUrl } from '../config';
import { getStoredSession } from '../api';

interface SocketApi {
  socket: Socket | null;
  connected: boolean;
  /** Connect (or return the existing socket). Reads the stored guest session. */
  connect: () => Promise<Socket | null>;
  disconnect: () => void;
}

const Ctx = createContext<SocketApi>({
  socket: null,
  connected: false,
  connect: async () => null,
  disconnect: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
  }, []);

  const connect = useCallback(async (): Promise<Socket | null> => {
    if (socketRef.current?.connected) return socketRef.current;
    if (socketRef.current) {
      socketRef.current.connect();
      return socketRef.current;
    }
    const { token, displayName } = await getStoredSession();
    const s = io(getBackendUrl(), {
      path: '/socket.io',
      auth: { token: token || undefined, guest_name: displayName ?? '' },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    socketRef.current = s;
    setSocket(s);
    return s;
  }, []);

  // If the OS killed the socket while backgrounded, reconnect on foreground.
  // RoomContext re-runs the sync handshake on every reconnect.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const value = useMemo(
    () => ({ socket, connected, connect, disconnect }),
    [socket, connected, connect, disconnect],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocket(): SocketApi {
  return useContext(Ctx);
}
