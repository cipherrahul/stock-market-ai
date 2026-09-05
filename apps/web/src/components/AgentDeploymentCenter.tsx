'use client';

import React, { useState, useEffect } from 'react';
import { MotionDiv, MotionButton } from './Motion';
import { FiPlay, FiSquare, FiPlus, FiActivity, FiShield, FiTrendingUp, FiCrosshair, FiCpu } from 'react-icons/fi';

interface TradingAgent {
    id: string;
    name: string;
    type: 'MOMENTUM' | 'ARBITRAGE' | 'MEAN_REVERSION';
    status: 'IDLE' | 'HUNTING' | 'EXECUTING' | 'STOPPED';
    pnl: number;
    trades: number;
    allocation: number;
}

export const AgentDeploymentCenter: React.FC = () => {
    const [agents, setAgents] = useState<TradingAgent[]>([]);
    const [showDeploy, setShowDeploy] = useState(false);

    useEffect(() => {
        const fetchAgents = async () => {
            const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000000' : '00000000-0000-0000-0000-000000000000';
            try {
                const res = await fetch(`http://localhost:3006/api/v1/fleet/agents/${userId}`);
                const data = await res.json();
                if (data.agents && data.agents.length > 0) {
                    setAgents(data.agents.map((a: any) => ({
                        id: a.id,
                        name: a.name,
                        type: a.strategy as any,
                        status: a.status as any,
                        allocation: parseFloat(a.allocation),
                        pnl: parseFloat(a.pnl),
                        trades: a.trades_count
                    })));
                } else {
                    throw new Error('No agents found');
                }
            } catch (err) {
                // FALLBACK
                setAgents([
                    { id: '1', name: 'Alpha_Momentum_01', type: 'MOMENTUM', status: 'HUNTING', pnl: 4250.25, trades: 14, allocation: 250000 },
                    { id: '2', name: 'Arb_Scout_09', type: 'ARBITRAGE', status: 'IDLE', pnl: -120.40, trades: 82, allocation: 500000 },
                    { id: '3', name: 'Mean_Rev_Guard', type: 'MEAN_REVERSION', status: 'EXECUTING', pnl: 12400.00, trades: 3, allocation: 1000000 },
                ]);
            }
        };

        fetchAgents();
        const interval = setInterval(fetchAgents, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleAgent = (id: string) => {
        setAgents(prev => prev.map(a => 
            a.id === id ? { ...a, status: a.status === 'STOPPED' ? 'IDLE' : 'STOPPED' } : a
        ));
    };

    return (
        <div className="space-y-8 h-full flex flex-col">
            <div className="flex justify-between items-center px-2">
                <div>
                    <h3 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-3 text-white">
                        <FiCpu className="text-sky-400" /> Autonomous_Fleet
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Agentic Execution Mesh v4.2</p>
                </div>
                <MotionButton
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowDeploy(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-sky-500 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-sky-500/20"
                >
                    <FiPlus /> Deploy_New_Hunter
                </MotionButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {agents.map(agent => (
                    <MotionDiv
                        key={agent.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-6 rounded-[2.5rem] border ${
                            agent.status === 'STOPPED' ? 'bg-white/[0.01] border-white/5 opacity-50' : 'bg-white/[0.03] border-white/10'
                        } relative overflow-hidden group`}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                            {agent.type === 'MOMENTUM' && <FiTrendingUp className="text-6xl" />}
                            {agent.type === 'ARBITRAGE' && <FiActivity className="text-6xl" />}
                            {agent.type === 'MEAN_REVERSION' && <FiShield className="text-6xl" />}
                        </div>

                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${
                                    agent.type === 'MOMENTUM' ? 'bg-sky-500/20 text-sky-400' :
                                    agent.type === 'ARBITRAGE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'
                                }`}>{agent.type}</span>
                                <h4 className="text-lg font-black italic tracking-tighter text-white mt-2 uppercase">{agent.name}</h4>
                            </div>
                            <button 
                                onClick={() => toggleAgent(agent.id)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                                    agent.status === 'STOPPED' ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                }`}
                            >
                                {agent.status === 'STOPPED' ? <FiPlay /> : <FiSquare />}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Bot_PNL</p>
                                    <p className={`text-2xl font-black italic tracking-tighter ${agent.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {agent.pnl >= 0 ? '₹+' : '₹'}{agent.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</p>
                                    <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 justify-end ${
                                        agent.status === 'HUNTING' ? 'text-sky-400' :
                                        agent.status === 'EXECUTING' ? 'text-amber-400 animate-pulse' : 'text-slate-600'
                                    }`}>
                                        {agent.status === 'EXECUTING' && <FiCrosshair className="animate-spin" />}
                                        {agent.status}
                                    </span>
                                </div>
                            </div>

                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${
                                    agent.pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                                }`} style={{ width: `${Math.min(100, Math.abs(agent.pnl / 200) * 100)}%` }} />
                            </div>

                            <div className="flex justify-between items-center text-[9px] font-black text-slate-600 uppercase tracking-widest pt-2">
                                <span>Alloc: ₹{(agent.allocation / 100000).toFixed(1)}L</span>
                                <span>{agent.trades} Cycles_Completed</span>
                            </div>
                        </div>
                    </MotionDiv>
                ))}
            </div>
            
            {showDeploy && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#020617]/90 backdrop-blur-3xl p-6">
                    <MotionDiv 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full max-w-lg bg-black/60 border border-white/10 rounded-[4rem] p-12 space-y-10 shadow-2xl relative"
                    >
                         <div className="text-center space-y-4">
                            <FiCpu className="mx-auto text-5xl text-sky-400" />
                            <h3 className="text-3xl font-black italic tracking-tighter uppercase text-white">Initialize_Hunter</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Select Alpha Generation Logic</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                             {['MOMENTUM_ENGINE', 'ARBITRAGE_SCALPEL', 'MEAN_REVERSION_GRID'].map(strategy => (
                                 <button key={strategy} className="p-6 bg-white/[0.03] border border-white/5 rounded-[2rem] text-left hover:bg-white/5 hover:border-sky-500/30 transition-all flex justify-between items-center group">
                                     <div>
                                        <p className="text-sm font-black italic tracking-tighter text-white uppercase">{strategy}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase mt-1">High-Frequency Adaptive Loop</p>
                                     </div>
                                     <FiPlus className="opacity-0 group-hover:opacity-100 text-sky-400 transition-opacity" />
                                 </button>
                             ))}
                        </div>

                        <button 
                            onClick={() => setShowDeploy(false)}
                            className="w-full py-5 rounded-[2rem] border border-white/10 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-white/5"
                        >
                            Cancel_Init
                        </button>
                    </MotionDiv>
                </div>
            )}
        </div>
    );
};
