'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Layout } from '@/components/Layout';
import { EmptyState, PageIntro, SectionCard } from '@/components/EnterpriseUI';
import { useApi } from '@/hooks/useApi';
import { useRealtimeSignals } from '@/hooks/useRealtime';
import { TradeSignal } from '@/types';

import { MultiAgentDebateCenter } from '@/components/MultiAgentDebateCenter';

const defaultSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];

export default function SignalsPage() {
  const router = useRouter();
  const { post, loading } = useApi();
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const realtimeSignals = useRealtimeSignals(token);
  const [symbol, setSymbol] = useState('');
  const [generatedSignals, setGeneratedSignals] = useState<TradeSignal[]>([]);

  useEffect(() => {
    if (!token) {
      router.push('/login');
    }
  }, [router, token]);

  const mergedSignals = useMemo(() => {
    const live = Array.from(realtimeSignals.signals.values()).map((signal) => ({
      symbol: signal.symbol,
      signal: signal.signal,
      confidence: signal.confidence,
      reasoning: signal.reasoning,
      price_target: 0,
    }));

    const bySymbol = new Map<string, TradeSignal>();
    [...generatedSignals, ...live].forEach((entry) => bySymbol.set(entry.symbol, entry));
    return Array.from(bySymbol.values());
  }, [generatedSignals, realtimeSignals.signals]);

  const generateSignal = async (targetSymbol: string) => {
    try {
      const result = await post('/api/v1/ai/generate-signal', { symbol: targetSymbol });
      setGeneratedSignals((current) => [result, ...current.filter((item) => item.symbol !== targetSymbol)]);
      toast.success(`Signal generated for ${targetSymbol}`);
    } catch (err) {
      toast.error('Unable to generate signal');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageIntro
          badge="Autonomous AI Swarm"
          title="Multi-Agent Consensus & Trading Terminal"
          description="Specialized LLM & quantitative agents debate live price action, catalysts, and risk limits in real time."
        />

        {/* Multi-Agent Swarm Terminal */}
        <MultiAgentDebateCenter />

        <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <SectionCard title="Generate Signal" description="Request a new AI signal for a symbol or use one of the quick actions.">
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!symbol.trim()) {
                  toast.error('Enter a symbol');
                  return;
                }
                await generateSignal(symbol.trim().toUpperCase());
                setSymbol('');
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Ticker</span>
                <input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder="Enter NSE ticker"
                  className="input-field"
                />
              </label>
              <button type="submit" disabled={loading} className="primary-button w-full">
                {loading ? 'Generating...' : 'Generate signal'}
              </button>
            </form>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {defaultSymbols.map((item) => (
                <button key={item} type="button" onClick={() => generateSignal(item)} disabled={loading} className="secondary-button justify-between">
                  <span>{item}</span>
                  <span className="text-xs text-slate-400">Quick run</span>
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recommendations" description="Latest live or generated signal cards in the new white enterprise layout.">
            {mergedSignals.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {mergedSignals.map((signal) => {
                  const tone =
                    signal.signal === 'BUY'
                      ? 'bg-emerald-50 text-emerald-700'
                      : signal.signal === 'SELL'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-slate-100 text-slate-600';

                  return (
                    <div key={signal.symbol} className="app-card-muted p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{signal.symbol}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">AI Recommendation</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{signal.signal}</span>
                      </div>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Confidence</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">{Math.round(signal.confidence * 100)}%</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Target</p>
                          <p className="mt-1 text-lg font-semibold text-slate-900">
                            {signal.price_target ? `INR ${signal.price_target.toFixed(2)}` : 'Not provided'}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-slate-500">{signal.reasoning}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No signal cards yet" description="Generate a recommendation or wait for a live signal message to populate the board." />
            )}
          </SectionCard>
        </div>
      </div>
    </Layout>
  );
}
