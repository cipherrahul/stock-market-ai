'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { Layout } from '@/components/Layout';
import { Order } from '@/types';
import toast from 'react-hot-toast';
import { MotionDiv, MotionTr } from '@/components/Motion';
import { FiList, FiFilter, FiShield } from 'react-icons/fi';

export default function OrderHistoryPage() {
  const router = useRouter();
  const { get, loading } = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('all');
  const userId = typeof localStorage !== 'undefined' ? localStorage.getItem('userId') : null;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const loadOrders = async () => {
      try {
        const data = await get(`/api/v1/trading/history/${userId}`);
        setOrders(data || []);
      } catch (error) {
        toast.error('Registry Failure: Failed to load order history');
      }
    };

    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [userId, get]);

  useEffect(() => {
    let filtered = orders;
    if (filter === 'buy') {
      filtered = orders.filter(o => o.side === 'BUY');
    } else if (filter === 'sell') {
      filtered = orders.filter(o => o.side === 'SELL');
    }
    setFilteredOrders(filtered);
  }, [orders, filter]);

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
               <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <FiList className="text-indigo-400 text-sm" />
               </div>
               <span className="text-indigo-400 font-black tracking-[0.3em] uppercase text-[9px]">Sovereign Registry // Transactional Ledger</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter italic uppercase text-white leading-none">
              REGISTRY
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Immutable Archive of Autonomous Executions</p>
          </div>

          <div className="flex gap-4">
             <div className="glass-panel px-6 py-4 rounded-2xl flex items-center gap-4 bg-white/[0.01] border border-white/5">
                <FiShield className="text-emerald-400" />
                <div>
                   <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Integrity</p>
                   <p className="text-[10px] font-bold text-white uppercase tracking-tighter">VERIFIED_LEDGER</p>
                </div>
             </div>
          </div>
        </MotionDiv>

        {/* Global Filters */}
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
           <div className="flex items-center gap-3">
              <FiFilter className="text-slate-600" />
              <div className="flex gap-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                {['all', 'buy', 'sell'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      filter === f
                        ? 'bg-white text-slate-950 shadow-xl'
                        : 'text-slate-500 hover:text-white'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
           </div>
           
           <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">
              Displaying {filteredOrders.length} Synchronized Entries
           </p>
        </div>

        {/* High-Fidelity Table */}
        <MotionDiv 
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel rounded-[3rem] border border-white/5 bg-white/[0.01] overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/[0.02]">
                  <th className="px-10 py-6 text-left">Timestamp</th>
                  <th className="px-10 py-6 text-left">Asset</th>
                  <th className="px-10 py-6 text-left">Vector</th>
                  <th className="px-10 py-6 text-left">Quantity</th>
                  <th className="px-10 py-6 text-left">Execution Price</th>
                  <th className="px-10 py-6 text-left">Total Value</th>
                  <th className="px-10 py-6 text-right">Protocol Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-10 py-24 text-center">
                       <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Retrieving Secure Archive...</p>
                       </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-10 py-24 text-center">
                       <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest italic">Registry Empty // No Executions Logged</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order, idx) => (
                    <MotionTr 
                      key={order.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-white/[0.02] transition-all group"
                    >
                      <td className="px-10 py-6">
                         <p className="text-xs font-bold text-slate-500 font-mono">
                           {new Date(order.createdAt).toLocaleDateString()}
                         </p>
                         <p className="text-[9px] font-black text-slate-700 uppercase tracking-tighter mt-1">
                           {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </p>
                      </td>
                      <td className="px-10 py-6">
                         <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                            <p className="text-sm font-black text-white italic tracking-tighter">{order.symbol}</p>
                         </div>
                      </td>
                      <td className="px-10 py-6">
                        <span
                          className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            order.side === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {order.side}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-xs font-black text-white font-mono">{order.quantity}</td>
                      <td className="px-10 py-6 text-xs font-bold text-slate-400 font-mono">₹{order.price.toLocaleString()}</td>
                      <td className="px-10 py-6">
                        <p className="text-sm font-black text-white font-mono tracking-tighter">
                          ₹{(order.quantity * order.price).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <span
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            order.status === 'executed'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : order.status === 'pending'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {order.status}_SYNCED
                        </span>
                      </td>
                    </MotionTr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </MotionDiv>

        {/* Compliance Footer */}
        <div className="flex justify-center items-center gap-6 opacity-20">
           <div className="h-[1px] w-20 bg-white/10" />
           <p className="text-[8px] font-black text-white uppercase tracking-[0.5em]">Encrypted Audit Log Active</p>
           <div className="h-[1px] w-20 bg-white/10" />
        </div>
      </div>
    </Layout>
  );
}
