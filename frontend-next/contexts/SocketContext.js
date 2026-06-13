'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

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

  useEffect(() => {
    // Only run on the client side
    if (typeof window === 'undefined') return;

    const token = getCookie('session_token');
    const guestName = localStorage.getItem('openjam_display_name') || '';

    const getBackendUrl = () => {
      if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL) {
        const url = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (url !== 'undefined' && url !== 'null' && url.trim() !== '') {
          return url.replace(/\/$/, '');
        }
      }
      if (typeof window !== 'undefined') {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return 'http://localhost:8000';
        }
        return 'https://openjam.onrender.com';
      }
      return 'http://localhost:8000';
    };
    const backendUrl = getBackendUrl();
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
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const reconnect = (newToken, newGuestName) => {
    if (socket) {
      const token = newToken || getCookie('session_token') || '';
      const guestName = newGuestName || localStorage.getItem('openjam_display_name') || '';
      socket.auth = { token, guest_name: guestName };
      socket.disconnect().connect();
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return { socket: null, isConnected: false, reconnect: () => {} };
  }
  return context;
};
