'use client';

import { MotionDiv } from '@/components/Motion';
import { AnimatePresence } from 'framer-motion';
import { FiBriefcase, FiTarget, FiActivity, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi';
import { useRealtimePortfolio, useRealtimeOrders } from '@/hooks/useRealtime';

interface PortfolioDashboardProps {
  token: string;
  userId: string;
  isPaper?: boolean;
}

export function PortfolioDashboard({ token, userId, isPaper = false }: PortfolioDashboardProps) {
  const { portfolio, connected: portfolioConnected, error: portfolioError } = useRealtimePortfolio(token, userId, isPaper);
  const { orders, connected: ordersConnected } = useRealtimeOrders(token, isPaper);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* 1. PORTFOLIO SUMMARY CARD */}
        <MotionDiv 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="xl:col-span-2 glass-panel rounded-[3rem] p-12 border-glow relative overflow-hidden h-full flex flex-col justify-between"
        >
          <div className="absolute top-0 right-0 p-16 opacity-[0.03]">
            <FiBriefcase className="text-[15rem]" />
          </div>

          <div>
             <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
                <div className="flex items-center gap-5">
                    <div className="p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20">
                        <FiBriefcase className="text-indigo-400 text-3xl" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Asset Intelligence</p>
                        <h3 className="text-3xl font-black italic tracking-tighter uppercase text-gradient-sovereign">Sovereign Equity</h3>
                    </div>
                </div>
                <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border transition-all ${portfolioConnected ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-rose-500/30 text-rose-400 bg-rose-500/5'}`}>
                   {portfolioConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </div>
             </div>

             {portfolioError && (
               <div className="mb-8 p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-widest flex items-center gap-3">
                 <span>⚠️</span> PORTFOLIO_FAULT: {portfolioError}
               </div>
             )}

             {portfolio ? (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="p-10 bg-white/[0.02] rounded-[2.5rem] border border-white/5 group hover:bg-white/[0.04] transition-all">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Unified Liquidity</p>
                    <div className="space-y-4">
                      {portfolio.balances ? portfolio.balances.map((b: any) => (
                        <div key={b.currency} className="flex justify-between items-end">
                           <span className="text-[10px] font-bold text-slate-600">{b.currency}</span>
                           <p className="text-3xl font-black italic tracking-tighter">
                             {b.currency === 'INR' ? '₹' : '$'}{ (Number(b.cash) / 100).toLocaleString(b.currency === 'INR' ? 'en-IN' : 'en-US') }
                           </p>
                        </div>
                      )) : (
                        <p className="text-5xl font-black italic tracking-tighter">
                          ₹{portfolio.totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                  </div>

                 <div className="p-10 bg-white/[0.02] rounded-[2.5rem] border border-white/5 group hover:bg-white/[0.04] transition-all">
                   <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Absolute Gain</p>
                   <div className="flex items-end gap-2">
                     <p className={`text-4xl font-black italic tracking-tighter ${portfolio.totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {portfolio.totalGain >= 0 ? '+' : ''}₹{Math.abs(portfolio.totalGain).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                     </p>
                     {portfolio.totalGain >= 0 ? <FiArrowUpRight className="text-emerald-400 text-2xl mb-1" /> : <FiArrowDownRight className="text-rose-400 text-2xl mb-1" />}
                   </div>
                 </div>

                 <div className="p-10 bg-white/[0.02] rounded-[2.5rem] border border-white/5 group hover:bg-white/[0.04] transition-all">
                   <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Alpha Variance</p>
                   <p className={`text-5xl font-black italic tracking-tighter ${portfolio.gainPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {portfolio.gainPercent >= 0 ? '+' : ''}{portfolio.gainPercent.toFixed(2)}<span className="text-xl opacity-40">%</span>
                   </p>
                 </div>
               </div>
             ) : (
               <div className="h-40 flex items-center justify-center opacity-20">
                 <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Synchronizing Ledger...</p>
               </div>
             )}
          </div>

          {portfolio && (
            <div className="mt-12 text-[9px] font-black text-slate-600 uppercase tracking-widest italic flex justify-between">
                <span>Last Reconciliation: {new Date(portfolio.timestamp).toLocaleTimeString()}</span>
                <span>Audit Ref: SOV-{userId.slice(0,6).toUpperCase()}</span>
            </div>
          )}
        </MotionDiv>

        {/* 2. RECENT ORDERS STREAM */}
        <MotionDiv 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel rounded-[3rem] p-10 border-glow h-full flex flex-col"
        >
          <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
            <h3 className="text-lg font-black italic tracking-tighter uppercase flex items-center gap-3">
              <FiActivity className="text-blue-400" /> ORDER_STREAM
            </h3>
            <div className={`w-2 h-2 rounded-full ${ordersConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
                {orders && orders.length > 0 ? (
                  orders.slice(0, 15).map((order) => (
                    <MotionDiv 
                      key={order.orderId}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-5 bg-white/[0.02] rounded-3xl border border-white/5 flex justify-between items-center group hover:bg-white/[0.04] transition-all"
                    >
                      <div>
                        <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">REQ_ACK_{order.orderId.slice(0, 6)}</p>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase ${order.status === 'EXECUTED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                {order.status}
                            </span>
                            <span className="text-sm font-black italic uppercase tracking-tighter text-slate-300">{order.symbol || 'SYSTEM'}</span>
                        </div>
                        {order.memo && (
                          <p className="mt-2 text-[8px] font-bold text-blue-400/60 leading-tight italic max-w-[150px]">
                            "{order.memo}"
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black italic tracking-tighter">
                            {order.executedPrice ? `${order.symbol?.match(/^[A-Z]{1,5}$/) && !['RELIANCE', 'TCS', 'INFY', 'WIPRO'].includes(order.symbol) ? '$' : '₹'}${order.executedPrice.toLocaleString()}` : 'PENDING'}
                        </p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase italic">
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </MotionDiv>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 py-20">
                    <FiActivity className="text-6xl mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Activity Clusters</p>
                  </div>
                )}
            </AnimatePresence>
          </div>
        </MotionDiv>
      </div>

      {/* 3. ASSET POSITIONS LEDGER */}
      <MotionDiv 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-[3rem] p-12 border-glow"
      >
        <div className="flex justify-between items-center mb-12 border-b border-white/5 pb-8">
            <div className="flex items-center gap-5">
                <div className="p-4 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                    <FiTarget className="text-emerald-400 text-3xl" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Exposure</p>
                    <h3 className="text-3xl font-black italic tracking-tighter uppercase text-gradient-sovereign">Active Ledger</h3>
                </div>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregate Positions</p>
                <p className="text-2xl font-black italic tracking-tighter">{portfolio?.positions?.length || 0}</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {portfolio?.positions && portfolio.positions.length > 0 ? (
            portfolio.positions.map((position) => (
              <MotionDiv 
                whileHover={{ scale: 1.02 }}
                key={position.symbol} 
                className="p-8 bg-white/[0.01] rounded-[2.5rem] border border-white/5 relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                    <FiArrowUpRight className="text-6xl" />
                </div>
                
                <div className="flex justify-between items-start mb-6">
                   <h4 className="text-2xl font-black italic tracking-tight uppercase text-slate-200">{position.symbol}</h4>
                   <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Qty: {position.quantity}</span>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-end border-b border-white/5 pb-4">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Value (Spot)</span>
                        <p className="text-xl font-black italic tracking-tighter">
                            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'].includes(position.symbol) ? '$' : '₹'}{position.currentPrice.toLocaleString()}
                        </p>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Cost Basis</span>
                        <p className="text-sm font-bold text-slate-500">
                            {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META'].includes(position.symbol) ? '$' : '₹'}{position.avgCost.toFixed(1)}
                        </p>
                    </div>
                </div>
              </MotionDiv>
            ))
          ) : (
            <div className="col-span-full py-24 flex flex-col items-center justify-center opacity-10">
                <FiTarget className="text-8xl mb-6" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Systemic Exposure Detected</p>
            </div>
          )}
        </div>
      </MotionDiv>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
