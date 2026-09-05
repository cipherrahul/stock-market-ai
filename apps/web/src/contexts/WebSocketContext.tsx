'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getWsManager, WsManagerState } from '@/lib/wsManager';

interface WebSocketContextValue {
  status: WsManagerState['status'];
  latencyMs: number | null;
  reconnectAttempt: number;
  subscribe: (messageType: string, handler: (data: unknown) => void) => () => void;
  subscribePriceChannel: (symbol: string) => void;
  unsubscribePriceChannel: (symbol: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [wsState, setWsState] = useState<WsManagerState>({
    status: 'disconnected',
    latencyMs: null,
    reconnectAttempt: 0,
  });

  const managerRef = useRef(getWsManager());

  useEffect(() => {
    const manager = managerRef.current;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';
    const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') || localStorage.getItem('token') || '') : '';

    if (token) {
      manager.connect(WS_URL, token);
    }

    const unsubState = manager.onStateChange(state => setWsState(state));

    return () => {
      unsubState();
    };
  }, []);

  // Re-connect when token changes (e.g. after login)
  useEffect(() => {
    const handleStorageChange = () => {
      const manager = managerRef.current;
      const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000/ws';
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
      if (token) manager.connect(WS_URL, token);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const subscribe = useCallback((messageType: string, handler: (data: unknown) => void) => {
    return managerRef.current.subscribe(messageType, handler);
  }, []);

  const subscribePriceChannel = useCallback((symbol: string) => {
    managerRef.current.subscribePriceChannel(symbol);
  }, []);

  const unsubscribePriceChannel = useCallback((symbol: string) => {
    managerRef.current.unsubscribePriceChannel(symbol);
  }, []);

  return (
    <WebSocketContext.Provider value={{
      status: wsState.status,
      latencyMs: wsState.latencyMs,
      reconnectAttempt: wsState.reconnectAttempt,
      subscribe,
      subscribePriceChannel,
      unsubscribePriceChannel,
    }}>
      {children}
    </WebSocketContext.Provider>
  );
}

// Fallback context value for pages that render outside the provider (e.g. 404, error)
const fallbackContext: WebSocketContextValue = {
  status: 'disconnected',
  latencyMs: null,
  reconnectAttempt: 0,
  subscribe: () => () => {},
  subscribePriceChannel: () => {},
  unsubscribePriceChannel: () => {},
};

export function useWebSocket(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  // Return fallback instead of throwing — safe for SSR and error pages
  return ctx ?? fallbackContext;
}
