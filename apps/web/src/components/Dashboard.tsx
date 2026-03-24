import React from 'react';
import { useRealtimeAlpha } from '@/hooks/useRealtime';
import { usePanicMonitor } from '@/hooks/usePanicMonitor';
import { MotionDiv } from '@/components/Motion';
import { FiWind, FiCpu } from 'react-icons/fi';
import { AnimatePresence } from 'framer-motion';
import { AlphaInsights } from './AlphaInsights';
import { PortfolioDashboard } from './PortfolioDashboard';
import { TradingPanelRealtime } from './TradingPanelRealtime';
import { PriceTicker } from './PriceTicker';

export const Dashboard: React.FC = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  const { regime, sentiment } = useRealtimeAlpha(token);
  const { isPanicking, resetPanic } = usePanicMonitor();

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Global Price Ticker */}
      <PriceTicker token={token} symbols={['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK']} />

      <div className="max-w-[1600px] mx-auto p-8 space-y-12 pb-24">
          {/* Animated Header */}
          <MotionDiv
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-10 gap-8"
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <FiCpu className="text-indigo-400 text-sm" />
                </div>
                <p className="text-indigo-400 font-extrabold tracking-[0.3em] uppercase text-[10px]">Institutional Terminal // v2.0.4</p>
              </div>
              <h1 className="text-7xl font-black tracking-tighter text-gradient-sovereign leading-none uppercase italic">
                Sovereign<br />Command Center
              </h1>
            </div>

            <div className="flex items-center gap-8 bg-white/[0.02] p-6 rounded-[2rem] border border-white/5 backdrop-blur-md">
              <div className="text-right">
                <p className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Resiliency Delta</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  <span className="text-[10px] font-black font-mono opacity-80 uppercase">SHADOW: 99.9%</span>
                </div>
              </div>
              <div className="h-10 w-[1px] bg-white/10" />
              <div className="text-right">
                <p className="text-[10px] uppercase opacity-40 font-bold tracking-widest mb-1">Liveness Protocols</p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[10px] font-black font-mono opacity-80 text-emerald-400 uppercase tracking-tighter">NOMINAL_STANDBY</span>
                </div>
              </div>
            </div>
          </MotionDiv>

          {/* Primary Viewport: Intelligence & Execution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
             <div className="lg:col-span-2 space-y-10">
                <AlphaInsights regime={regime} sentimentScore={sentiment} portfolioHistory={[]} />
                <PortfolioDashboard token={token} userId={userId} />
             </div>
             <div className="lg:col-span-1">
                <div className="sticky top-10">
                   <TradingPanelRealtime token={token} userId={userId} />
                </div>
             </div>
          </div>
      </div>
      
      {/* ZEN MODE OVERLAY (Emotion-Aware UX) */}
      <AnimatePresence>
        {isPanicking && (
          <MotionDiv 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] backdrop-blur-3xl bg-slate-950/60 flex items-center justify-center p-8"
          >
            <MotionDiv 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl bg-[#020617] border border-white/10 rounded-[4rem] p-16 text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
              <div className="relative z-10 text-center">
                  <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-10 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                    <FiWind className="text-5xl text-indigo-400" />
                  </div>
                  <h2 className="text-5xl font-black mb-6 tracking-tighter italic uppercase text-gradient-sovereign">Sovereign Calm</h2>
                  <p className="text-slate-400 text-lg leading-relaxed mb-10 max-w-lg mx-auto font-medium">
                    Systemic sensors detect high operational variance. Autonomous logic is currently neutralizing volatility clusters to protect your principal capital. 
                    <br/><br/>
                    <span className="text-indigo-400 font-black italic">YOUR CAPITAL IS GROUNDED.</span>
                  </p>
                  <button 
                    onClick={resetPanic}
                    className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-bold transition-all shadow-2xl shadow-indigo-500/30 uppercase tracking-[0.2em] text-xs border border-indigo-400/20"
                  >
                    Resync My Consciousness
                  </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
