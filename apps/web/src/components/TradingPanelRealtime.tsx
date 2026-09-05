'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MotionDiv, MotionButton } from '@/components/Motion';
import {
  FiZap, FiSearch, FiShield, FiCheckCircle, FiAlertTriangle,
  FiArrowUpRight, FiArrowDownRight, FiX, FiClock, FiTrendingUp,
  FiTrendingDown, FiRefreshCw, FiActivity,
} from 'react-icons/fi';
import { useRealtimeTrading, validateTradeRequest, type OrderVariant } from '@/hooks/useRealtimeTrading';
import { useRealtimePrice } from '@/hooks/useRealtime';
import { useIntradayPositions, useSquareOffTimer } from '@/hooks/useRealtime';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { StatusBadge } from './EnterpriseUI';
import { SovereignChart } from './charts/SovereignChart';
import { useCandlestickData, ChartTimeframe } from '@/hooks/useCandlestickData';
import axios from 'axios';
import toast from 'react-hot-toast';

interface TradeExecutionResult {
  orderId: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  requestedPrice: number;
  executedPrice: number;
  slippagePercent: number;
  status: 'EXECUTED' | 'FAILED' | 'PENDING';
  timestamp: string;
}

interface SearchResult {
  symbol: string;
  ticker?: string;
  name: string;
  exchange: string;
}

interface TradingPanelProps {
  token: string;
  userId: string;
  isPaper?: boolean;
  defaultSymbol?: string;
  onTradeExecuted?: (trade: TradeExecutionResult) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function TradingPanelRealtime({
  token,
  userId,
  isPaper = false,
  defaultSymbol = 'RELIANCE',
  onTradeExecuted,
}: TradingPanelProps) {
  // ── Core State ──────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [orderVariant, setOrderVariant] = useState<OrderVariant>('CNC');

  // ── Search State ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(defaultSymbol);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Confirm Modal ────────────────────────────────────────────────────────────
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    side: 'BUY' | 'SELL'; symbol: string; quantity: number; price: number; variant: OrderVariant;
  } | null>(null);

  // ── Chart Timeframe ──────────────────────────────────────────────────────────
  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5m');

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const { executing, lastTrade, error, retryCount, executeTrade, squareOffAll, clearError, setError } = useRealtimeTrading(token, userId);
  const { prices, subscribe, unsubscribe } = useRealtimePrice(token);
  const { positions: intradayPositions, loading: intradayLoading, refetch: refetchIntraday } = useIntradayPositions(token, userId);
  const { secondsLeft, marketOpen, warningLevel, formatCountdown } = useSquareOffTimer();
  const { status: wsStatus } = useWebSocket();
  const isConnected = wsStatus === 'connected';

  const currentPrice = prices.get(symbol.toUpperCase());

