'use client';

import React, { useState, useEffect } from 'react';
import { MotionDiv } from './Motion';
import { FiPieChart, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

interface HeatmapNode {
    symbol: string;
    weight: number; // 0 to 1
    pnl: number;
    sector: string;
}

export const RiskHeatmap: React.FC = () => {
    const [data, setData] = useState<HeatmapNode[]>([]);

    useEffect(() => {
        const fetchHeatmap = async () => {
            const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') || '00000000-0000-0000-0000-000000000000' : '00000000-0000-0000-0000-000000000000';
            try {
                // In a real system, the URL would be dynamic or proxied
                const res = await fetch(`http://localhost:3005/api/v1/portfolio/${userId}/risk-heatmap`);
                const result = await res.json();
                if (result.heatmap && result.heatmap.length > 0) {
                    // Normalize weights to ensure 100% fill for the grid if needed, 
                    // but for treemap real weights are better.
                    setData(result.heatmap);
                } else {
                    throw new Error('No positions found');
                }
            } catch (err) {
                console.warn('Risk Heatmap: Using institutional fallbacks');
                setData([
                    { symbol: 'RELIANCE', weight: 0.35, pnl: 2.1, sector: 'ENERGY' },
                    { symbol: 'HDFCBANK', weight: 0.25, pnl: -1.2, sector: 'FINANCE' },
                    { symbol: 'TCS', weight: 0.15, pnl: 0.8, sector: 'TECH' },
                    { symbol: 'INFY', weight: 0.12, pnl: 1.5, sector: 'TECH' },
                    { symbol: 'ICICIBANK', weight: 0.08, pnl: 0.4, sector: 'FINANCE' },
                    { symbol: 'ZOMATO', weight: 0.05, pnl: -3.4, sector: 'CONSUMER' },
                ]);
            }
        };

        fetchHeatmap();
        const interval = setInterval(fetchHeatmap, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-black italic tracking-tighter uppercase flex items-center gap-2 text-white/80">
                    <FiPieChart className="text-amber-400" /> Capital_Heatmap
                </h3>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sector_Density</span>
            </div>

            <div className="flex-1 grid grid-cols-6 grid-rows-2 gap-3">
                {data.map((node: HeatmapNode, idx: number) => (
                    <MotionDiv
                        key={node.symbol}
                        whileHover={{ scale: 0.98, opacity: 0.9 }}
                        className={`rounded-3xl p-4 flex flex-col justify-between border border-white/5 relative overflow-hidden transition-all ${
                            idx === 0 ? 'col-span-3 row-span-2' : 
                            idx === 1 ? 'col-span-3 row-span-1' :
                            'col-span-1 row-span-1'
                        } ${node.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}
                    >
                        <div className="relative z-10">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{node.sector}</p>
                            <p className={`font-black italic tracking-tighter leading-none mt-1 ${
                                idx === 0 ? 'text-3xl' : 'text-lg'
                            }`}>{node.symbol}</p>
                        </div>

                        <div className="relative z-10 flex justify-between items-end">
                            <p className="text-[10px] font-mono opacity-40">{(node.weight * 100).toFixed(0)}%</p>
                            <div className={`flex items-center gap-1 text-[10px] font-black ${node.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {node.pnl >= 0 ? <FiTrendingUp /> : <FiTrendingDown />}
                                {Math.abs(node.pnl)}%
                            </div>
                        </div>

                        {/* Visual Glow */}
                        <div className={`absolute inset-0 opacity-10 blur-2xl ${
                            node.pnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'
                        }`} />
                    </MotionDiv>
                ))}
            </div>
        </div>
    );
};
