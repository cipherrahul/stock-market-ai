import React, { useState, useEffect, useRef } from 'react';
import { MotionDiv, MotionButton } from '@/components/Motion';
import { FiZap, FiSearch } from 'react-icons/fi';
import { useRealtimeTrading, validateTradeRequest } from '@/hooks/useRealtimeTrading';
import { useRealtimePrice } from '@/hooks/useRealtime';
import { SovereignChart } from './charts/SovereignChart';
import { CandlestickData, UTCTimestamp } from 'lightweight-charts';

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

interface TradingPanelProps {
  token: string;
  userId: string;
  isPaper?: boolean;
  defaultSymbol?: string;
  onTradeExecuted?: (trade: TradeExecutionResult) => void;
}

export function TradingPanelRealtime({
  token,
  userId,
  isPaper = false,
  defaultSymbol = 'RELIANCE',
  onTradeExecuted,
}: TradingPanelProps) {
  // Trading state
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');

  const [priceHistory, setPriceHistory] = useState<CandlestickData[]>([]);

  // Hooks
  const { executing, lastTrade, error, executeTrade, clearError, setError } = useRealtimeTrading(token, userId);
  const { prices, subscribe, unsubscribe } = useRealtimePrice(token);

  // Get current price for the symbol
  const currentPrice = prices.get(symbol.toUpperCase());

  // Subscribe to symbol on mount
  useEffect(() => {
    subscribe(symbol.toUpperCase());
    setPriceHistory([]); // Reset history on symbol change
    return () => unsubscribe(symbol.toUpperCase());
  }, [symbol, subscribe, unsubscribe]);

  // Update Price History buffer (Candlestick Grouping)
  useEffect(() => {
    if (currentPrice) {
      const timestamp = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const roundedTime = (Math.floor(timestamp / 60) * 60) as UTCTimestamp; // 1-minute candles

      setPriceHistory(prev => {
        const lastCandle = prev[prev.length - 1];
        
        if (lastCandle && lastCandle.time === roundedTime) {
          // Update existing candle
          const updatedCandle = {
            ...lastCandle,
            high: Math.max(lastCandle.high, currentPrice.price),
            low: Math.min(lastCandle.low, currentPrice.price),
            close: currentPrice.price,
          };
          return [...prev.slice(0, -1), updatedCandle];
        } else {
          // Start new candle
          const newCandle: CandlestickData = {
            time: roundedTime,
            open: currentPrice.price,
            high: currentPrice.price,
            low: currentPrice.price,
            close: currentPrice.price,
          };
          const next = [...prev, newCandle];
          if (next.length > 100) return next.slice(1);
          return next;
        }
      });
    }
  }, [currentPrice]);

  // Auto-fill price with current price
  useEffect(() => {
    if (!price && currentPrice) {
      setPrice(currentPrice.price.toFixed(2));
    }
  }, [currentPrice, price]);

  // Handle buy trade
  const handleBuy = async () => {
    const validation = validateTradeRequest({
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: 'BUY',
      price: price ? parseFloat(price) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });

    if (!validation.valid) {
      setError(validation.error || 'Invalid trade request');
      return;
    }

    const trade = await executeTrade({
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: 'BUY',
      price: price ? parseFloat(price) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      isPaper,
    });

    if (trade.status === 'EXECUTED') {
      onTradeExecuted?.(trade);
      // Reset form
      setQuantity('1');
      setPrice('');
      setStopLoss('');
      setTakeProfit('');
    }
  };

  // Handle sell trade
  const handleSell = async () => {
    const validation = validateTradeRequest({
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: 'SELL',
      price: price ? parseFloat(price) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });

    if (!validation.valid) {
      setError(validation.error || 'Invalid trade request');
      return;
    }

    const trade = await executeTrade({
      symbol: symbol.toUpperCase(),
      quantity: parseInt(quantity),
      side: 'SELL',
      price: price ? parseFloat(price) : undefined,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
      isPaper,
    });

    if (trade.status === 'EXECUTED') {
      onTradeExecuted?.(trade);
      // Reset form
      setQuantity('1');
      setPrice('');
      setStopLoss('');
      setTakeProfit('');
    }
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-10 border-glow relative overflow-hidden">
      <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
        <h2 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-3">
          <FiZap className="text-amber-400" /> EXECUTION TERMINAL
        </h2>
        <div className="flex gap-2">
            <span className="text-[10px] px-3 py-1 bg-white/5 rounded-full opacity-40 font-bold uppercase tracking-widest">Type: BRACKET_ORDER</span>
        </div>
      </div>

      {error && (
        <MotionDiv 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex justify-between items-start"
        >
          <div className="flex gap-3">
            <span className="text-xl">⚠️</span>
            <p className="font-medium leading-relaxed italic">"{error}"</p>
          </div>
          <button className="opacity-40 hover:opacity-100 transition-opacity" onClick={clearError}>✕</button>
        </MotionDiv>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8">
            {/* Symbol Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Instrument Cluster</label>
              <div className="relative group">
                <input
                    type="text"
                    value={symbol}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSymbol(e.target.value.toUpperCase())}
                    className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-xl font-black tracking-tighter focus:bg-white/[0.05] focus:border-blue-500/50 outline-none transition-all placeholder:opacity-20 uppercase"
                    placeholder="e.g., RELIANCE"
                    disabled={executing}
                    maxLength={10}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 group-focus-within:opacity-100 transition-opacity">
                    <FiSearch className="text-xl" />
                </div>
              </div>
              
              {currentPrice && (
                <div className="flex justify-between items-center px-4 py-3 bg-white/[0.02] rounded-2xl border border-white/5">
                  <span className="text-sm font-bold opacity-60">Spot Value</span>
                  <div className="text-right">
                    <p className="text-xl font-black tracking-tighter">₹{currentPrice.price.toLocaleString()}</p>
                    <p className={`text-[10px] font-black uppercase ${currentPrice.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {currentPrice.change >= 0 ? '↑' : '↓'} {Math.abs(currentPrice.changePercent).toFixed(2)}% (D: {currentPrice.change.toFixed(2)})
                    </p>
                  </div>
                </div>
              )}

              {/* TIC GRAPH INTEGRATION */}
              <div className="h-[250px] w-full relative overflow-hidden group">
                <div className="absolute top-4 left-6 z-10">
                    <span className="text-[8px] font-black text-emerald-400/50 uppercase tracking-[0.4em] italic">Real-Time Alpha Tick Feed</span>
                </div>
                <SovereignChart data={priceHistory} />
              </div>
            </div>

            {/* Quantity Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Volume Density</label>
              <input
                type="number"
                value={quantity}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-xl font-black tracking-tighter focus:bg-white/[0.05] focus:border-blue-500/50 outline-none transition-all"
                placeholder="1"
                min="1"
                max="100000"
                disabled={executing}
              />
            </div>

            {/* Price Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Market Constraint (Optional)</label>
              <input
                type="number"
                value={price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
                className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-xl font-black tracking-tighter focus:bg-white/[0.05] focus:border-blue-500/50 outline-none transition-all placeholder:opacity-20"
                placeholder={currentPrice ? currentPrice.price.toFixed(2) : 'FLOATING'}
                step="0.01"
                disabled={executing}
              />
              {currentPrice && (
                <div className="flex justify-between px-4 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                  <span>Bid: ₹{currentPrice.bid.toFixed(2)}</span>
                  <span>Ask: ₹{currentPrice.ask.toFixed(2)}</span>
                </div>
              )}
            </div>
        </div>

        <div className="space-y-8">
            {/* Risk Management Section */}
            <div className="p-8 rounded-[2.5rem] bg-indigo-500/[0.03] border border-indigo-500/10 space-y-6">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] italic mb-4">Risk Constraints</h4>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Stop Loss</label>
                        <input
                            type="number"
                            value={stopLoss}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStopLoss(e.target.value)}
                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-sm font-black tracking-tighter focus:border-rose-500/30 outline-none transition-all"
                            placeholder="e.g., 2450"
                            step="0.01"
                            disabled={executing}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Take Profit</label>
                        <input
                            type="number"
                            value={takeProfit}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTakeProfit(e.target.value)}
                            className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-sm font-black tracking-tighter focus:border-emerald-500/30 outline-none transition-all"
                            placeholder="e.g., 2600"
                            step="0.01"
                            disabled={executing}
                        />
                    </div>
                </div>

                {/* Trade Summary */}
                {quantity && currentPrice && (
                    <div className="pt-6 border-t border-indigo-500/10 space-y-3">
                        <div className="flex justify-between text-xs font-bold opacity-40">
                            <span>Theoretical Value</span>
                            <span className="font-mono">₹{(parseInt(quantity) * (price ? parseFloat(price) : currentPrice.price)).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-lg font-black italic tracking-tighter">
                            <span className="text-slate-200">Execution Delta</span>
                            <span className="text-blue-400">₹{(parseInt(quantity) * (price ? parseFloat(price) : currentPrice.price)).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Trade Buttons */}
            <div className="grid grid-cols-2 gap-6 pt-4">
              <MotionButton
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBuy}
                disabled={executing || !currentPrice}
                className={`py-6 rounded-[2rem] text-xl font-black italic tracking-tighter uppercase transition-all shadow-xl ${
                    executing ? 'bg-slate-800 text-slate-500' : 'bg-emerald-500 text-slate-950 shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:bg-emerald-400'
                }`}
              >
                {executing ? 'LOCKING...' : 'BUY ALPHA'}
              </MotionButton>
              
              <MotionButton
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSell}
                disabled={executing || !currentPrice}
                className={`py-6 rounded-[2rem] text-xl font-black italic tracking-tighter uppercase transition-all shadow-xl ${
                    executing ? 'bg-slate-800 text-slate-500' : 'bg-rose-500 text-slate-950 shadow-rose-500/20 hover:shadow-rose-500/40 hover:bg-rose-400'
                }`}
              >
                {executing ? 'LOCKING...' : 'SELL RISK'}
              </MotionButton>
            </div>
            
            <p className="text-[9px] text-center text-slate-600 font-bold uppercase tracking-[0.2em] pt-2 italic">
                Execution monitored by Sovereign Risk Mesh v3.1
            </p>
        </div>
      </div>

      {/* Last Trade Status Card */}
      {lastTrade && (
        <MotionDiv 
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`mt-16 p-8 rounded-[3rem] border-glow bg-white/[0.02] relative overflow-hidden`}
        >
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
            <h4 className="text-lg font-black italic tracking-tighter uppercase flex items-center gap-3">
              {lastTrade.status === 'EXECUTED' ? <span className="text-emerald-400">✅ ORDER_EXECUTED</span> : <span className="text-rose-400">❌ ORDER_FAILED</span>}
            </h4>
            <span className="text-[10px] font-mono opacity-40">OID: {lastTrade.orderId}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-1">
                <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Instrument</span>
                <p className="text-xl font-black italic tracking-tighter opacity-80 uppercase">{lastTrade.symbol}</p>
            </div>
            <div className="space-y-1">
                <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Base Px</span>
                <p className="text-xl font-mono tracking-tighter opacity-80 uppercase">₹{lastTrade.executedPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-1">
                <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Slippage</span>
                <p className={`text-xl font-black italic tracking-tighter ${lastTrade.slippagePercent < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {lastTrade.slippagePercent.toFixed(4)}%
                </p>
            </div>
            <div className="space-y-1 text-right">
                <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Execution Reality</span>
                <p className="text-xl font-black italic tracking-tighter uppercase text-blue-400">CONFIRMED</p>
            </div>
          </div>
        </MotionDiv>
      )}

      <style jsx>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
