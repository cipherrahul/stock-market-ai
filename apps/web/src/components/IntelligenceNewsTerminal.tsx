'use client';

import React, { useState, useEffect } from 'react';
import { FiZap, FiCpu, FiClock } from 'react-icons/fi';
import { MotionDiv } from './Motion';

interface NewsItem {
    id: string;
    headline: string;
    source: string;
    symbol: string;
    time: string;
    impact: 'HIGH' | 'MEDIUM' | 'LOW';
    sentiment: number; // -1 to 1
}

export const IntelligenceNewsTerminal: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                const res = await fetch('http://localhost:3006/api/v1/intelligence/news');
                const data = await res.json();
                if (data.news && data.news.length > 0) {
                    setNews(data.news.map((item: any) => ({
                        id: item.id,
                        headline: item.headline,
                        symbol: item.correlation_symbol,
                        time: new Date(item.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        impact: item.impact,
                        sentiment: parseFloat(item.sentiment)
                    })));
                } else {
                    throw new Error('No news available');
                }
            } catch (err) {
                // FALLBACK
                setNews([
                    { id: '1', headline: 'Federal Reserve hints at tapering; Yield curve flattens across sovereign nodes.', symbol: 'US10Y', time: '09:12', impact: 'HIGH', sentiment: -0.42, source: 'REUTERS' },
                    { id: '2', headline: 'Tech sector outperformance driven by structural AI infrastructure upgrades.', symbol: 'XLK', time: '09:05', impact: 'MEDIUM', sentiment: 0.68, source: 'BLOOMBERG' },
                    { id: '3', headline: 'Crude oil volatility compresses as supply chains reach equilibrium.', symbol: 'WTI', time: '08:45', impact: 'LOW', sentiment: 0.12, source: 'CNBC' },
                ]);
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 20000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-black italic tracking-tighter uppercase flex items-center gap-2 text-white/80">
                    <FiZap className="text-amber-400" /> Intelligence_Feed
                </h3>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Live_Sync</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                {news.map((item) => (
                    <MotionDiv
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-white/5 text-slate-400 uppercase tracking-widest">
                                {item.symbol}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-mono opacity-40">
                                <FiClock /> {item.time}
                            </div>
                        </div>
                        <p className="text-xs font-bold leading-relaxed text-slate-200 group-hover:text-white transition-colors">
                            {item.headline}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    item.impact === 'HIGH' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                                    item.impact === 'MEDIUM' ? 'bg-amber-500' : 'bg-sky-500'
                                }`} />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{item.impact}_IMPACT</span>
                            </div>
                            <div className={`text-[10px] font-black ${item.sentiment >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {item.sentiment >= 0 ? '+' : ''}{(item.sentiment * 100).toFixed(0)}%_Alpha
                            </div>
                        </div>
                    </MotionDiv>
                ))}
            </div>
            
            <div className="pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-sky-500/5 border border-sky-500/10">
                    <FiCpu className="text-sky-400" />
                    <p className="text-[9px] font-bold text-sky-200/60 uppercase tracking-widest leading-tight">
                        AI_Reasoner: Sentiment correlation suggests structural rotation into defensive nodes.
                    </p>
                </div>
            </div>
        </div>
    );
};
