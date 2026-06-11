'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Only run on the client side
    if (typeof window === 'undefined') return;

    const token = getCookie('session_token');
    const guestName = localStorage.getItem('openjam_display_name') || '';

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const socketInstance = io(backendUrl, {
      path: '/socket.io',
      auth: { token: token || '', guest_name: guestName },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 15,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      console.log('[openjam] Socket connected, id =', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    if (!m) return null;
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    return val;
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
