'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { EmptyState, PageIntro, SectionCard } from '@/components/EnterpriseUI';
import { useRealtimePrice } from '@/hooks/useRealtime';
import { useRealtimeTrading, validateTradeRequest } from '@/hooks/useRealtimeTrading';
import { useIntradayPositions, useSquareOffTimer } from '@/hooks/useRealtime';
import { SovereignChart } from '@/components/charts/SovereignChart';
import { useCandlestickData, ChartTimeframe } from '@/hooks/useCandlestickData';
import {
  FiSearch, FiTrendingUp, FiTrendingDown, FiClock,
  FiAlertTriangle, FiRefreshCw, FiCheckCircle, FiShield,
  FiZap, FiInfo,
} from 'react-icons/fi';
import axios from 'axios';

const DEFAULT_WATCHLIST = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'TATASTEEL', 'SBIN', 'AAPL', 'NVDA'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface IntradayIndicators {
  vwap?: { vwap: number; upper_1: number; lower_1: number; upper_2: number; lower_2: number };
  orb?: { orb_high: number; orb_low: number; breakout: string; range_pct: number };
  rvol?: { rvol: number; status: string; current_vol: number; avg_vol: number };
  supertrend?: { trend: string; stop_line: number };
  session?: { phase: string; trade_allowed: boolean; ist_time: string; guidance: string };
}

