import { useEffect } from 'react';
import { MotionDiv } from '@/components/Motion';
import { AnimatePresence } from 'framer-motion';
import { FiActivity, FiGlobe } from 'react-icons/fi';
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
    <div className="glass-panel rounded-[2.5rem] p-10 border-glow relative overflow-hidden bg-white/[0.01]">
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${connected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                <FiGlobe className={connected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'} />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Global Liquidity Mesh</p>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-gradient-sovereign">DATA_STREAM REALTIME</h2>
            </div>
        </div>
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${connected ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/30 text-rose-400 bg-rose-500/5'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
          {connected ? 'LINKED' : 'OFFLINE'}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="text-lg">⚠️</span> IPC_ERROR: {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <AnimatePresence mode="popLayout">
          {symbols.map((symbol, idx) => {
            const price = prices.get(symbol);

            return (
              <MotionDiv 
                key={symbol}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.03)' }}
                className="p-6 rounded-[2rem] border border-white/5 bg-white/[0.01] transition-all relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                    <FiActivity className="text-4xl" />
                </div>
                
                <div className="flex justify-between items-start mb-4">
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{symbol}</span>
                   {price && (
                     <span className={`text-[10px] font-black italic ${price.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                       {price.change >= 0 ? '+' : ''}{price.changePercent.toFixed(2)}%
                     </span>
                   )}
                </div>

                <div className="space-y-1">
                   <p className="text-2xl font-black italic tracking-tighter">
                     {price ? `₹${price.price.toLocaleString()}` : '───'}
                   </p>
                   {price && (
                     <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase tracking-widest pt-2">
                        <span>B: {price.bid.toFixed(1)}</span>
                        <span>A: {price.ask.toFixed(1)}</span>
                     </div>
                   )}
                </div>
              </MotionDiv>
            );
          })}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .glass-panel {
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
}
