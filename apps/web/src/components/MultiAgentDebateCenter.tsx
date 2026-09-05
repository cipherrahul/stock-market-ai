'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { AutonomousPipelineTelemetry } from './AutonomousPipelineTelemetry';

interface AgentPerspective {
  agent: string;
  bias?: string;
  sentiment_bias?: string;
  confidence?: number;
  sentiment_score?: number;
  thesis: string;
  key_signals?: string[];
  primary_catalyst?: string;
  approved?: boolean;
  stop_loss?: number;
  take_profit?: number;
  veto_reason?: string | null;
  audit_verdict?: string;
}

interface AnalysisResult {
  symbol: string;
  price: number;
  decision: 'BUY' | 'SELL' | 'HOLD';
  quantity: number;
  conviction: number;
  executive_memo: string;
  risk_parameters: {
    stop_loss: number;
    take_profit: number;
    risk_reward_ratio: number;
    approved: boolean;
    veto_reason?: string | null;
  };
  agent_perspectives: {
    technical: AgentPerspective;
    sentiment: AgentPerspective;
    risk: AgentPerspective;
  };
  market_indicators: {
    rsi: number;
    regime: string;
    levels: { support: number; resistance: number };
    moving_averages: { ema_20: number; ema_50: number; golden_cross: boolean };
    setup_evaluation?: any;
    regime_details?: any;
    anomalies?: any[];
  };
  setup_evaluation?: {
    composite_score: number;
    directional_bias: string;
    quality_tier: string;
    factor_scores: {
      trend: number;
      momentum: number;
      liquidity: number;
      structure: number;
    };
    anomaly_count: number;
    critical_anomalies: number;
  };
  regime_details?: {
    id: string;
    label: string;
    description: string;
    trend_strength: number;
    bandwidth: number;
    atr_percent: number;
  };
  anomalies?: Array<{
    code: string;
    name: string;
    severity: 'WARNING' | 'CRITICAL';
    description: string;
    metrics?: Record<string, any>;
  }>;
  debate_log: Array<{
    agent: string;
    role: string;
    stage: string;
    thought: string;
    timestamp: string;
  }>;
}

const QUICK_TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'RELIANCE', 'TCS'];