export default function TradingPage() {
  const router = useRouter();
  const token  = typeof localStorage !== 'undefined' ? localStorage.getItem('token')  || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  const [symbol, setSymbol] = useState('RELIANCE');
  const [symbolInput, setSymbolInput] = useState('RELIANCE');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [orderVariant, setOrderVariant] = useState<'CNC' | 'MIS'>('MIS');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Intraday Alpha Metrics & Sizing State
  const [indicators, setIndicators] = useState<IntradayIndicators | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(false);
  const [riskPercent, setRiskPercent] = useState('1.0');
  const [accountCapital] = useState(100000); // Institutional baseline for risk calculation

  const { prices, connected, subscribe, unsubscribe } = useRealtimePrice(token);
  const { executeTrade, executing, error, retryCount, lastTrade, squareOffAll } = useRealtimeTrading(token, userId);
  const { positions: intradayPositions, loading: intradayLoading, refetch: refetchIntraday } = useIntradayPositions(token, userId);
  const { secondsLeft, marketOpen, warningLevel, formatCountdown } = useSquareOffTimer();

  useEffect(() => {
    if (!token) router.push('/login');
  }, [router, token]);

  useEffect(() => {
    DEFAULT_WATCHLIST.forEach(subscribe);
    return () => DEFAULT_WATCHLIST.forEach(unsubscribe);
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    subscribe(symbol);
    return () => unsubscribe(symbol);
  }, [subscribe, symbol, unsubscribe]);

  // Fetch Intraday Institutional Indicators (VWAP, ORB, RVOL, Supertrend, Session)
  useEffect(() => {
    let isCurrent = true;
    const fetchIndicators = async () => {
      setIndicatorsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/v1/agents/indicators/${symbol}?interval=5m`, { timeout: 5000 });
        if (isCurrent && res.data?.intraday) {
          setIndicators(res.data.intraday);
        }
      } catch {
        // graceful offline fallback
      } finally {
        if (isCurrent) setIndicatorsLoading(false);
      }
    };
    fetchIndicators();
    const interval = setInterval(fetchIndicators, 20000);
    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, [symbol]);

  const [chartTimeframe, setChartTimeframe] = useState<ChartTimeframe>('5m');
  const selectedPrice = prices.get(symbol.toUpperCase());
  const { candles, latestCandle, loading: candlesLoading } = useCandlestickData({
    symbol,
    timeframe: chartTimeframe,
    livePrice: selectedPrice?.price,
  });

  const watchlistRows = useMemo(
    () => DEFAULT_WATCHLIST.map(item => prices.get(item)).filter(Boolean),
    [prices]
  );

  // ── Symbol Search ────────────────────────────────────────────────────────────
  const handleSearchInput = (val: string) => {
    setSymbolInput(val.toUpperCase());
    setShowDropdown(true);
    if (searchDebRef.current) clearTimeout(searchDebRef.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchDebRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await axios.get(`${API_URL}/api/v1/market/search?q=${encodeURIComponent(val.toUpperCase())}`, { timeout: 4000 });
        setSearchResults(res.data?.results || []);
      } catch { /* silent */ } finally { setSearchLoading(false); }
    }, 300);
  };

  const selectSymbol = async (sym: string) => {
    const upper = sym.toUpperCase();
    setSymbol(upper);
    setSymbolInput(upper);
    setShowDropdown(false);
    setSearchResults([]);
    try {
      await axios.post(`${API_URL}/api/v1/market/subscribe`, { symbol: upper }, { timeout: 6000 });
      subscribe(upper);
    } catch { /* already tracked */ }
  };

  // ── Trade Execution ──────────────────────────────────────────────────────────
  const submitTrade = async (side: 'BUY' | 'SELL') => {
    const request = {
      symbol: symbol.toUpperCase(),
      quantity: Number(quantity),
      side,
      price: price ? Number(price) : selectedPrice?.price,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      orderVariant,
    };
    const validation = validateTradeRequest(request);
    if (!validation.valid) { toast.error(validation.error || 'Invalid trade request'); return; }
    const response = await executeTrade(request);
    if (response.status === 'EXECUTED') {
      const modeLabel = orderVariant === 'MIS' ? 'Intraday (MIS)' : 'Delivery (CNC)';
      toast.success(`${side} ${quantity} ${symbol} executed (${modeLabel}) @ ₹${response.executedPrice?.toFixed(2) || 'market'}`);
      if (orderVariant === 'MIS') setTimeout(refetchIntraday, 1200);
    } else {
      toast.error(response.error || 'Trade failed');
    }
  };

  // ── Emergency 1-Click Square-Off ─────────────────────────────────────────────
  const handleSquareOff = async () => {
    const toastId = toast.loading('Squaring off all open intraday (MIS) positions…');
    try {
      const result = await squareOffAll(userId);
      toast.success(`${result.squaredOff} position(s) squared off!`, { id: toastId });
      setTimeout(refetchIntraday, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Square-off failed', { id: toastId });
    }
  };

  // ── Risk & Position Sizing Calculator ────────────────────────────────────────
  const applyRiskSizing = () => {
    const p = price ? Number(price) : (selectedPrice?.price || 0);
    const sl = Number(stopLoss);
    if (!p || !sl || p === sl) {
      toast.error('Please enter a valid Price and Stop Loss to calculate sizing');
      return;
    }
    const maxRiskRupees = accountCapital * (Number(riskPercent) / 100);
    const perShareRisk = Math.abs(p - sl);
    const calcQty = Math.max(1, Math.floor(maxRiskRupees / perShareRisk));
    setQuantity(String(calcQty));
    toast.success(`Calculated sizing: ${calcQty} shares (Risk: ₹${maxRiskRupees.toFixed(0)} / ${riskPercent}%)`);
  };

  const applyAtrBracket = (side: 'BUY' | 'SELL') => {
    const p = price ? Number(price) : (selectedPrice?.price || 0);
    if (!p) {
      toast.error('Waiting for quote price');
      return;
    }
    const estimatedAtr = p * 0.012; // 1.2% typical intraday ATR
    if (side === 'BUY') {
      const sl = Math.max(0.05, p - (1.5 * estimatedAtr));
      const tp = p + (3.0 * estimatedAtr); // 1:2 R:R
      setStopLoss(sl.toFixed(2));
      setTakeProfit(tp.toFixed(2));
      toast.success(`1.5x ATR Stop: ₹${sl.toFixed(2)} | 1:2 Target: ₹${tp.toFixed(2)}`);
    } else {
      const sl = p + (1.5 * estimatedAtr);
      const tp = Math.max(0.05, p - (3.0 * estimatedAtr)); // 1:2 R:R
      setStopLoss(sl.toFixed(2));
      setTakeProfit(tp.toFixed(2));
      toast.success(`1.5x ATR Short Stop: ₹${sl.toFixed(2)} | 1:2 Target: ₹${tp.toFixed(2)}`);
    }
  };

  // Enrich intraday P&L with live prices
  const enrichedPositions = intradayPositions.map(pos => {
    const livePrice = prices.get(pos.symbol)?.price || pos.avgBuyPrice;
    const pnl = (livePrice - pos.avgBuyPrice) * pos.netQty;
    const pnlPct = pos.avgBuyPrice > 0 ? (pnl / (pos.avgBuyPrice * Math.abs(pos.netQty))) * 100 : 0;
    return { ...pos, currentPrice: livePrice, pnl, pnlPct };
  });
  const totalPnl = enrichedPositions.reduce((s, p) => s + p.pnl, 0);

  // Session phase badge styling
  const sessionPhase = indicators?.session?.phase || (marketOpen ? 'PRIME_TREND' : 'MARKET_CLOSED');
  const sessionPhaseConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
    ORB_SETUP: { label: '⏱️ Opening Range Setup (09:15–09:45)', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    PRIME_TREND: { label: '⚡ Prime Alpha Window (09:45–11:30)', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    MIDDAY_CHOP: { label: '⚠️ Midday Chop Caution (11:30–13:00)', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    POWER_HOUR: { label: '🚀 Afternoon Expansion (13:00–15:00)', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    SQUARE_OFF_ONLY: { label: '🚨 Square-Off Zone (15:00–15:15)', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
    MARKET_CLOSING: { label: '🛑 Terminal Auto Square-Off (15:15–15:30)', color: 'text-rose-800', bg: 'bg-rose-100', border: 'border-rose-300' },
    MARKET_CLOSED: { label: '🌙 Market Closed · Simulation Active', color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  };
  const activeSessionCfg = sessionPhaseConfig[sessionPhase] || sessionPhaseConfig.MARKET_CLOSED;

  const currentPriceNum = selectedPrice?.price || 0;
  const vwapVal = indicators?.vwap?.vwap;
  const vwapBias = vwapVal && currentPriceNum ? (currentPriceNum >= vwapVal ? 'ABOVE_VWAP' : 'BELOW_VWAP') : null;

  return (
    <Layout>
      <div className="space-y-6">

        {/* ── Page Header ── */}
        <PageIntro
          badge="Intraday Pro Cockpit"
          title="Institutional Execution Desk"
          description="High-frequency intraday trading workspace with institutional VWAP, 15m Opening Range Breakout (ORB), RVOL filtering, short-selling, and automated 15:15 IST square-off protection."
          actions={
            <div className="flex items-center gap-3">
              {marketOpen && (
                <span className={`status-pill flex items-center gap-1.5 text-xs font-bold ${
                  warningLevel === 'urgent' ? 'bg-rose-50 text-rose-700' :
                  warningLevel === '15min' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  <FiClock size={11} />
                  Square-Off: {formatCountdown(secondsLeft)}
                  {warningLevel && ' ⚠️'}
                </span>
              )}
              <span className={`status-pill ${connected ? 'bg-emerald-50 text-emerald-700' : ''}`}>
                {connected ? 'Realtime Feed Active' : 'Connecting…'}
              </span>
            </div>
          }
        />

        {/* ── Market Session Phase Radar Banner ── */}
        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl border ${activeSessionCfg.bg} ${activeSessionCfg.border}`}>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full bg-white shadow-xs ${activeSessionCfg.color}`}>
              {activeSessionCfg.label}
            </span>
            <p className="text-xs font-medium text-slate-700">
              {indicators?.session?.guidance || 'Intraday multi-agent consensus and ATR risk parameters active.'}
            </p>
          </div>
          {enrichedPositions.length > 0 && (
            <button
              onClick={handleSquareOff}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <FiZap size={12} /> Emergency Square Off All ({enrichedPositions.length})
            </button>
          )}
        </div>

        {/* ── Institutional Technicals Ribbon for Active Symbol ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* VWAP Benchmark */}
          <div className="app-card-muted p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                VWAP Benchmark {indicatorsLoading && <FiRefreshCw className="animate-spin text-slate-400" size={10} />}
              </span>
              {vwapBias && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  vwapBias === 'ABOVE_VWAP' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {vwapBias === 'ABOVE_VWAP' ? 'BULLISH BIAS' : 'BEARISH BIAS'}
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {vwapVal ? `₹${vwapVal.toFixed(2)}` : 'Calculating…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {indicators?.vwap ? `±1σ: ₹${indicators.vwap.lower_1} – ₹${indicators.vwap.upper_1}` : 'Volume Weighted Average'}
            </p>
          </div>

          {/* Opening Range (ORB) */}
          <div className="app-card-muted p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">15m ORB Range</span>
              {indicators?.orb?.breakout && indicators.orb.breakout !== 'INSIDE_RANGE' && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  indicators.orb.breakout === 'BULLISH_BREAKOUT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {indicators.orb.breakout === 'BULLISH_BREAKOUT' ? 'BREAKOUT' : 'BREAKDOWN'}
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {indicators?.orb ? `₹${indicators.orb.orb_high} / ₹${indicators.orb.orb_low}` : 'Tracking…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {indicators?.orb ? `Range: ${indicators.orb.range_pct}%` : 'Opening 15-min High/Low'}
            </p>
          </div>

          {/* Relative Volume (RVOL) */}
          <div className="app-card-muted p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">RVOL Volume</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                (indicators?.rvol?.rvol || 1) >= 1.5 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {indicators?.rvol?.status || 'NORMAL'}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {indicators?.rvol?.rvol ? `${indicators.rvol.rvol}x` : '1.0x'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {(indicators?.rvol?.rvol || 1) >= 1.5 ? 'Institutional volume surge' : 'Baseline 20-bar volume'}
            </p>
          </div>

          {/* Supertrend / Trailing Stop */}
          <div className="app-card-muted p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Supertrend</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                indicators?.supertrend?.trend === 'BULLISH' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {indicators?.supertrend?.trend || 'NEUTRAL'}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
              {indicators?.supertrend?.stop_line ? `₹${indicators.supertrend.stop_line.toFixed(2)}` : 'Aligning…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dynamic ATR Trailing Stop
            </p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">

          {/* ── Order Ticket & Intraday Controls ── */}
          <div className="space-y-4">
            <SectionCard title="Order Ticket" description="Place intraday (MIS) with short-selling support or delivery (CNC) orders.">
              <div className="grid gap-4">

                {/* Symbol Search */}
                <div className="relative">
                  <label className="block mb-2">
                    <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <FiSearch size={13} /> Symbol Search
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      value={symbolInput}
                      onChange={(e) => handleSearchInput(e.target.value)}
                      onFocus={() => symbolInput && setShowDropdown(true)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && symbolInput.trim()) selectSymbol(symbolInput.trim()); }}
                      className="input-field pr-8 uppercase font-bold tracking-wide"
                      placeholder="RELIANCE, TCS, INFY, NVDA…"
                      autoComplete="off"
                    />
                    {searchLoading && <FiRefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" size={13} />}
                  </div>
                  {showDropdown && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden">
                      {searchResults.map(r => (
                        <button key={r.symbol} onClick={() => selectSymbol(r.symbol)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 last:border-0">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{r.symbol}</p>
                            <p className="text-xs text-slate-400 truncate max-w-[180px]">{r.name}</p>
                          </div>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg font-bold shrink-0">{r.exchange}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* CNC / MIS Toggle */}
                <div>
                  <span className="text-sm font-semibold text-slate-700 block mb-2">Execution Product Type</span>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                    {(['MIS', 'CNC'] as const).map(v => (
                      <button key={v} onClick={() => setOrderVariant(v)}
                        className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-all ${orderVariant === v
                          ? v === 'MIS' ? 'bg-purple-600 text-white' : 'bg-sky-600 text-white'
                          : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                        {v === 'MIS' ? 'MIS · Intraday Margin' : 'CNC · Cash Delivery'}
                      </button>
                    ))}
                  </div>
                  {orderVariant === 'MIS' ? (
                    <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-2 text-xs text-purple-800">
                      <FiInfo className="shrink-0 mt-0.5 text-purple-600" size={13} />
                      <div>
                        <span className="font-bold">Short Selling Enabled:</span> You can SELL first to profit from downward moves. Auto-squared off at 15:15 IST without overnight risk.
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                      Delivery mode: Requires holding shares in portfolio before selling.
                    </p>
                  )}
                </div>

                {/* Quantity & Price */}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Quantity (Shares)</span>
                    <input
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      type="number"
                      min="1"
                      className="input-field font-mono"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Limit Price (₹)</span>
                    <input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Market price"
                      className="input-field font-mono"
                    />
                  </label>
                </div>

                {/* Stop Loss & Take Profit */}
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Stop Loss (₹)</span>
                      <button
                        type="button"
                        onClick={() => applyAtrBracket('BUY')}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        Auto 1.5x ATR
                      </button>
                    </div>
                    <input
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="Protection price"
                      className="input-field font-mono"
                    />
                  </label>
                  <label className="block">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">Take Profit (₹)</span>
                      <button
                        type="button"
                        onClick={() => applyAtrBracket('BUY')}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        1:2 R:R
                      </button>
                    </div>
                    <input
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="Target price"
                      className="input-field font-mono"
                    />
                  </label>
                </div>

                {/* Position Sizing Risk Calculator */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FiShield className="text-blue-600" size={13} /> Capital Risk Sizing
                    </span>
                    <div className="flex items-center gap-1.5">
                      {['0.5', '1.0', '2.0'].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setRiskPercent(pct)}
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${riskPercent === pct ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Max Loss: ₹{(accountCapital * (Number(riskPercent) / 100)).toFixed(0)} ({riskPercent}%)</span>
                    <button
                      type="button"
                      onClick={applyRiskSizing}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700"
                    >
                      Calculate & Apply Qty →
                    </button>
                  </div>
                </div>

                {/* Market Snapshot Card */}
                <div className="app-card-muted p-4 space-y-2.5 rounded-xl border border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Order Estimation · {symbol}</p>
                  {selectedPrice ? (
                    <>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Live LTP</span>
                        <span className="font-bold text-slate-900 font-mono">₹{selectedPrice.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Bid / Ask</span>
                        <span className="font-semibold text-slate-900 font-mono">{selectedPrice.bid.toFixed(2)} / {selectedPrice.ask.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Turnover Value</span>
                        <span className="font-bold text-slate-900 font-mono">
                          ₹{((Number(quantity) || 0) * (price ? Number(price) : selectedPrice.price)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">Waiting for live quote stream…</p>
                  )}
                </div>

                {/* Retry indicator */}
                {retryCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl text-xs text-amber-700 font-semibold">
                    <FiRefreshCw className="animate-spin" size={12} />
                    Retrying (attempt {retryCount + 1}/3)…
                  </div>
                )}

                {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}

                {/* Order Action Buttons */}
                <div className="grid gap-3 md:grid-cols-2 pt-2">
                  <button
                    type="button"
                    onClick={() => submitTrade('BUY')}
                    disabled={executing || !selectedPrice}
                    className="primary-button w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <FiTrendingUp size={16} />
                    {executing ? 'Routing Order…' : 'Buy / Long'}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitTrade('SELL')}
                    disabled={executing || !selectedPrice}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all"
                  >
                    <FiTrendingDown size={16} />
                    {executing ? 'Routing Order…' : (orderVariant === 'MIS' ? 'Sell / Short' : 'Sell')}
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Intraday Active MIS Positions */}
            {(enrichedPositions.length > 0 || intradayLoading) && (
              <SectionCard
                title={`Active Intraday Positions (MIS) ${enrichedPositions.length > 0 ? `· ${enrichedPositions.length}` : ''}`}
                description="Live intraday exposure auto-liquidated before 15:30 IST to avoid overnight gap risk."
              >
                {intradayLoading && enrichedPositions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Loading positions…</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div>
                        <p className="text-xs text-slate-500 font-medium">Session Intraday P&L</p>
                        <p className={`text-xl font-bold font-mono ${totalPnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {totalPnl >= 0 ? '+' : ''}₹{Math.abs(totalPnl).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <button
                        onClick={handleSquareOff}
                        className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all shadow-xs"
                      >
                        Square Off All MIS
                      </button>
                    </div>
                    {enrichedPositions.map(pos => (
                      <div key={pos.symbol} className="app-card-muted p-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 text-sm">{pos.symbol}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.netQty > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {pos.netQty > 0 ? 'LONG' : 'SHORT'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {Math.abs(pos.netQty)} units · Avg ₹{pos.avgBuyPrice.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 font-mono">₹{pos.currentPrice.toFixed(2)}</p>
                          <p className={`text-xs font-bold font-mono ${pos.pnl >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {pos.pnl >= 0 ? '+' : ''}₹{Math.abs(pos.pnl).toFixed(2)} ({pos.pnlPct.toFixed(2)}%)
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            )}
          </div>

          {/* ── Right Side: Live Candlestick Cockpit & Market Watch ── */}
          <div className="space-y-6">
            {/* Live Interactive Candlestick Chart */}
            <SovereignChart
              symbol={symbol}
              timeframe={chartTimeframe}
              onTimeframeChange={setChartTimeframe}
              data={candles}
              latestCandle={latestCandle}
              loading={candlesLoading}
              height={440}
            />

            {/* Market Watch */}
            <SectionCard title="Market Watch" description="Live streaming quotes across active instruments. Click to select.">
              {watchlistRows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {['Symbol', 'Last', 'Change', 'Bid', 'Ask'].map(h => (
                          <th key={h} className="table-header py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {watchlistRows.map(quote => (
                        <tr
                          key={quote?.symbol}
                          onClick={() => quote?.symbol && selectSymbol(quote.symbol)}
                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <td className="table-cell font-bold text-slate-900">
                            <div className="flex items-center gap-2">
                              {symbol === quote?.symbol && <div className="w-2 h-2 rounded-full bg-blue-600 shrink-0 animate-pulse" />}
                              {quote?.symbol}
                            </div>
                          </td>
                          <td className="table-cell font-mono font-bold text-slate-900">₹{quote?.price.toFixed(2)}</td>
                          <td className={`table-cell font-semibold ${(quote?.change || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {(quote?.change || 0) >= 0 ? '+' : ''}{quote?.change.toFixed(2)} ({quote?.changePercent.toFixed(2)}%)
                          </td>
                          <td className="table-cell font-mono text-slate-500">{quote?.bid.toFixed(2)}</td>
                          <td className="table-cell font-mono text-slate-500">{quote?.ask.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Waiting for quotes" description="Market data stream is connected. Prices will appear momentarily." />
              )}
            </SectionCard>

            {/* Last Execution Card */}
            <SectionCard title="Last Execution" description="Most recent order confirmation returned by the execution fleet.">
              {lastTrade ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {lastTrade.status === 'EXECUTED'
                      ? <><FiCheckCircle className="text-emerald-600" size={16} /><span className="font-bold text-emerald-700 text-sm">Order Executed Successfully</span></>
                      : <><FiAlertTriangle className="text-rose-600" size={16} /><span className="font-bold text-rose-700 text-sm">Order Rejected</span></>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['Symbol', lastTrade.symbol],
                      ['Side / Mode', `${lastTrade.side} (${lastTrade.orderVariant || 'MIS'})`],
                      ['Executed Price', `₹${lastTrade.executedPrice.toFixed(2)}`],
                      ['Slippage', `${lastTrade.slippagePercent.toFixed(4)}%`],
                    ].map(([label, value]) => (
                      <div key={label} className="app-card-muted p-3 rounded-xl border border-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
                        <p className="mt-1 text-base font-bold text-slate-900 font-mono">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="No trades yet" description="Place an order above to see instant confirmation and slippage telemetry." />
              )}
            </SectionCard>

          </div>
        </div>
      </div>
    </Layout>
  );
}
