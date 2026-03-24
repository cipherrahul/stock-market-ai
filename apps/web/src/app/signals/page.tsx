'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { Layout } from '@/components/Layout';
import { TradeSignal } from '@/types';
import toast from 'react-hot-toast';
import { MotionDiv, MotionButton } from '@/components/Motion';
import { AnimatePresence } from 'framer-motion';
import { FiCpu, FiZap, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';

export default function AISignalsPage() {
  const router = useRouter();
  const { post } = useApi();
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [symbol, setSymbol] = useState('');
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const generateSignal = async (sym: string) => {
    try {
      setGeneratingFor(sym);
      const signal = await post('/api/v1/ai/generate-signal', { symbol: sym });
      setSignals((prev) => [signal, ...prev.filter((s) => s.symbol !== sym)]);
      toast.success(`Signal Synchronized: ${sym}`);
    } catch (error) {
      toast.error('Neural Logic Mismatch: Signal Generation Failed');
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleGenerateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      toast.error('Input Symbol Required');
      return;
    }
    await generateSignal(symbol.toUpperCase());
    setSymbol('');
  };

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-12 pb-24">
        {/* Sector Header */}
        <MotionDiv 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <FiCpu className="text-indigo-400 text-sm" />
               </div>
               <span className="text-indigo-400 font-black tracking-[0.3em] uppercase text-[9px]">Neural Alpha // Predictive Intelligence</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
              NEURAL ALPHA
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Autonomous Pattern Detection & Signal Synthesis</p>
          </div>

          <div className="flex gap-4">
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiZap className="text-yellow-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Inference</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">GPU_ACCELERATED</p>
                </div>
             </div>
          </div>
        </MotionDiv>

        {/* Generate Signal Interface */}
        <MotionDiv 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="glass-panel p-8 rounded-[3rem] border-glow bg-white/[0.01]"
        >
          <div className="flex flex-col md:flex-row gap-8 items-center">
             <div className="flex-1 w-full">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-4">Manual Signal Synthesis</h2>
                <form onSubmit={handleGenerateCustom} className="flex gap-4">
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="Enter ticker (e.g., RELIANCE)"
                    className="flex-1 px-8 py-5 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold placeholder:text-slate-700"
                    disabled={generatingFor !== null}
                  />
                  <MotionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={generatingFor !== null}
                    className="px-10 py-5 bg-white text-[#020617] font-black rounded-[2rem] transition-all flex items-center gap-3 uppercase tracking-widest text-xs hover:bg-slate-100 disabled:opacity-50"
                  >
                    {generatingFor ? 'Inference...' : 'Synthesize'}
                  </MotionButton>
                </form>
             </div>

             <div className="w-full md:w-auto border-l border-white/5 pl-8 md:block hidden">
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-4">Priority Fleets</p>
                <div className="flex gap-3">
                   {['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'].map((sym) => (
                      <MotionButton
                        key={sym}
                        whileHover={{ y: -2 }}
                        onClick={() => generateSignal(sym)}
                        disabled={generatingFor === sym}
                        className="px-4 py-2 bg-white/[0.03] border border-white/10 hover:border-indigo-500/30 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all uppercase tracking-tighter"
                      >
                        {generatingFor === sym ? '...' : sym}
                      </MotionButton>
                   ))}
                </div>
             </div>
          </div>
        </MotionDiv>

        {/* Signals Registry */}
        <div className="grid grid-cols-1 gap-6">
           <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-4 italic">Synchronized Inference Stream</h2>
           <AnimatePresence mode="popLayout">
              {signals.length === 0 ? (
                <MotionDiv 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   className="glass-panel rounded-[2rem] p-16 text-center border-dashed border-white/10 bg-white/[0.01]"
                >
                  <p className="text-slate-600 text-xs font-bold uppercase tracking-[0.3em]">Standby // No active pattern synthesis</p>
                </MotionDiv>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   {signals.map((signal, idx) => (
                      <MotionDiv 
                        key={`${signal.symbol}-${idx}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02] relative overflow-hidden group hover:border-white/10 transition-all shadow-xl"
                      >
                         <div className="flex justify-between items-start mb-8 relative z-10">
                            <div>
                               <div className="flex items-center gap-4 mb-2">
                                  <h3 className="text-4xl font-black italic tracking-tighter text-white uppercase">{signal.symbol}</h3>
                                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                     signal.signal === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                     signal.signal === 'SELL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                     'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                     {signal.signal}
                                  </div>
                               </div>
                               <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Sovereign Prediction Matrix</p>
                            </div>
                            <div className="text-right">
                               <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Confidence</p>
                               <p className="text-3xl font-black italic text-indigo-400">{(signal.confidence * 100).toFixed(0)}%</p>
                            </div>
                         </div>

                         <div className="grid grid-cols-3 gap-6 mb-8 relative z-10">
                            <div className="p-4 rounded-3xl bg-white/[0.01] border border-white/5">
                               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Target</p>
                               <p className="text-xl font-bold text-white tracking-tighter">₹{signal.price_target.toLocaleString()}</p>
                            </div>
                            <div className="p-4 rounded-3xl bg-white/[0.01] border border-white/5">
                               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Vector</p>
                               <div className="flex items-center gap-2">
                                  {signal.signal === 'BUY' ? <FiArrowUpRight className="text-emerald-400" /> : <FiArrowDownRight className="text-rose-400" />}
                                  <p className="text-white font-black text-[10px] uppercase tracking-tighter">{signal.signal === 'BUY' ? 'LONG' : 'SHORT'}_ALPHA</p>
                                </div>
                            </div>
                            <div className="p-4 rounded-3xl bg-white/[0.01] border border-white/5">
                               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Latency</p>
                               <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">42ms_INFER</p>
                            </div>
                         </div>

                         <div className="relative z-10 pt-6 border-t border-white/5">
                            <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-3 italic">Pattern Reasoning</p>
                            <p className="text-[11px] text-slate-400 leading-relaxed font-medium line-clamp-2 group-hover:line-clamp-none transition-all duration-500">
                               {signal.reasoning}
                            </p>
                         </div>

                         {/* Background Decor */}
                         <div className={`absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-20 ${
                            signal.signal === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'
                         }`} />
                      </MotionDiv>
                   ))}
                </div>
              )}
           </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