export function MultiAgentDebateCenter() {
  const [symbol, setSymbol] = useState('NVDA');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const runAnalysis = async (targetSymbol: string) => {
    setLoading(true);
    const sym = targetSymbol.trim().toUpperCase();
    try {
      // Hit Gateway or AI Engine endpoint
      const response = await fetch('/api/v1/agents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, account_balance: 100000, publish_signal: false })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data: AnalysisResult = await response.json();
      setResult(data);
      toast.success(`Multi-Agent consensus reached for ${sym}`);
    } catch (err: any) {
      toast.error(`Agent analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeOrder = async () => {
    if (!result || result.decision === 'HOLD') {
      toast.error('Cannot execute: Decision is HOLD or no consensus');
      return;
    }

    setExecuting(true);
    try {
      const response = await fetch('/api/v1/trading/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: result.symbol,
          quantity: result.quantity,
          side: result.decision,
          price: result.price,
          stopLoss: result.risk_parameters.stop_loss,
          takeProfit: result.risk_parameters.take_profit,
          memo: result.executive_memo,
          isPaper: true,
        })
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`Order executed! ID: ${data.orderId || 'CONFIRMED'}`);
      } else {
        toast.error(`Order failed: ${data.error || 'Server error'}`);
      }
    } catch (err: any) {
      toast.error(`Execution error: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Autonomous Multi-Agent Swarm
            </div>
            <h2 className="text-xl font-bold tracking-tight">Quantitative Agent Consensus Terminal</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              4 specialized LLM & quantitative agents debate live price action, catalysts, and risk limits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Ticker (e.g. NVDA)"
              className="bg-slate-800/90 border border-slate-700 text-white font-mono uppercase px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-36"
            />
            <button
              onClick={() => runAnalysis(symbol)}
              disabled={loading || !symbol.trim()}
              className="px-5 py-2 rounded-lg font-medium text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Debating...
                </>
              ) : (
                'Run Agent Debate'
              )}
            </button>
          </div>
        </div>

        {/* Quick Tickers */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800/80">
          <span className="text-xs text-slate-400">Quick analysis:</span>
          {QUICK_TICKERS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setSymbol(t);
                runAnalysis(t);
              }}
              disabled={loading}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors"
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Results View */}
      {result && (
        <div className="space-y-6">
          {/* Executive Verdict Banner */}
          <div className={`rounded-xl p-6 border shadow-lg ${
            result.decision === 'BUY'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100'
              : result.decision === 'SELL'
              ? 'bg-rose-950/40 border-rose-500/30 text-rose-100'
              : 'bg-slate-900 border-slate-800 text-slate-100'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-md font-bold text-sm uppercase ${
                    result.decision === 'BUY'
                      ? 'bg-emerald-500 text-slate-950'
                      : result.decision === 'SELL'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}>
                    {result.decision}
                  </span>
                  <h3 className="text-xl font-bold font-mono">
                    {result.symbol} @ ${result.price.toFixed(2)}
                  </h3>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Conviction: {(result.conviction * 100).toFixed(0)}%
                  </span>
                  {result.quantity > 0 && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Target Units: {result.quantity}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-4xl">
                  {result.executive_memo}
                </p>
              </div>

              {result.decision !== 'HOLD' && (
                <button
                  onClick={executeOrder}
                  disabled={executing}
                  className={`px-6 py-3 rounded-lg font-semibold text-sm transition-all whitespace-nowrap shadow-md ${
                    result.decision === 'BUY'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {executing ? 'Executing Order...' : `Execute Paper ${result.decision} Order`}
                </button>
              )}
            </div>

            {/* Risk Parameters Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-800/80">
              <div>
                <div className="text-xs text-slate-400">Stop-Loss Target</div>
                <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
                  ${result.risk_parameters.stop_loss}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Take-Profit Target</div>
                <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
                  ${result.risk_parameters.take_profit}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Risk : Reward Ratio</div>
                <div className="text-base font-bold font-mono text-slate-200 mt-0.5">
                  1 : {result.risk_parameters.risk_reward_ratio.toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Risk Guardian Audit</div>
                <div className="text-base font-bold text-slate-200 mt-0.5 flex items-center gap-1.5">
                  {result.risk_parameters.approved ? (
                    <span className="text-emerald-400">✅ Approved</span>
                  ) : (
                    <span className="text-amber-400">⏸️ Vetoed</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4-STAGE AUTONOMOUS PIPELINE TELEMETRY */}
          <AutonomousPipelineTelemetry
            symbol={result.symbol}
            price={result.price}
            decision={result.decision}
            compositeScore={result.setup_evaluation?.composite_score ?? Math.round(result.conviction * 100)}
            qualityTier={result.setup_evaluation?.quality_tier ?? (result.conviction >= 0.75 ? 'TIER_1_PRIME' : 'TIER_2_SELECT')}
            regime={result.market_indicators?.regime || result.regime_details?.id || 'BULL_TRENDING'}
            regimeDetails={result.regime_details || result.market_indicators?.regime_details}
            factorScores={result.setup_evaluation?.factor_scores}
            anomalies={result.anomalies || result.market_indicators?.anomalies || []}
            ruleVerdict={result.risk_parameters.approved ? 'APPROVED' : 'VETOED'}
            vetoReason={result.risk_parameters.veto_reason || undefined}
          />

          {/* 3 Specialized Agent Stances */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Technical Analyst */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📈</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Technical Analyst</h4>
                    <p className="text-xs text-slate-400">Trend, Momentum & Indicators</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                  result.agent_perspectives.technical.bias === 'BULLISH'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : result.agent_perspectives.technical.bias === 'BEARISH'
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {result.agent_perspectives.technical.bias}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.agent_perspectives.technical.thesis}
                </p>
                <div className="bg-slate-950 rounded-lg p-3 text-xs font-mono space-y-1 text-slate-300 border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">RSI (14):</span>
                    <span className="font-bold">{result.market_indicators.rsi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Regime:</span>
                    <span>{result.market_indicators.regime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Support / Resistance:</span>
                    <span>${result.market_indicators.levels.support} / ${result.market_indicators.levels.resistance}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* News Sentiment Analyst */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📰</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">News & Catalyst Agent</h4>
                    <p className="text-xs text-slate-400">Headlines & Semantic Impact</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                  (result.agent_perspectives.sentiment.sentiment_score || 0) > 0.15
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : (result.agent_perspectives.sentiment.sentiment_score || 0) < -0.15
                    ? 'bg-rose-500/20 text-rose-400'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  Score: {result.agent_perspectives.sentiment.sentiment_score?.toFixed(2) || '0.00'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.agent_perspectives.sentiment.thesis}
                </p>
                <div className="bg-slate-950 rounded-lg p-3 text-xs font-mono space-y-1 text-slate-300 border border-slate-800">
                  <div className="text-slate-500 mb-1 font-sans">Primary Catalyst:</div>
                  <div className="text-slate-200 line-clamp-2">
                    {result.agent_perspectives.sentiment.primary_catalyst}
                  </div>
                </div>
              </div>
            </div>

            {/* Risk Guardian */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <h4 className="font-semibold text-white text-sm">Risk Guardian (Devil's Advocate)</h4>
                    <p className="text-xs text-slate-400">Veto Power & Volatility Sizing</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                  result.agent_perspectives.risk.approved
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {result.agent_perspectives.risk.approved ? 'APPROVED' : 'VETOED'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  {result.agent_perspectives.risk.audit_verdict}
                </p>
                <div className="bg-slate-950 rounded-lg p-3 text-xs font-mono space-y-1 text-slate-300 border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ATR Stop Loss:</span>
                    <span className="text-rose-400 font-bold">${result.risk_parameters.stop_loss}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ATR Profit Target:</span>
                    <span className="text-emerald-400 font-bold">${result.risk_parameters.take_profit}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Debate Thought Stream */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow">
            <h4 className="font-semibold text-white text-base mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Live Agent Reasoning & Debate Transcript
            </h4>

            <div className="space-y-3">
              {result.debate_log.map((thought, idx) => (
                <div key={idx} className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs flex gap-3 items-start font-mono">
                  <span className="text-slate-500 whitespace-nowrap">
                    {thought.timestamp ? new Date(thought.timestamp).toLocaleTimeString() : `Step ${idx+1}`}
                  </span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-400 font-sans">{thought.agent}</span>
                      <span className="text-slate-500">({thought.stage})</span>
                    </div>
                    <div className="text-slate-300 font-sans">{thought.thought}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
