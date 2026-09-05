'use client';

import React, { useState, useCallback } from 'react';
import { MotionDiv, MotionButton } from '@/components/Motion';
import { FiCreditCard, FiArrowUpRight, FiShield, FiGlobe, FiCheckCircle, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import axios from 'axios';

interface PaymentPanelProps {
  token: string;
  userId: string;
}

type DepositStage = 'IDLE' | 'INITIATING' | 'VERIFYING' | 'ROUTING' | 'VAULTED' | 'FAILED';

const STAGE_LABELS: Record<DepositStage, string> = {
  IDLE: 'Ready',
  INITIATING: 'Initiating transfer…',
  VERIFYING: 'Verifying funds…',
  ROUTING: 'Routing to vault…',
  VAULTED: 'Capital vaulted!',
  FAILED: 'Transfer failed',
};

const STAGE_ORDER: DepositStage[] = ['INITIATING', 'VERIFYING', 'ROUTING', 'VAULTED'];

const QUICK_AMOUNTS = ['5000', '10000', '25000', '50000', '100000'];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const PaymentPanel: React.FC<PaymentPanelProps> = ({ token, userId }) => {
  const [amount, setAmount] = useState('10000');
  const [currency, setCurrency] = useState('INR');
  const [stage, setStage] = useState<DepositStage>('IDLE');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const isLoading = stage !== 'IDLE' && stage !== 'VAULTED' && stage !== 'FAILED';

  const validateAmount = (): string | null => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return 'Please enter a valid amount';
    if (val < 1) return 'Minimum deposit is ₹1';
    if (val > 100_000_000) return 'Maximum deposit is ₹10,00,00,000';
    return null;
  };

  const handleDeposit = useCallback(async () => {
    const validationError = validateAmount();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const idempotencyKey = crypto.randomUUID();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    setErrorMsg(null);
    setRetryCount(0);

    const attemptDeposit = async (attempt: number): Promise<void> => {
      setRetryCount(attempt - 1);

      setStage('INITIATING');
      await sleep(600);

      setStage('VERIFYING');
      await sleep(500);

      setStage('ROUTING');

      await axios.post(
        `${apiUrl}/api/v1/portfolio/deposit`,
        { userId, amount: parseFloat(amount), currency },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': idempotencyKey,
            'X-Attempt': String(attempt),
          },
          timeout: 15000,
        }
      );

      setStage('VAULTED');
      toast.success(`₹${Number(amount).toLocaleString('en-IN')} vaulted successfully! Portfolio updating…`);
    };

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await attemptDeposit(attempt);
        return;
      } catch (err: any) {
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.error;

        // Don't retry on client errors (400-range)
        if (status && status >= 400 && status < 500) {
          setStage('FAILED');
          setErrorMsg(serverMsg || `Deposit rejected: ${err.message}`);
          return;
        }

        if (attempt < MAX_RETRIES) {
          toast.error(`Attempt ${attempt} failed. Retrying… (${MAX_RETRIES - attempt} left)`);
          await sleep(Math.pow(2, attempt) * 500); // 1s, 2s
        } else {
          setStage('FAILED');
          setErrorMsg(serverMsg || `Deposit failed after ${MAX_RETRIES} attempts. Please try again.`);
        }
      }
    }
  }, [amount, currency, token, userId]);

  const reset = () => {
    setStage('IDLE');
    setErrorMsg(null);
    setRetryCount(0);
  };

  const stageIndex = STAGE_ORDER.indexOf(stage);

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-panel rounded-[2.5rem] p-10 border-glow relative overflow-hidden h-full flex flex-col"
    >
      {/* Background Glyph */}
      <div className="absolute top-0 right-0 p-10 opacity-[0.025] pointer-events-none">
        <FiCreditCard className="text-[10rem]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
          <div className="p-3.5 bg-blue-500/10 rounded-2xl border border-blue-500/20 shrink-0">
            <FiCreditCard className="text-blue-400 text-2xl" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Capital Influx</p>
            <h3 className="text-2xl font-black italic tracking-tighter text-gradient-sovereign">Sovereign Vault</h3>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-400">LIVE</span>
          </div>
        </div>

        {/* Quick Amount Chips */}
        <div className="mb-5">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Quick Select</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map(q => (
              <button
                key={q}
                onClick={() => setAmount(q)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-widest border transition-all ${
                  amount === q
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:border-blue-500/40 hover:text-white'
                }`}
              >
                ₹{Number(q).toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {/* Amount + Currency */}
        <div className="mb-6">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 mb-2 block">
            Injection Volume
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'}
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl pl-9 pr-4 py-4 text-2xl font-black tracking-tighter focus:border-blue-500/50 outline-none transition-all text-white disabled:opacity-50"
                placeholder="10000"
                min="1"
              />
            </div>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={isLoading}
              className="col-span-1 bg-white/[0.05] border border-white/10 rounded-2xl px-4 text-sm font-black tracking-tighter outline-none cursor-pointer hover:bg-white/[0.08] transition-all text-white"
            >
              <option value="INR" className="bg-slate-900">INR ₹</option>
              <option value="USD" className="bg-slate-900">USD $</option>
              <option value="EUR" className="bg-slate-900">EUR €</option>
            </select>
          </div>
          {currency !== 'INR' && (
            <p className="text-[10px] text-slate-500 mt-2 ml-1">
              ≈ ₹{(parseFloat(amount || '0') * (currency === 'USD' ? 83.5 : 90.2)).toLocaleString('en-IN', { maximumFractionDigits: 0 })} INR (indicative rate)
            </p>
          )}
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center gap-3">
            <FiShield className="text-emerald-400 text-lg shrink-0" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">AES-256 Encrypted</p>
          </div>
          <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/5 flex items-center gap-3">
            <FiGlobe className="text-blue-400 text-lg shrink-0" />
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight">Global Settlement</p>
          </div>
        </div>

        {/* Stage Progress Stepper */}
        {stage !== 'IDLE' && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {retryCount > 0 ? `Retry ${retryCount}/${2} — ` : ''}{STAGE_LABELS[stage]}
              </span>
              {retryCount > 0 && <FiRefreshCw className="text-amber-400 text-xs animate-spin" />}
            </div>
            <div className="flex items-center gap-2">
              {STAGE_ORDER.map((s, i) => {
                const isDone = stageIndex > i || stage === 'VAULTED';
                const isActive = stageIndex === i;
                return (
                  <React.Fragment key={s}>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all duration-500 ${
                      isDone ? 'bg-emerald-500 text-slate-950' :
                      isActive ? 'bg-blue-600 text-white animate-pulse' :
                      'bg-white/5 text-slate-600'
                    }`}>
                      {isDone ? <FiCheckCircle size={12} /> : i + 1}
                    </div>
                    {i < STAGE_ORDER.length - 1 && (
                      <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                        isDone ? 'bg-emerald-500' : 'bg-white/5'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              {STAGE_ORDER.map(s => (
                <span key={s} className="text-[8px] text-slate-600 uppercase tracking-wider font-bold">{s}</span>
              ))}
            </div>
          </MotionDiv>
        )}

        {/* Error Display */}
        {stage === 'FAILED' && errorMsg && (
          <MotionDiv
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3"
          >
            <FiAlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={14} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-rose-300 leading-relaxed">{errorMsg}</p>
            </div>
            <button onClick={reset} className="text-rose-400/60 hover:text-rose-400 transition-colors shrink-0 text-xs">✕</button>
          </MotionDiv>
        )}

        {/* CTA Button */}
        <div className="mt-auto space-y-3">
          {stage === 'VAULTED' ? (
            <MotionDiv initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="space-y-3">
              <div className="w-full py-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-3">
                <FiCheckCircle className="text-emerald-400 text-xl" />
                <span className="text-base font-black italic tracking-tighter text-emerald-400 uppercase">Capital Vaulted!</span>
              </div>
              <button
                onClick={reset}
                className="w-full py-3.5 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest text-slate-400 hover:bg-white/5 transition-all"
              >
                New Deposit
              </button>
            </MotionDiv>
          ) : (
            <MotionButton
              whileHover={{ scale: isLoading ? 1 : 1.02 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              onClick={stage === 'FAILED' ? handleDeposit : handleDeposit}
              disabled={isLoading}
              className={`w-full py-5 rounded-2xl text-base font-black italic tracking-tighter uppercase transition-all shadow-xl flex items-center justify-center gap-3 ${
                isLoading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : stage === 'FAILED'
                  ? 'bg-amber-500 text-slate-950 shadow-amber-500/20 hover:bg-amber-400'
                  : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-blue-600/30 hover:shadow-blue-600/50'
              }`}
            >
              {isLoading ? (
                <><FiRefreshCw className="animate-spin" size={16} />{STAGE_LABELS[stage]}</>
              ) : stage === 'FAILED' ? (
                <><FiRefreshCw size={16} />Retry Deposit</>
              ) : (
                <>INJECT CAPITAL <FiArrowUpRight size={16} /></>
              )}
            </MotionButton>
          )}

          <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest">
            Idempotent · Retry-Safe · AES-256 Encrypted
          </p>
        </div>
      </div>
    </MotionDiv>
  );
};
