'use client';

import { FiAlertCircle, FiX, FiCheckCircle, FiZap, FiShield } from 'react-icons/fi';
import { useRealtimeAlerts } from '@/hooks/useRealtime';
import { MotionDiv } from '@/components/Motion';
import { AnimatePresence } from 'framer-motion';

export const AlertContainer: React.FC = () => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const { alerts, removeAlert } = useRealtimeAlerts(token);

  return (
    <div className="fixed top-10 right-10 space-y-6 z-[9999] pointer-events-none w-full max-w-md">
      <AnimatePresence mode="popLayout">
        {alerts.map((alert) => (
          <MotionDiv
            key={alert.id}
            layout
            initial={{ opacity: 0, x: 100, scale: 0.9, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.8, x: 50, filter: 'blur(10px)', transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="pointer-events-auto"
          >
            <div className={`glass-panel rounded-[2rem] p-6 border-glow relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
              alert.event === 'STOP_LOSS' || alert.event === 'LIQUIDATION' || alert.event === 'CRITICAL_FAULT'
                ? 'bg-rose-500/[0.05] border-rose-500/30'
                : alert.event === 'TAKE_PROFIT' || alert.event === 'EXECUTION_SUCCESS'
                ? 'bg-emerald-500/[0.05] border-emerald-500/30'
                : 'bg-blue-500/[0.05] border-blue-500/30'
            }`}>
              {/* Highlight bar */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                alert.event === 'STOP_LOSS' || alert.event === 'LIQUIDATION' || alert.event === 'CRITICAL_FAULT'
                  ? 'bg-rose-500'
                  : alert.event === 'TAKE_PROFIT' || alert.event === 'EXECUTION_SUCCESS'
                  ? 'bg-emerald-500'
                  : 'bg-blue-500'
              }`} />

              <div className="flex items-start gap-5">
                <div className={`mt-1 p-3 rounded-2xl ${
                  alert.event === 'STOP_LOSS' || alert.event === 'LIQUIDATION' || alert.event === 'CRITICAL_FAULT'
                    ? 'bg-rose-500/10 text-rose-400'
                    : alert.event === 'TAKE_PROFIT' || alert.event === 'EXECUTION_SUCCESS'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {alert.event === 'TAKE_PROFIT' || alert.event === 'EXECUTION_SUCCESS' ? <FiCheckCircle className="text-xl" /> : 
                   alert.event === 'CRITICAL_FAULT' ? <FiZap className="text-xl" /> :
                   <FiAlertCircle className="text-xl" />}
                </div>

                <div className="flex-1">
                  <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1.5 italic ${
                    alert.event === 'STOP_LOSS' || alert.event === 'LIQUIDATION' || alert.event === 'CRITICAL_FAULT'
                      ? 'text-rose-400'
                      : alert.event === 'TAKE_PROFIT' || alert.event === 'EXECUTION_SUCCESS'
                      ? 'text-emerald-400'
                      : 'text-blue-400'
                  }`}>
                    {alert.event?.replace(/_/g, ' ') || 'SYSTEM_SIGNAL'}
                  </h4>
                  <p className="text-sm font-black italic tracking-tighter text-slate-200 leading-tight mb-2">
                    {alert.symbol && <span className="text-white">[{alert.symbol}] </span>}
                    {alert.message || `Operational threshold reached at ₹${alert.triggerPrice?.toLocaleString()}`}
                  </p>
                  <div className="flex justify-between items-center opacity-40">
                    <span className="text-[8px] font-mono tracking-widest uppercase flex items-center gap-1">
                        <FiShield className="text-[10px]" /> Verified Reality
                    </span>
                    <span className="text-[8px] font-mono">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => removeAlert(alert.id)}
                  className="mt-1 opacity-20 hover:opacity-100 p-2 hover:bg-white/5 rounded-xl transition-all"
                >
                  <FiX />
                </button>
              </div>
            </div>
          </MotionDiv>
        ))}
      </AnimatePresence>
    </div>
  );
};
