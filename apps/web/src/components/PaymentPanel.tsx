'use client';

import React, { useState } from 'react';
import { MotionDiv, MotionButton } from '@/components/Motion';
import { FiCreditCard, FiArrowUpRight, FiShield, FiGlobe } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface PaymentPanelProps {
  token: string;
  userId: string;
}

export const PaymentPanel: React.FC<PaymentPanelProps> = ({ token, userId }) => {
  const [amount, setAmount] = useState('1000');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);

  const handleDeposit = async () => {
    setLoading(true);
    const toastId = toast.loading(`Initiating ${currency} Deposit...`);
    
    try {
      // 1. Simulate Stripe Session Creation
      console.log(`💳 PROXY: Creating Stripe Session for ${amount} ${currency}`);
      
      // 2. Mock Backend Deposit Call
      await axios.post(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/v1/portfolio/deposit`, {
        userId,
        amount: parseFloat(amount),
        currency
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Funds Vaulted Successfully! Portfolio balancing in progress.', { id: toastId });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Vaulting Failed', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotionDiv 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-panel rounded-[3rem] p-12 border-glow relative overflow-hidden h-full"
    >
      <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
        <FiCreditCard className="text-[12rem]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-5 mb-10 border-b border-white/5 pb-8">
            <div className="p-4 bg-blue-500/10 rounded-3xl border border-blue-500/20">
                <FiCreditCard className="text-blue-400 text-3xl" />
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Capital Influx</p>
                <h3 className="text-3xl font-black italic tracking-tighter uppercase text-gradient-sovereign">Sovereign Vault</h3>
            </div>
        </div>

        <div className="space-y-8">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Injection Volume</label>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="col-span-2 bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-2xl font-black tracking-tighter focus:border-blue-500/50 outline-none transition-all"
                placeholder="1000"
              />
              <select 
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="col-span-1 bg-white/[0.05] border border-white/10 rounded-2xl p-4 text-sm font-black tracking-tighter outline-none cursor-pointer hover:bg-white/[0.1] transition-all"
              >
                <option value="USD" className="bg-slate-900">USD</option>
                <option value="INR" className="bg-slate-900">INR</option>
                <option value="EUR" className="bg-slate-900">EUR</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-white/[0.01] rounded-[2rem] border border-white/5 flex flex-col justify-between">
                <FiShield className="text-emerald-400 text-xl mb-3" />
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Secured by Stripe</p>
            </div>
            <div className="p-6 bg-white/[0.01] rounded-[2rem] border border-white/5 flex flex-col justify-between">
                <FiGlobe className="text-blue-400 text-xl mb-3" />
                <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Global Settlement</p>
            </div>
          </div>

          <MotionButton
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDeposit}
            disabled={loading}
            className={`w-full py-6 rounded-[2rem] text-xl font-black italic tracking-tighter uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${
                loading ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 text-white shadow-blue-600/20 hover:shadow-blue-600/40 hover:bg-blue-500'
            }`}
          >
            {loading ? 'SYNCHRONIZING...' : <>INJECT CAPITAL <FiArrowUpRight /></>}
          </MotionButton>
        </div>
      </div>
    </MotionDiv>
  );
};
