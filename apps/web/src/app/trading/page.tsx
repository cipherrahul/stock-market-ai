'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layout } from '@/components/Layout';
import { TradingPanelRealtime } from '@/components/TradingPanelRealtime';
import { MotionDiv } from '@/components/Motion';
import { FiTrendingUp, FiShield, FiActivity } from 'react-icons/fi';

export default function TradingPage() {
  const router = useRouter();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '' : '';

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [router, token]);

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto space-y-12 pb-20">
        {/* Sector Header */}
        <MotionDiv 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-12"
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
               <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <FiTrendingUp className="text-emerald-400 text-sm" />
               </div>
               <span className="text-emerald-400 font-black tracking-[0.3em] uppercase text-[9px]">Sovereign // Execution</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
              TRADING OPS
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">High-Fidelity Asset Deployment Console</p>
          </div>

          <div className="flex gap-4">
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiShield className="text-indigo-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Protocol</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">SECURED_VAULT</p>
                </div>
             </div>
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiActivity className="text-emerald-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Execution</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">REAL_TIME_SYNC_ACTIVE</p>
                </div>
             </div>
          </div>
        </MotionDiv>

        {/* Master Execution Panel */}
        <MotionDiv 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-blue-500/20 rounded-[3rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative">
            <TradingPanelRealtime token={token} userId={userId} />
          </div>
        </MotionDiv>
      </div>
    </Layout>
  );
}
