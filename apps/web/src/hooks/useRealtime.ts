import { useEffect, useRef, useState, useCallback } from 'react';

// Explicit Types to resolve 'any' and NodeJS namespace issues
type Timeout = ReturnType<typeof setTimeout>;
type Interval = ReturnType<typeof setInterval>;

/**
 * REALTIME PRICE UPDATE HOOK
 */
interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: Date;
}

interface UseRealtimePriceReturn {
  prices: Map<string, PriceUpdate>;
  connected: boolean;
  error: string | null;
  subscribe: (symbol: string) => void;
  unsubscribe: (symbol: string) => void;
}

export function useRealtimePrice(token: string): UseRealtimePriceReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
      const ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptRef.current = 0; // Reset attempts
        subscriptionsRef.current.forEach((symbol: string) => {
          ws.send(JSON.stringify({ type: 'SUBSCRIBE', channel: `price:${symbol}` }));
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'PRICE_UPDATES') {
            const update = message.data as PriceUpdate;
            setPrices((prev: Map<string, PriceUpdate>) => {
              const newMap = new Map(prev);
              newMap.set(update.symbol, update);
              return newMap;
            });
          }
        } catch (err) {
          console.error('WS Parse Error:', err);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        setConnected(false);
        if (!event.wasClean) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
          reconnectAttemptRef.current += 1;
          console.warn(`WebSocket closed. Reconnecting in ${delay}ms... (Attempt ${reconnectAttemptRef.current})`);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = (err: Event) => {
        console.error('WebSocket Error:', err);
        setError('Real-time connection error');
      };

      wsRef.current = ws;
    } catch (err: any) {
      setError(err.message);
    }
  }, [token]);

  useEffect(() => {
    connect();
    const heartbeat: Interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { 
    prices, 
    connected, 
    error, 
    subscribe: (s: string) => { subscriptionsRef.current.add(s); connect(); },
    unsubscribe: (s: string) => { subscriptionsRef.current.delete(s); }
  };
}

interface PortfolioUpdate {
  cash: number;
  totalValue: number;
  totalGain: number;
  gainPercent: number;
  positions: any[];
  timestamp: string;
}

export function useRealtimePortfolio(token: string, userId: string): { portfolio: PortfolioUpdate | null, connected: boolean, error: string | null } {
  const [portfolio, setPortfolio] = useState<PortfolioUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
    const ws = new WebSocket(`${WS_URL}?token=${token}&userId=${userId}`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'PORTFOLIO_UPDATES') setPortfolio(msg.data as PortfolioUpdate);
      } catch (err) { console.error(err); }
    };

    ws.onerror = () => setError('Websocket connection failed');
    ws.onclose = () => setConnected(false);

    wsRef.current = ws;
    return () => ws.close();
  }, [token, userId]);

  return { portfolio, connected, error };
}

interface OrderUpdate {
  orderId: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  status: string;
  executedPrice?: number;
  timestamp: string;
}

export function useRealtimeOrders(token: string): { orders: OrderUpdate[], connected: boolean, error: string | null } {
  const [orders, setOrders] = useState<OrderUpdate[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'ORDER_UPDATES') {
            setOrders(prev => [msg.data as OrderUpdate, ...prev]);
          }
      } catch (err) { console.error(err); }
    };

    ws.onerror = () => setError('Order stream connection failed');
    ws.onclose = () => setConnected(false);

    return () => ws.close();
  }, [token]);

  return { orders, connected, error };
}

interface AISignalUpdate {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
}

export function useRealtimeSignals(token: string): { signals: Map<string, AISignalUpdate> } {
  const [signals, setSignals] = useState<Map<string, AISignalUpdate>>(new Map());
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    ws.onmessage = (e: MessageEvent) => {
      try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'AI_SIGNALS') {
            setSignals((prev: Map<string, AISignalUpdate>) => {
              const next = new Map(prev);
              const data = msg.data as AISignalUpdate;
              next.set(data.symbol, data);
              return next;
            });
          }
      } catch (err) { console.error(err); }
    };
    return () => ws.close();
  }, [token]);
  return { signals };
}

/**
 * REALTIME ALPHA INSIGHTS HOOK
 */
export function useRealtimeAlpha(token: string): { regime: string, sentiment: number } {
  const [alpha, setAlpha] = useState({ regime: 'SIDEWAYS', sentiment: 0.5 });
  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    ws.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'SENTIMENT_UPDATES') setAlpha(prev => ({ ...prev, sentiment: msg.data.score }));
      if (msg.type === 'AI_SIGNALS') setAlpha(prev => ({ ...prev, regime: msg.data.regime }));
    };
    return () => ws.close();
  }, [token]);
  return alpha;
}

interface Alert {
  id: string;
  event: string;
  symbol?: string;
  message?: string;
  triggerPrice?: number;
  currentPrice?: number;
  timestamp: string;
}

export function useRealtimeAlerts(token: string): { alerts: Alert[], removeAlert: (id: string) => void } {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (!token) return;
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:3000/ws`;
    const ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'RISK_ALERTS') {
          setAlerts(prev => [msg.data as Alert, ...prev]);
        }
      } catch (err) { console.error(err); }
    };

    return () => ws.close();
  }, [token]);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  return { alerts, removeAlert };
}
