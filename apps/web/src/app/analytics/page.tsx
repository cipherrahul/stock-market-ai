'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { Layout } from '@/components/Layout';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import toast from 'react-hot-toast';
import { MotionDiv } from '@/components/Motion';
import { FiBarChart2, FiActivity, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';

interface AnalyticsData {
  date: string;
  portfolio_value: number;
  pnl: number;
  trades: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { get, loading } = useApi();
  const [analytics, setAnalytics] = useState<AnalyticsData[]>([]);
  const [stats, setStats] = useState<any>(null);
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const loadAnalytics = async () => {
      try {
        const data = await get(`/api/v1/portfolio/${userId}/history`);
        const pnlData = await get(`/api/v1/portfolio/${userId}/pnl`);
        
        setAnalytics(data || []);
        setStats(pnlData);
      } catch (error) {
        toast.error('Sector Intelligence Failure: Failed to load analytics');
      }
    };

    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [userId, get]);

  const pnlIsPositive = (stats?.totalPnl || 0) >= 0;

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
               <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <FiBarChart2 className="text-blue-400 text-sm" />
               </div>
               <span className="text-blue-400 font-black tracking-[0.3em] uppercase text-[9px]">Intelligence Sector // Performance Registry</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
              INTELLIGENCE
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Autonomous Performance Tracking & Equity Analysis</p>
          </div>

          <div className="flex gap-4">
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiActivity className="text-indigo-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Telemetry</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">DATA_SYNC_ACTIVE</p>
                </div>
             </div>
          </div>
        </MotionDiv>

        {/* Primary Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
           {[
             { label: 'Observed Alpha', value: stats?.totalPnl, suffix: '₹', trend: pnlIsPositive },
             { label: 'Equity Variance', value: stats?.returnPercentage, suffix: '%', trend: (stats?.returnPercentage || 0) >= 0 },
             { label: 'Unrealized Delta', value: stats?.unrealizedPnl, suffix: '₹', trend: (stats?.unrealizedPnl || 0) >= 0 },
           ].map((metric, i) => (
             <MotionDiv 
               key={i}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: i * 0.1 }}
               className="glass-panel p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.01] relative overflow-hidden group shadow-xl"
             >
                <div className="relative z-10 flex justify-between items-start">
                   <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">{metric.label}</p>
                      <h3 className={`text-4xl font-black italic tracking-tighter leading-none ${metric.trend ? 'text-emerald-400' : 'text-rose-400'}`}>
                         {metric.suffix === '₹' && '₹'}{Math.abs(metric.value || 0).toLocaleString()}
                         {metric.suffix === '%' && '%'}
                      </h3>
                   </div>
                   <div className={`p-3 rounded-2xl ${metric.trend ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} border`}>
                      {metric.trend ? <FiArrowUpRight className="text-xl" /> : <FiArrowDownRight className="text-xl" />}
                   </div>
                </div>
                {/* Micro Chart Decor */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${metric.trend ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`} />
             </MotionDiv>
           ))}
        </div>

        {/* High-Fidelity Equity Curve */}
        <MotionDiv 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="glass-panel p-10 rounded-[3rem] border border-white/5 bg-white/[0.01] relative overflow-hidden"
        >
          <div className="flex justify-between items-center mb-10">
             <div>
                <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Equity Velocity Stream</h2>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mt-1 italic">Observed Portfolio Evolution // Real-Time Basis</p>
             </div>
             <div className="flex gap-2">
                {['1H', '1D', '1W', 'ALL'].map(t => (
                   <button key={t} className={`px-3 py-1 rounded-lg text-[10px] font-black ${t === '1D' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-600'}`}>{t}</button>
                ))}
             </div>
          </div>

          <div className="h-[400px] w-full">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                 <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Awaiting Registry Sync...</p>
                 </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#475569" 
                    fontSize={10} 
                    fontWeight={900} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={10} 
                    fontWeight={900} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#020617', border: '1px solid #ffffff10', borderRadius: '1.5rem', fontSize: '12px', fontWeight: '900' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="portfolio_value"
                    stroke="#6366f1"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                    name="Equity Basis"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </MotionDiv>

        {/* Global Compliance Footer */}
        <p className="text-center text-[8px] text-slate-700 font-bold uppercase tracking-[0.4em] opacity-30 mt-12 pb-8">
           Institutional Audit Trail Active // verified performance vector // Sovereign AI v2.0
        </p>
      </div>
    </Layout>
  );
}
