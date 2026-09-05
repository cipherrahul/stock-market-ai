import { useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/contexts/WebSocketContext';
import axios from 'axios';

// === Types ===

export interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: Date;
}

export interface PortfolioUpdate {
  cash: number;
  totalValue: number;
  totalGain: number;
  gainPercent: number;
  balances?: { cash: number; currency: string }[];
  positions: {
    symbol: string;
    quantity: number;
    currentPrice: number;
    avgCost: number;
    pnl?: number;
    pnlPercent?: number;
  }[];
  timestamp: string;
}

export interface OrderUpdate {
  orderId: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  status: string;
  executedPrice?: number;
  memo?: string;
  timestamp: string;
}

export interface AISignalUpdate {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  regime?: string;
  reasoning: string;
}

export interface SentimentUpdate {
  score: number;
  label: string;
  timestamp: string;
}

export interface Alert {
  id: string;
  event: string;
  symbol?: string;
  message?: string;
  triggerPrice?: number;
  currentPrice?: number;
  timestamp: string;
}

export interface IntradayPosition {
  symbol: string;
  netQty: number;
  avgBuyPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  side: 'BUY' | 'SELL';
  lastActivity: string;
  isIntraday: true;
}

// === useRealtimePrice ===

export function useRealtimePrice(_token: string) {
  const { status, subscribe, subscribePriceChannel, unsubscribePriceChannel } = useWebSocket();
  const [prices, setPrices] = useState<Map<string, PriceUpdate>>(new Map());

  const handlePriceUpdate = useCallback((data: unknown) => {
    const update = data as PriceUpdate;
    if (!update?.symbol) return;
    setPrices(prev => {
      const next = new Map(prev);
      next.set(update.symbol, { ...update, timestamp: new Date() });
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribe('PRICE_UPDATES', handlePriceUpdate);
  }, [subscribe, handlePriceUpdate]);

  return {
    prices,
    connected: status === 'connected',
    error: status === 'error' ? 'Real-time connection error' : null,
    subscribe: subscribePriceChannel,
    unsubscribe: unsubscribePriceChannel,
  };
}

// === useRealtimePortfolio ===

export function useRealtimePortfolio(_token: string, _userId: string, _isPaper: boolean = false) {
  const { status, subscribe } = useWebSocket();
  const [portfolio, setPortfolio] = useState<PortfolioUpdate | null>(null);

  useEffect(() => {
    return subscribe('PORTFOLIO_UPDATES', (data) => {
      setPortfolio(data as PortfolioUpdate);
    });
  }, [subscribe]);

  return {
    portfolio,
    connected: status === 'connected',
    error: status === 'error' ? 'Portfolio stream error' : null,
  };
}

// === useRealtimeOrders ===

export function useRealtimeOrders(_token: string, _isPaper: boolean = false) {
  const { status, subscribe } = useWebSocket();
  const [orders, setOrders] = useState<OrderUpdate[]>([]);

  useEffect(() => {
    return subscribe('ORDER_UPDATES', (data) => {
      setOrders(prev => {
        const update = data as OrderUpdate;
        const filtered = prev.filter(o => o.orderId !== update.orderId);
        return [update, ...filtered].slice(0, 50);
      });
    });
  }, [subscribe]);

  return {
    orders,
    connected: status === 'connected',
    error: status === 'error' ? 'Order stream error' : null,
  };
}

// === useRealtimeSignals ===

export function useRealtimeSignals(_token: string) {
  const { subscribe } = useWebSocket();
  const [signals, setSignals] = useState<Map<string, AISignalUpdate>>(new Map());

  useEffect(() => {
    return subscribe('AI_SIGNALS', (data) => {
      const update = data as AISignalUpdate;
      setSignals(prev => {
        const next = new Map(prev);
        next.set(update.symbol, update);
        return next;
      });
    });
  }, [subscribe]);

  return { signals };
}

// === useRealtimeAlpha ===

export function useRealtimeAlpha(_token: string) {
  const { subscribe } = useWebSocket();
  const [regime, setRegime] = useState('SIDEWAYS');
  const [sentiment, setSentiment] = useState(0.5);

  useEffect(() => {
    const unsubSentiment = subscribe('SENTIMENT_UPDATES', (data) => {
      const d = data as SentimentUpdate;
      if (typeof d?.score === 'number') setSentiment(d.score);
    });
    const unsubSignals = subscribe('AI_SIGNALS', (data) => {
      const d = data as AISignalUpdate;
      if (d?.regime) setRegime(d.regime);
    });
    return () => { unsubSentiment(); unsubSignals(); };
  }, [subscribe]);

  return { regime, sentiment };
}

// === useRealtimeAlerts ===

export function useRealtimeAlerts(_token: string) {
  const { subscribe } = useWebSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    return subscribe('RISK_ALERTS', (data) => {
      const alert = data as Alert;
      setAlerts(prev => {
        if (prev.some(a => a.id === alert.id)) return prev;
        return [alert, ...prev].slice(0, 20);
      });
    });
  }, [subscribe]);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  return { alerts, removeAlert };
}

// === useIntradayPositions ===
// Polls intraday (MIS) positions with live price enrichment from the WebSocket prices map

export function useIntradayPositions(token: string, userId: string) {
  const [positions, setPositions] = useState<IntradayPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${apiUrl}/api/v1/trading/intraday/positions/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });
      const raw = res.data?.positions || [];
      setPositions(raw.map((p: any) => ({
        ...p,
        currentPrice: p.avgBuyPrice, // Will be enriched by caller with live prices
        pnl: 0,
        pnlPercent: 0,
      })));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load intraday positions');
    } finally {
      setLoading(false);
    }
  }, [token, userId, apiUrl]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetchPositions();

    // Poll every 5 seconds during market hours
    pollingRef.current = setInterval(fetchPositions, 5000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPositions, userId]);

  return { positions, loading, error, refetch: fetchPositions };
}

// === useSquareOffTimer ===
// Returns seconds remaining until NSE market close (15:30 IST) and fires warning alerts

export function useSquareOffTimer() {
  const getSecondsToClose = () => {
    const now = new Date();
    // IST = UTC+5:30
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs - now.getTimezoneOffset() * 60000);
    const closeTime = new Date(istNow);
    closeTime.setHours(15, 30, 0, 0);
    const diff = closeTime.getTime() - istNow.getTime();
    return Math.max(0, Math.floor(diff / 1000));
  };

  const isMarketOpen = () => {
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffsetMs - now.getTimezoneOffset() * 60000);
    const h = istNow.getHours();
    const m = istNow.getMinutes();
    const totalMins = h * 60 + m;
    return totalMins >= 9 * 60 + 15 && totalMins < 15 * 60 + 30;
  };

  const [secondsLeft, setSecondsLeft] = useState(getSecondsToClose);
  const [marketOpen, setMarketOpen] = useState(isMarketOpen);
  const [warningLevel, setWarningLevel] = useState<null | '15min' | '5min' | 'urgent'>(null);

  useEffect(() => {
    const tick = () => {
      const secs = getSecondsToClose();
      const open = isMarketOpen();
      setSecondsLeft(secs);
      setMarketOpen(open);
      if (open) {
        if (secs <= 5 * 60) setWarningLevel('urgent');
        else if (secs <= 15 * 60) setWarningLevel('15min');
        else setWarningLevel(null);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  };

  return { secondsLeft, marketOpen, warningLevel, formatCountdown };
}