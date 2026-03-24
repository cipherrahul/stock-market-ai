'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { Layout } from '@/components/Layout';
import toast from 'react-hot-toast';
import { MotionDiv, MotionButton } from '@/components/Motion';
import { FiSettings, FiLock, FiCpu, FiBell, FiActivity } from 'react-icons/fi';

export default function SettingsPage() {
  const router = useRouter();
  const { put, loading } = useApi();
  const [riskLevel, setRiskLevel] = useState('medium');
  const [maxPositionSize, setMaxPositionSize] = useState('100000');
  const [notifications, setNotifications] = useState(true);
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  const handleSave = async () => {
    if (!userId) return;

    try {
      await put(`/api/v1/users/${userId}`, {
        preferences: {
          riskLevel,
          maxPositionSize: parseFloat(maxPositionSize),
          notifications,
        },
      });
      toast.success('Protocols Synchronized Successfully');
    } catch (error) {
      toast.error('Configuration Failure: Sync Interrupted');
    }
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
               <div className="p-2 bg-slate-500/10 rounded-lg border border-slate-500/20">
                  <FiSettings className="text-slate-400 text-sm" />
               </div>
               <span className="text-slate-400 font-black tracking-[0.3em] uppercase text-[9px]">System Protocols // Configuration Matrix</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
              PROTOCOLS
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Autonomous Logic & Security Configuration</p>
          </div>

          <div className="flex gap-4">
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiLock className="text-indigo-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Identity</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">SECURED_CREDENTIALS</p>
                </div>
             </div>
          </div>
        </MotionDiv>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
           {/* Section 1: Execution Logic */}
           <MotionDiv 
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.1 }}
             className="lg:col-span-2 space-y-8"
           >
              <div className="glass-panel p-10 rounded-[3rem] border border-white/5 bg-white/[0.01]">
                 <div className="flex items-center gap-4 mb-10">
                    <FiCpu className="text-indigo-400 text-2xl" />
                    <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Execution Logic</h2>
                 </div>

                 <div className="space-y-10">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-2">Risk Tolerance Vector</label>
                      <select
                        value={riskLevel}
                        onChange={(e) => setRiskLevel(e.target.value)}
                        className="w-full px-8 py-5 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                      >
                        <option value="low">LOW_VARIANCE_CONSERVATIVE</option>
                        <option value="medium">BALANCED_OPERATIONAL_GRADE</option>
                        <option value="high">AGGRESSIVE_ALPHA_PURSUIT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 pl-2">Max Position Cap (INR)</label>
                      <input
                        type="number"
                        value={maxPositionSize}
                        onChange={(e) => setMaxPositionSize(e.target.value)}
                        className="w-full px-8 py-5 bg-white/[0.02] border border-white/10 rounded-[2rem] text-white focus:outline-none focus:border-indigo-500/50 transition-all font-bold"
                        placeholder="100000"
                      />
                    </div>
                 </div>
              </div>

              <div className="glass-panel p-10 rounded-[3rem] border border-white/5 bg-white/[0.01]">
                 <div className="flex items-center gap-4 mb-10">
                    <FiBell className="text-indigo-400 text-2xl" />
                    <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">Comms Protocols</h2>
                 </div>

                 <div className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/5 rounded-[2rem]">
                    <div className="flex items-center gap-4">
                       <div className={`w-3 h-3 rounded-full ${notifications ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
                       <p className="text-xs font-black text-white uppercase tracking-widest">Real-Time Alerts</p>
                    </div>
                    <button 
                       onClick={() => setNotifications(!notifications)}
                       className={`w-16 h-8 rounded-full transition-all relative p-1 ${notifications ? 'bg-indigo-600' : 'bg-slate-800'}`}
                    >
                       <div className={`w-6 h-6 bg-white rounded-full transition-all ${notifications ? 'translate-x-8' : 'translate-x-0'}`} />
                    </button>
                 </div>
              </div>
           </MotionDiv>

           {/* Section 2: Summary & Sync */}
           <MotionDiv 
             initial={{ opacity: 0, scale: 0.98 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: 0.2 }}
             className="lg:col-span-1"
           >
              <div className="sticky top-12 space-y-8">
                 <div className="glass-panel p-10 rounded-[3rem] border-glow bg-white/[0.01]">
                    <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 text-center italic">Deployment Readiness</h2>
                    
                    <div className="space-y-6 mb-10">
                       <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-600">Risk Profile:</span>
                          <span className="text-white uppercase tracking-tighter italic">{riskLevel}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-600">Liquidity Cap:</span>
                          <span className="text-white uppercase tracking-tighter italic">₹{parseInt(maxPositionSize).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-slate-600">Fleet Comms:</span>
                          <span className={`uppercase tracking-tighter italic ${notifications ? 'text-emerald-400' : 'text-slate-600'}`}>
                             {notifications ? 'Nominal' : 'Muted'}
                          </span>
                       </div>
                    </div>

                    <MotionButton
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSave}
                      disabled={loading}
                      className="w-full py-5 bg-white text-slate-950 font-black rounded-[2rem] uppercase tracking-[0.2em] text-[10px] hover:bg-slate-100 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      <FiActivity className={loading ? 'animate-spin' : ''} />
                      {loading ? 'SYNCHRONIZING...' : 'COMMIT CHANGES'}
                    </MotionButton>
                 </div>

                 <div className="glass-panel p-8 rounded-[2rem] border border-white/5 bg-white/[0.01] text-center">
                    <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest">
                       System Encryption: AES-256-GCM<br/>
                       Verified Identity Protocol v4.0
                    </p>
                 </div>
              </div>
           </MotionDiv>
        </div>
      </div>
    </Layout>
  );
}
