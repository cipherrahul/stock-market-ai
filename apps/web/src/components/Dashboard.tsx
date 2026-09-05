import React from 'react';
import { useRealtimeAlpha } from '@/hooks/useRealtime';
import { usePanicMonitor } from '@/hooks/usePanicMonitor';
import { MotionDiv, AnimatePresence } from '@/components/Motion';
import {
  FiActivity,
  FiLayers,
  FiShield,
  FiTrendingUp,
  FiWind,
} from 'react-icons/fi';
import { AlphaInsights } from './AlphaInsights';
import { PortfolioDashboard } from './PortfolioDashboard';
import { TradingPanelRealtime } from './TradingPanelRealtime';
import { PriceTicker } from './PriceTicker';
import { IntelligenceNewsTerminal } from './IntelligenceNewsTerminal';
import { SovereignVoice } from './SovereignVoice';
import { PaymentPanel } from './PaymentPanel';

export const Dashboard: React.FC = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  const { regime, sentiment } = useRealtimeAlpha(token);
  const { isPanicking, resetPanic } = usePanicMonitor();
  const [isPaper, setIsPaper] = React.useState(false);

  const confidence = Math.max(52, Math.round(60 + sentiment * 32));
  const capitalFlow = sentiment > 0.55 ? '+4.8%' : sentiment < 0.4 ? '-2.1%' : '+0.9%';
  
  const commandTiles = [
    { label: 'Alpha Confidence', value: `${confidence}%`, icon: FiShield, accent: 'text-blue-600' },
    { label: 'Regime Vector', value: regime || 'SIDEWAYS', icon: FiLayers, accent: 'text-amber-600' },
    { label: 'Capital Flow', value: capitalFlow, icon: FiTrendingUp, accent: 'text-emerald-600' },
    { label: 'Signal Pulse', value: sentiment.toFixed(2), icon: FiActivity, accent: 'text-sky-600' },
  ];

  return (
    <div className="space-y-6 pb-20">
      <PriceTicker token={token} symbols={['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK']} />

      <MotionDiv
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm p-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#0067ff]">Institutional Terminal // v2.0.4</p>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-3">
              Market <span className="text-[#0067ff]">Command</span> Overview
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
              Real-time portfolio telemetry and cross-market execution control. 
              Monitor systemic risk and signal intelligence from a single enterprise-view dashboard.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
             <div className="px-4 py-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Trading Mode</p>
                <p className="text-sm font-bold text-slate-700">{isPaper ? 'Simulation' : 'Live Operations'}</p>
             </div>
             <button
                onClick={() => setIsPaper(!isPaper)}
                className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                  isPaper 
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200' 
                    : 'bg-[#0067ff] text-white hover:bg-blue-700 shadow-blue-200 shadow-lg'
                }`}
              >
                {isPaper ? 'Switch to Live' : 'Go Shadow'}
              </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {commandTiles.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="bg-[#f8fafc] border border-slate-200 rounded-xl p-5 group transition-all hover:border-blue-200 hover:bg-white hover:shadow-md">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                <div className={`p-2 rounded-lg bg-white border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-colors`}>
                  <Icon className={`text-sm ${accent}`} />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-800 tracking-tight">{value}</p>
            </div>
          ))}
        </div>
      </MotionDiv>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-6">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Alpha Matrix & Portfolio</h3>
               <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-widest">Real-time Feed</span>
            </div>
            <div className="p-6 space-y-6">
              <SovereignVoice regime={regime || 'NEUTRAL'} sentiment={sentiment} />
              <div className="grid md:grid-cols-2 gap-6">
                 <AlphaInsights regime={regime} sentimentScore={sentiment} portfolioHistory={[]} />
                 <PortfolioDashboard token={token} userId={userId} isPaper={isPaper} />
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Trade Execution Control</h3>
            </div>
            <div className="p-6">
              <TradingPanelRealtime token={token} userId={userId} isPaper={isPaper} />
            </div>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Intelligence & Insights</h3>
            </div>
            <div className="flex-1 p-6">
              <IntelligenceNewsTerminal />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-12">
           <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/30">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Treasury & Settlements</h3>
            </div>
            <div className="p-6">
               <PaymentPanel token={token} userId={userId} />
            </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isPanicking && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-8 backdrop-blur-md"
          >
            <MotionDiv
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white max-w-xl w-full rounded-3xl border border-slate-200 p-12 text-center shadow-2xl"
            >
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 border border-blue-100">
                <FiWind className="text-4xl text-[#0067ff]" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">Sovereign Calm Mode Active</h2>
              <p className="text-slate-500 mb-10 leading-relaxed">
                Systemic sensors detect high operational variance. Autonomous behavioral logic has neutralized volatility clusters to safeguard principal assets.
              </p>
              <button
                onClick={resetPanic}
                className="w-full rounded-xl bg-[#0067ff] px-8 py-4 text-sm font-bold uppercase tracking-wider text-white shadow-xl shadow-blue-200 transition-all hover:bg-blue-700"
              >
                Reset Operations
              </button>
            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};
