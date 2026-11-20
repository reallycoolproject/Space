import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
  connect: (token?: string) => void;
  disconnect: () => void;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false, connect: () => {}, disconnect: () => {} });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // auto-connect if token exists on mount
    let mounted = true;
    (async () => {
      const token = await SecureStore.getItemAsync('space_token');
      if (token && mounted) connect(token);
    })();
    return () => {
      mounted = false;
      disconnect();
    };
  }, []);

  const connect = (token?: string) => {
    const authToken = token;
    if (!authToken) return;
    if (socketRef.current) return;
    const s = io('http://localhost:3000', { transports: ['websocket'], reconnection: true, auth: { token: authToken } });
    socketRef.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
  };

  const disconnect = () => {
    if (socketRef.current) {
      try {
        socketRef.current.disconnect();
      } catch (e) {}
      socketRef.current = null;
    }
    setConnected(false);
  };

  const value = useMemo(() => ({ socket: socketRef.current, connected, connect, disconnect }), [connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
