'use client';

import React, { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { FiWifi, FiWifiOff, FiRefreshCw } from 'react-icons/fi';

export function ConnectionStatus() {
  const { status, latencyMs, reconnectAttempt } = useWebSocket();
  const [visible, setVisible] = useState(false);
  const [wasConnected, setWasConnected] = useState(false);

  useEffect(() => {
    if (status === 'connected') {
      setWasConnected(true);
      // Auto-hide after 2s if reconnected
      if (visible) {
        const timer = setTimeout(() => setVisible(false), 2000);
        return () => clearTimeout(timer);
      }
    } else if (status === 'disconnected' || status === 'error') {
      if (wasConnected) setVisible(true);
    }
  }, [status, wasConnected, visible]);

  if (!visible) return null;

  const isReconnecting = status === 'connecting';
  const isError = status === 'error' || status === 'disconnected';

  return (
    <div className={`connection-banner ${isError ? 'bg-slate-800' : 'bg-emerald-700'}`} role="alert" aria-live="polite">
      {isReconnecting ? (
        <>
          <FiRefreshCw className="animate-spin text-slate-300" size={14} />
          <span>Reconnecting to market data stream... (attempt {reconnectAttempt})</span>
        </>
      ) : status === 'connected' ? (
        <>
          <FiWifi className="text-emerald-200" size={14} />
          <span>Market data stream restored</span>
          {latencyMs !== null && (
            <span className="text-emerald-300 font-mono text-xs">{latencyMs}ms</span>
          )}
        </>
      ) : (
        <>
          <FiWifiOff className="text-red-300" size={14} />
          <span>Market data stream disconnected — attempting to reconnect</span>
          <button
            className="ml-2 text-xs underline text-slate-300 hover:text-white"
            onClick={() => setVisible(false)}
          >
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}