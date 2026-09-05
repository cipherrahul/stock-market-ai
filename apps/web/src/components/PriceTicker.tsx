import { useEffect } from 'react';
import { MotionDiv, AnimatePresence } from '@/components/Motion';
import { FiGlobe } from 'react-icons/fi';
import { useRealtimePrice } from '@/hooks/useRealtime';

interface PriceTickerProps {
  symbols: string[];
  token: string;
}

export function PriceTicker({ symbols, token }: PriceTickerProps) {
  const { prices, connected, subscribe, unsubscribe, error } = useRealtimePrice(token);

  useEffect(() => {
    symbols.forEach((symbol) => subscribe(symbol));
    return () => symbols.forEach((symbol) => unsubscribe(symbol));
  }, [symbols, subscribe, unsubscribe]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${connected ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                <FiGlobe className={connected ? 'text-emerald-600' : 'text-rose-600'} />
            </div>
            <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Market Connectivity</p>
                <h2 className="text-sm font-bold text-slate-800 uppercase">Real-time Data Stream</h2>
            </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${connected ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-rose-200 text-rose-700 bg-rose-50'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          {connected ? 'Connected' : 'Offline'}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2">
            <span className="text-base">⚠️</span> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <AnimatePresence mode="popLayout">
          {symbols.map((symbol) => {
            const price = prices.get(symbol);

            return (
              <MotionDiv 
                key={symbol}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 min-w-[160px] p-4 rounded-xl border border-slate-100 bg-slate-50/50 transition-all relative group overflow-hidden hover:border-blue-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex justify-between items-start mb-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{symbol}</span>
                   {price && (
                     <span className={`text-[10px] font-bold ${price.change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                     </span>
                   )}
                </div>

                <div className="space-y-0.5">
                   <p className="text-lg font-black text-slate-800 tracking-tight">
                     {price ? `₹${price.price.toLocaleString()}` : '───'}
                   </p>
                   {price && (
                     <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>Bid: {price.bid.toFixed(1)}</span>
                        <span>Ask: {price.ask.toFixed(1)}</span>
                     </div>
                   )}
                </div>
              </MotionDiv>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