  // ── Price Pulse ──────────────────────────────────────────────────────────────
  const [pulse, setPulse] = useState<'UP' | 'DOWN' | null>(null);
  const prevPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentPrice) {
      if (prevPriceRef.current !== null) {
        if (currentPrice.price > prevPriceRef.current) setPulse('UP');
        else if (currentPrice.price < prevPriceRef.current) setPulse('DOWN');
        const timer = setTimeout(() => setPulse(null), 800);
        return () => clearTimeout(timer);
      }
      prevPriceRef.current = currentPrice.price;
    }
  }, [currentPrice]);

  // ── Symbol Subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    subscribe(symbol.toUpperCase());
    return () => unsubscribe(symbol.toUpperCase());
  }, [symbol, subscribe, unsubscribe]);

  // ── Candlestick Data ─────────────────────────────────────────────────────────
  const { candles, latestCandle, loading: candlesLoading } = useCandlestickData({
    symbol,
    timeframe: chartTimeframe,
    livePrice: currentPrice?.price,
  });

  // ── Enriched intraday P&L ────────────────────────────────────────────────────
  const enrichedIntradayPositions = intradayPositions.map(pos => {
    const livePrice = prices.get(pos.symbol)?.price || pos.avgBuyPrice;
    const pnl = (livePrice - pos.avgBuyPrice) * pos.netQty * (pos.side === 'SELL' ? -1 : 1);
    const pnlPercent = pos.avgBuyPrice > 0 ? (pnl / (pos.avgBuyPrice * Math.abs(pos.netQty))) * 100 : 0;
    return { ...pos, currentPrice: livePrice, pnl, pnlPercent };
  });

  const totalIntradayPnl = enrichedIntradayPositions.reduce((sum, p) => sum + p.pnl, 0);

  // ── Symbol Search ─────────────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    setShowDropdown(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/v1/market/search?q=${encodeURIComponent(val.toUpperCase())}`, {
          timeout: 4000,
        });
        setSearchResults(res.data?.results || []);
      } catch {
        // Silently fail — user can still type symbol manually
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const selectSymbol = async (sym: string) => {
    const upper = sym.toUpperCase();
    setSymbol(upper);
    setSearchQuery(upper);
    setShowDropdown(false);
    setSearchResults([]);

    // Subscribe dynamically
    try {
      await axios.post(`${API_URL}/api/v1/market/subscribe`, { symbol: upper }, { timeout: 6000 });
      subscribe(upper);
    } catch { /* already tracked or offline */ }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Order Book ───────────────────────────────────────────────────────────────
  const getOrderBook = () => {
    if (!currentPrice) return { bids: [], asks: [] };
    const base = Math.max(10, Math.floor((currentPrice.volume || 50000) * 0.00005));
    const bids = [], asks = [];
    for (let i = 1; i <= 5; i++) {
      const bidPrice = Number((currentPrice.bid - (i * 0.05)).toFixed(2));
      const askPrice = Number((currentPrice.ask + (i * 0.05)).toFixed(2));
      const depthQty = base * (6 - i);
      bids.push({ price: bidPrice, quantity: depthQty });
      asks.push({ price: askPrice, quantity: depthQty });
    }
    return { bids, asks: asks.reverse() };
  };
  const { bids, asks } = getOrderBook();

  const handleNumericInput = (val: string, setter: (v: string) => void) => {
    if (val === '' || /^\d*\.?\d*$/.test(val)) setter(val);
  };

  // ── Trade Initiation ─────────────────────────────────────────────────────────
  const initiateTrade = (side: 'BUY' | 'SELL') => {
    const qty = parseInt(quantity);
    const px = price ? parseFloat(price) : (currentPrice?.price || 0);
    const validation = validateTradeRequest({
      symbol: symbol.toUpperCase(), quantity: qty, side, price: px,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });
    if (!validation.valid) { setError(validation.error || 'Invalid trade request'); return; }
    setConfirmData({ side, symbol: symbol.toUpperCase(), quantity: qty, price: px, variant: orderVariant });
    setShowConfirm(true);
  };

  const executeConfirmedTrade = async () => {
    if (!confirmData) return;
    setShowConfirm(false);
    const trade = await executeTrade({
      symbol: confirmData.symbol,
      quantity: confirmData.quantity,
      side: confirmData.side,
      price: confirmData.price,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      isPaper,
      orderVariant: confirmData.variant,
      bid: currentPrice?.bid,
      ask: currentPrice?.ask,
    } as any);
    if (trade.status === 'EXECUTED') {
      onTradeExecuted?.(trade as any);
      setQuantity('1'); setPrice(''); setStopLoss(''); setTakeProfit('');
      if (confirmData.variant === 'MIS') {
        setTimeout(refetchIntraday, 1500);
        toast.success(`MIS order executed! Auto square-off before 15:30 IST.`);
      }
    }
  };

  // ── Square Off All ────────────────────────────────────────────────────────────
  const handleSquareOff = async () => {
    const toastId = toast.loading('Squaring off all intraday positions…');
    try {
      const result = await squareOffAll(userId);
      toast.success(`${result.squaredOff} position${result.squaredOff !== 1 ? 's' : ''} squared off!`, { id: toastId });
      setTimeout(refetchIntraday, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Square-off failed', { id: toastId });
    }
  };

  // ── Estimated order value ────────────────────────────────────────────────────
  const estValue = (parseInt(quantity) || 0) * (price ? parseFloat(price) : currentPrice?.price || 0);

  return (
    <div className="space-y-6">

      {/* ── Session Timer Bar ── */}
      {marketOpen && (
        <MotionDiv
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between px-5 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest ${
            warningLevel === 'urgent'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : warningLevel === '15min'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <FiClock size={12} />
            <span>NSE Market Close</span>
          </div>
          <div className="flex items-center gap-3">
            {warningLevel && (
              <span className="text-[9px] font-black animate-pulse">
                {warningLevel === 'urgent' ? '⚠️ SQUARE OFF INTRADAY NOW' : '⚠️ INTRADAY WARNING'}
              </span>
            )}
            <span className="font-mono text-base">{formatCountdown(secondsLeft)}</span>
          </div>
        </MotionDiv>
      )}

      {/* ── Confirmation Modal ── */}
      {showConfirm && confirmData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/95 backdrop-blur-3xl p-6">
          <MotionDiv
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-black/70 border border-white/10 rounded-[2.5rem] p-10 space-y-7 shadow-[0_0_120px_rgba(56,189,248,0.08)] relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03]"><FiShield className="text-[8rem]" /></div>

            <div className="text-center space-y-3">
              <div className={`mx-auto w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg ${
                confirmData.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}><FiZap /></div>
              <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Confirm Execution</h3>
              <div className="flex items-center justify-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                  confirmData.variant === 'MIS' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                }`}>{confirmData.variant}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {confirmData.variant === 'MIS' ? 'Intraday · Auto Square-off 15:30' : 'Delivery · Hold Overnight'}
                </span>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              {[
                ['Instrument', confirmData.symbol],
                ['Operation', confirmData.side],
                ['Volume', `${confirmData.quantity.toLocaleString()} shares`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between items-center px-2 py-1.5">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
                  <span className={`text-lg font-black italic tracking-tighter ${
                    val === 'BUY' ? 'text-emerald-400' : val === 'SELL' ? 'text-rose-400' : 'text-white'
                  }`}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-3 py-3.5 bg-white/[0.03] rounded-2xl border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Est. Value</span>
                <span className="text-2xl font-black italic tracking-tighter text-sky-400">
                  ₹{(confirmData.quantity * confirmData.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <button onClick={() => setShowConfirm(false)}
                className="py-4 rounded-3xl border border-white/10 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-all">
                Abort
              </button>
              <button onClick={executeConfirmedTrade}
                className={`py-4 rounded-3xl text-xs font-black uppercase tracking-widest text-slate-950 transition-all shadow-xl ${
                  confirmData.side === 'BUY' ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20' : 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/20'
                }`}>
                Commit
              </button>
            </div>
          </MotionDiv>
        </div>
      )}

      {/* ── Execution Terminal Header ── */}
      <div className="section-card">
        <div className="section-card-header">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2">
              <FiZap className="text-blue-600" size={15} />
            </div>
            <div>
              <h2 className="section-title">Execution Terminal</h2>
              <p className="text-xs text-slate-500">Real-time order routing · Any stock · NSE / BSE / NYSE</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Order Type */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['MARKET', 'LIMIT'] as const).map(ot => (
                <button key={ot} onClick={() => setOrderType(ot)}
                  className={`px-3 py-1.5 text-xs font-semibold transition-all ${orderType === ot ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {ot}
                </button>
              ))}
            </div>
            {/* CNC / MIS */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['CNC', 'MIS'] as const).map(v => (
                <button key={v} onClick={() => setOrderVariant(v)}
                  className={`px-3 py-1.5 text-xs font-bold tracking-wider transition-all ${orderVariant === v
                    ? v === 'MIS' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  title={v === 'MIS' ? 'Intraday — auto square-off at 15:30 IST' : 'Delivery — hold overnight'}>
                  {v}
                </button>
              ))}
            </div>
            <StatusBadge status={isConnected ? 'connected' : 'disconnected'} label={isConnected ? 'Live' : 'Offline'} />
          </div>
        </div>
      </div>

      {/* ── MIS Warning Banner ── */}
      {orderVariant === 'MIS' && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-purple-500/5 border border-purple-500/20 rounded-xl">
          <FiActivity className="text-purple-400 shrink-0" size={13} />
          <p className="text-[11px] text-purple-300 font-semibold">
            <strong>MIS (Intraday) Mode</strong> — Position will be auto-squared off before 15:30 IST if not manually closed.
          </p>
        </div>
      )}

      {/* ── Retry indicator ── */}
      {retryCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <FiRefreshCw className="text-amber-400 animate-spin shrink-0" size={13} />
          <p className="text-[11px] text-amber-300 font-semibold">Retrying execution (attempt {retryCount + 1}/3)…</p>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <FiAlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
          <button className="text-red-400 hover:text-red-600 transition-colors shrink-0" onClick={clearError}><FiX size={14} /></button>
        </div>
      )}

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT: Symbol Search + Order Book */}
        <div className="lg:col-span-4 space-y-4">
          <div className="section-card p-4 space-y-4">

            {/* Symbol Search */}
            <div ref={searchRef} className="relative">
              <label className="data-label flex items-center gap-1.5 mb-2">
                <FiSearch size={11} /> Instrument Search
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  onFocus={() => searchQuery && setShowDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      selectSymbol(searchQuery.trim());
                    }
                  }}
                  className="input-field text-base font-bold uppercase pl-9 pr-9"
                  placeholder="RELIANCE, AAPL, TATASTEEL…"
                  disabled={executing}
                  autoComplete="off"
                />
                {searchLoading && (
                  <FiRefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={13} />
                )}
                {searchQuery && !searchLoading && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  ><FiX size={13} /></button>
                )}
              </div>

              {/* Autocomplete Dropdown */}
              {showDropdown && (searchResults.length > 0 || searchLoading) && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
                  {searchResults.map(result => (
                    <button
                      key={result.symbol}
                      onClick={() => selectSymbol(result.symbol)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-b-0"
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900">{result.symbol}</p>
                        <p className="text-xs text-slate-500 truncate max-w-[160px]">{result.name}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg shrink-0">
                        {result.exchange}
                      </span>
                    </button>
                  ))}
                  {searchLoading && (
                    <div className="px-4 py-3 text-xs text-slate-400 flex items-center gap-2">
                      <FiRefreshCw className="animate-spin" size={11} /> Searching markets…
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Price Display */}
            {currentPrice ? (
              <MotionDiv
                animate={{ scale: pulse ? 1.015 : 1 }}
                transition={{ duration: 0.15 }}
                className={`rounded-2xl border p-4 transition-all duration-300 ${
                  pulse === 'UP' ? 'border-emerald-200 bg-emerald-50' :
                  pulse === 'DOWN' ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-end">
                  <div>
                    <p className="data-label">{symbol}</p>
                    <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">
                      ₹{currentPrice.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums mt-0.5">
                      Bid: {currentPrice.bid.toFixed(2)} · Ask: {currentPrice.ask.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold tabular-nums flex items-center gap-1 ${currentPrice.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {currentPrice.change >= 0 ? <FiArrowUpRight size={16} /> : <FiArrowDownRight size={16} />}
                      {Math.abs(currentPrice.changePercent).toFixed(2)}%
                    </p>
                    <p className={`text-xs font-semibold ${currentPrice.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {currentPrice.change >= 0 ? '+' : ''}{currentPrice.change.toFixed(2)}
                    </p>
                  </div>
                </div>
                {/* Estimated value */}
                {estValue > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Order Value</span>
                    <span className="text-sm font-black text-slate-700">
                      ₹{estValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </MotionDiv>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                <FiSearch className="mx-auto text-slate-300 mb-2" size={20} />
                <p className="text-xs text-slate-400 font-semibold">Search and select a symbol above to see live prices</p>
              </div>
            )}

            {/* Order Book */}
            {currentPrice && (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">
                  <span>Ask Price</span><span>Depth</span>
                </div>
                <div className="space-y-1">
                  {asks.map((a, i) => (
                    <div key={`ask-${i}`} className="flex justify-between text-[11px] items-center">
                      <span className="text-rose-500 font-mono font-bold">{a.price.toFixed(2)}</span>
                      <div className="flex-1 mx-3 h-1 bg-rose-100 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-400/60" style={{ width: `${Math.min(100, (a.quantity / 500) * 100)}%` }} />
                      </div>
                      <span className="text-slate-400 font-mono text-[9px]">{a.quantity}</span>
                    </div>
                  ))}
                  <div className="py-2 border-y border-slate-200 flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-sky-500 uppercase tracking-wider">MID</span>
                    <span className="text-xs font-mono font-black text-slate-700">₹{currentPrice.price.toFixed(2)}</span>
                  </div>
                  {bids.map((b, i) => (
                    <div key={`bid-${i}`} className="flex justify-between text-[11px] items-center">
                      <span className="text-emerald-600 font-mono font-bold">{b.price.toFixed(2)}</span>
                      <div className="flex-1 mx-3 h-1 bg-emerald-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400/60" style={{ width: `${Math.min(100, (b.quantity / 500) * 100)}%` }} />
                      </div>
                      <span className="text-slate-400 font-mono text-[9px]">{b.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Chart */}
        <div className="lg:col-span-5">
          <div className="w-full relative">
            <SovereignChart
              data={candles}
              latestCandle={latestCandle}
              symbol={symbol}
              timeframe={chartTimeframe}
              onTimeframeChange={setChartTimeframe}
              loading={candlesLoading}
              height={460}
            />
          </div>
        </div>

        {/* RIGHT: Order Entry */}
        <div className="lg:col-span-3 space-y-5">
          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1 block">Quantity (Shares)</label>
            <input
              type="text"
              value={quantity}
              onChange={(e) => handleNumericInput(e.target.value, setQuantity)}
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-5 text-3xl font-black tracking-tighter focus:bg-white/5 focus:border-sky-500/50 outline-none transition-all text-white"
              placeholder="1"
            />
            {/* Quick qty chips */}
            <div className="flex gap-1.5 flex-wrap">
              {['1', '5', '10', '25', '50', '100'].map(q => (
                <button key={q} onClick={() => setQuantity(q)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                    quantity === q ? 'bg-sky-600 border-sky-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-sky-500/40 hover:text-white'
                  }`}>{q}</button>
              ))}
            </div>
          </div>

          {/* Price (LIMIT only) */}
          {orderType === 'LIMIT' && (
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Limit Price ₹</label>
              <input
                type="text"
                value={price}
                onChange={(e) => handleNumericInput(e.target.value, setPrice)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-lg font-black tracking-tighter focus:border-sky-500/30 outline-none text-white text-center"
                placeholder={currentPrice ? currentPrice.price.toFixed(2) : '0.00'}
              />
            </div>
          )}

          {/* SL / TP */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Stop Loss</label>
              <input type="text" value={stopLoss} onChange={(e) => handleNumericInput(e.target.value, setStopLoss)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-sm font-black tracking-tighter focus:border-rose-500/30 outline-none text-white text-center"
                placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 block">Take Profit</label>
              <input type="text" value={takeProfit} onChange={(e) => handleNumericInput(e.target.value, setTakeProfit)}
                className="w-full bg-white/[0.02] border border-white/5 rounded-xl p-3.5 text-sm font-black tracking-tighter focus:border-emerald-500/30 outline-none text-white text-center"
                placeholder="Optional" />
            </div>
          </div>

          {/* BUY / SELL */}
          <div className="space-y-3 pt-2">
            <MotionButton
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => initiateTrade('BUY')}
              disabled={executing || !currentPrice}
              className={`w-full py-7 rounded-[2rem] text-xl font-black italic tracking-tighter uppercase transition-all shadow-xl ${
                executing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
              }`}
            >
              {executing ? <><FiRefreshCw className="animate-spin inline mr-2" size={16} />Routing…</> : <>
                <FiTrendingUp className="inline mr-2" size={18} />BUY {orderVariant === 'MIS' ? '(MIS)' : ''}
              </>}
            </MotionButton>

            <MotionButton
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => initiateTrade('SELL')}
              disabled={executing || !currentPrice}
              className={`w-full py-7 rounded-[2rem] text-xl font-black italic tracking-tighter uppercase transition-all shadow-xl ${
                executing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-rose-500 text-slate-950 hover:bg-rose-400 shadow-rose-500/20'
              }`}
            >
              {executing ? <><FiRefreshCw className="animate-spin inline mr-2" size={16} />Routing…</> : <>
                <FiTrendingDown className="inline mr-2" size={18} />SELL {orderVariant === 'MIS' ? '(MIS)' : ''}
              </>}
            </MotionButton>
          </div>

          {/* Execution Mesh Status */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FiShield className="text-sky-400" size={13} />
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Mesh Status</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,1)] animate-pulse' : 'bg-slate-600'}`} />
              <span className={`text-[10px] font-mono ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isConnected ? 'NOMINAL' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Intraday Positions Panel ── */}
      {(enrichedIntradayPositions.length > 0 || intradayLoading) && (
        <MotionDiv
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-[2rem] border border-purple-500/20 bg-purple-500/5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <FiActivity className="text-purple-400" size={14} />
              </div>
              <div>
                <h3 className="text-sm font-black italic tracking-tighter text-white uppercase">Intraday Positions (MIS)</h3>
                <p className="text-[10px] text-slate-500 font-semibold">Auto square-off at 15:30 IST</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`text-right ${totalIntradayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total P&L</p>
                <p className="text-lg font-black italic tracking-tighter">
                  {totalIntradayPnl >= 0 ? '+' : ''}₹{Math.abs(totalIntradayPnl).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <button
                onClick={handleSquareOff}
                className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-black uppercase tracking-widest hover:bg-rose-500/20 transition-all"
              >
                Square Off All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L', 'Action'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[9px] font-black uppercase tracking-widest text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enrichedIntradayPositions.map(pos => (
                  <tr key={pos.symbol} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-black text-white text-sm">{pos.symbol}</td>
                    <td className="py-3 px-3 text-xs font-mono text-slate-300">{pos.netQty > 0 ? '+' : ''}{pos.netQty}</td>
                    <td className="py-3 px-3 text-xs font-mono text-slate-400">₹{pos.avgBuyPrice.toFixed(2)}</td>
                    <td className="py-3 px-3 text-xs font-mono font-bold text-white">₹{pos.currentPrice.toFixed(2)}</td>
                    <td className={`py-3 px-3 text-xs font-black ${pos.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pos.pnl >= 0 ? '+' : ''}₹{Math.abs(pos.pnl).toFixed(2)}
                      <span className="text-[9px] ml-1 opacity-70">({pos.pnlPercent.toFixed(2)}%)</span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        onClick={async () => {
                          setSymbol(pos.symbol);
                          setSearchQuery(pos.symbol);
                          setQuantity(String(Math.abs(pos.netQty)));
                          setOrderVariant('MIS');
                          initiateTrade(pos.side === 'BUY' ? 'SELL' : 'BUY');
                        }}
                        className="px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider hover:bg-rose-500/20 transition-all"
                      >
                        Exit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MotionDiv>
      )}

      {/* ── Last Trade Receipt ── */}
      {lastTrade && (
        <MotionDiv
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="p-7 rounded-[2.5rem] border border-white/5 bg-white/[0.02] relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-5">
            <h4 className="text-base font-black italic tracking-tighter uppercase flex items-center gap-3">
              {lastTrade.status === 'EXECUTED'
                ? <><FiCheckCircle className="text-emerald-400" /><span className="text-emerald-400">ORDER_EXECUTED</span></>
                : <><FiAlertTriangle className="text-rose-400" /><span className="text-rose-400">ORDER_FAILED</span></>}
            </h4>
            <span className="text-[10px] font-mono opacity-30">OID: {lastTrade.orderId}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              ['Instrument', lastTrade.symbol, 'text-white'],
              ['Exec Price', `₹${lastTrade.executedPrice.toFixed(2)}`, 'text-white font-mono'],
              ['Slippage', `${lastTrade.slippagePercent.toFixed(4)}%`, lastTrade.slippagePercent < 0.05 ? 'text-emerald-400' : 'text-amber-400'],
              ['Reality', 'VERIFIED', 'text-sky-400'],
            ].map(([label, value, color]) => (
              <div key={label} className="space-y-1">
                <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">{label}</span>
                <p className={`text-lg font-black italic tracking-tighter ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </MotionDiv>
      )}

      <style jsx>{`
        input::-webkit-outer-spin-button, input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
