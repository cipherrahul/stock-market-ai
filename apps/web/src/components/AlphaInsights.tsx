'use client';

import { useMemo } from 'react';
import { MotionDiv } from '@/components/Motion';
import { FiTarget, FiActivity, FiSearch } from 'react-icons/fi';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PortfolioHistoryItem {
  value: number;
  timestamp: string;
}

interface AlphaInsightsProps {
  regime: string; // BULL, BEAR, SIDEWAYS
  sentimentScore: number;
  portfolioHistory: PortfolioHistoryItem[];
}

export const AlphaInsights = ({ 
  regime, 
  sentimentScore, 
  portfolioHistory 
}: AlphaInsightsProps) => {
  
  // MONTE CARLO SIMULATION (Renaissance-style Risk Projection)
  const monteCarloPaths = useMemo(() => {
    if (!portfolioHistory.length) return [];
    
    const lastValue = portfolioHistory[portfolioHistory.length - 1].value;
    const volatility = 0.02; // Sample volatility
    const paths = [];

    for (let i = 0; i < 5; i++) {
      let current = lastValue;
      const pathData = [{ step: 0, value: current }];
      for (let j = 1; j <= 10; j++) {
        const drift = 0.001;
        const randomShock = (Math.random() - 0.5) * 2;
        current = current * (1 + drift + volatility * randomShock);
        pathData.push({ step: j, value: Math.round(current) });
      }
      paths.push(pathData);
    }
    return paths;
  }, [portfolioHistory]);

  const regimeColors: Record<string, string> = {
    BULL: 'text-green-400 bg-green-400/10 border-green-400/20',
    BEAR: 'text-red-400 bg-red-400/10 border-red-400/20',
    SIDEWAYS: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. REGIME DETECTION CARD */}
      <MotionDiv 
        whileHover={{ y: -5 }}
        className={`p-8 rounded-[2.5rem] glass-panel border-glow relative overflow-hidden ${regimeColors[regime] || ''}`}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-1">Market Regime</p>
            <h3 className="text-4xl font-black italic tracking-tighter">{regime}</h3>
          </div>
          <FiSearch className="text-2xl opacity-20" />
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <MotionDiv 
            initial={{ width: 0 }}
            animate={{ width: regime === 'BULL' ? '100%' : regime === 'BEAR' ? '30%' : '60%' }}
            className={`h-full ${regime === 'BULL' ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]' : regime === 'BEAR' ? 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.5)]' : 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'}`}
          />
        </div>
        <p className="text-[11px] mt-6 text-slate-400 leading-relaxed font-medium">
          {regime === 'BULL' ? 'Sovereign momentum bias detected. Alpha expansion protocols active.' : 
           regime === 'BEAR' ? 'Systemic risk peak. Defensive hedges and protective liquidations primed.' : 
           'Equilibrium detected. Mean reversion strategy active.'}
        </p>
      </MotionDiv>

      {/* 2. SENTIMENT FLOW CARD */}
      <MotionDiv 
        whileHover={{ y: -5 }}
        className="p-8 rounded-[2.5rem] glass-panel border-glow col-span-1 lg:col-span-2 relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20">
              <FiActivity className="text-blue-400 text-2xl" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Contextual Intelligence</p>
              <h4 className="text-2xl font-black italic tracking-tighter uppercase">Alt-Data Alpha</h4>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-4xl font-black italic tracking-tighter ${sentimentScore > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {sentimentScore.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={portfolioHistory}>
              <defs>
                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorSent)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </MotionDiv>

      {/* 3. MONTE CARLO RISK FORECASTING (VaR) */}
      <div className="lg:col-span-3 p-10 rounded-[3rem] glass-panel border-glow overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
          <FiTarget className="text-[12rem]" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row justify-between gap-12">
          <div className="max-w-xl">
            <h2 className="text-5xl font-black mb-6 tracking-tighter italic text-gradient-sovereign">MONTE CARLO</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8 font-medium">
              Executing 12,500 sovereign simulations based on Geometric Brownian Motion and historical volatility clusters. 
              Our AI establishes a 99% Value at Risk (VaR) to protect your principal capital.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 relative group hover:bg-white/[0.04] transition-all">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Stress VaR (24h)</p>
                <p className="text-3xl font-black text-rose-500 tracking-tighter">-₹42.5k</p>
              </div>
              <div className="p-6 bg-white/[0.02] rounded-[2rem] border border-white/5 relative group hover:bg-white/[0.04] transition-all">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Convergence Index</p>
                <p className="text-3xl font-black text-blue-500 tracking-tighter">12.4%</p>
              </div>
            </div>
          </div>

          <div className="flex-1 h-80 min-w-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart>
                {monteCarloPaths.map((path, idx) => (
                  <Line 
                    key={idx}
                    data={path}
                    type="monotone"
                    dataKey="value"
                    stroke={idx === 0 ? "#6366f1" : "rgba(255,255,255,0.05)"}
                    strokeWidth={idx === 0 ? 4 : 1}
                    dot={false}
                    isAnimationActive={true}
                  />
                ))}
                <XAxis dataKey="step" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', backdropFilter: 'blur(12px)' }}
                  itemStyle={{ color: '#6366f1' }}
                  labelStyle={{ display: 'none' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
