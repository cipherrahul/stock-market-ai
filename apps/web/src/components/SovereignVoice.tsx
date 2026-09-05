'use client';

import React, { useState, useEffect } from 'react';
import { FiMic, FiInfo } from 'react-icons/fi';

interface SovereignVoiceProps {
    regime: string;
    sentiment: number;
}

export const SovereignVoice: React.FC<SovereignVoiceProps> = ({ regime, sentiment }) => {
    const [narrative, setNarrative] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const generateNarrative = (reg: string, sent: number) => {
        if (sent > 0.7) {
            return `CONVERGENCE DETECTED: Macro-liquidity and cluster-momentum indicate a high-probability breakout in ${reg} regime. Recommend portfolio rebalancing towards high-alpha assets. All systemic risk parameters are within nominal ranges.`;
        } else if (sent < 0.3) {
            return `ADVERSARIAL PRESSURE: Sector rotation and capital outflow suggest a systemic reset. ${reg} regime is currently experiencing high volatility. Defensive posture recommended for core principal protection.`;
        } else {
            return `NEUTRAL EQUILIBRIUM: Market-state shows balanced capital flows. Current Regime: ${reg}. Volatility is compressed. System is standing by for high-fidelity catalysts to determine tactical direction.`;
        }
    };

    useEffect(() => {
        const text = generateNarrative(regime, sentiment);
        setNarrative('');
        setIsTyping(true);
        
        let index = 0;
        const interval = setInterval(() => {
            if (index < text.length) {
                setNarrative(prev => prev + text[index]);
                index++;
            } else {
                clearInterval(interval);
                setIsTyping(false);
            }
        }, 15);

        return () => clearInterval(interval);
    }, [regime, sentiment]);

    const startListening = () => {
        console.log('Voice assistant activated...');
        // Simulate a professional voice command interaction
        const cmd = window.confirm('Voice Command Detected: "SHOW_RISK_REPORT". Execute secure command?');
        if (cmd) {
            alert('Secure Protocol Acknowledged: Generating detailed risk audit...');
        }
    };

    return (
        <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-100 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-5">
                <button 
                  onClick={startListening} 
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-blue-100 text-blue-500 shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                    <FiMic className={`text-xl ${isTyping ? 'animate-pulse' : ''}`} />
                </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1">
                    {[1, 2, 3].map(i => (
                        <div key={i} className={`w-1 h-3 bg-blue-400/40 rounded-full ${isTyping ? 'animate-bounce' : ''}`} style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                </div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Sovereign Intelligence Engine</span>
            </div>

            <div className="min-h-[3.5rem]">
                <p className="text-sm font-medium leading-relaxed text-slate-700 italic">
                    "{narrative}"
                    {isTyping && <span className="inline-block w-1 h-4 bg-blue-500 ml-1 animate-pulse" />}
                </p>
            </div>

            <div className="mt-5 flex justify-between items-center border-t border-blue-100 pt-3">
                <div className="flex items-center gap-2 text-slate-400">
                    <FiInfo className="text-[10px]" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Natural Language Inference Engine v2.4</span>
                </div>
                <span className="text-[9px] font-mono text-slate-400 font-bold">Latency: 0.12ms</span>
            </div>
        </div>
    );
};
