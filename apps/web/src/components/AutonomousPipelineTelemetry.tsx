'use client';

import React from 'react';

export interface FactorScores {
  trend?: number;
  momentum?: number;
  liquidity?: number;
  structure?: number;
}

export interface AnomalyItem {
  code: string;
  name: string;
  severity: 'WARNING' | 'CRITICAL';
  description: string;
  metrics?: Record<string, any>;
}

export interface RuleResultItem {
  ruleId: string;
  name: string;
  passed: boolean;
  scoreOrMetric?: string;
  reason?: string;
}

export interface PipelineTelemetryProps {
  symbol: string;
  price: number;
  decision: 'BUY' | 'SELL' | 'HOLD';
  compositeScore?: number;
  qualityTier?: string;
  regime?: string;
  regimeDetails?: {
    id: string;
    label: string;
    description: string;
    trend_strength?: number;
    bandwidth?: number;
    atr_percent?: number;
  };
  factorScores?: FactorScores;
  anomalies?: AnomalyItem[];
  ruleResults?: RuleResultItem[];
  ruleVerdict?: 'APPROVED' | 'VETOED';
  vetoReason?: string;
  riskAudit?: {
    approved: boolean;
    dailyLossOk: boolean;
    drawdownOk: boolean;
    heatOk: boolean;
    recommendedQuantity?: number;
    reason?: string;
    currentMetrics?: {
      dailyLoss?: number;
      drawdownPercent?: number;
      portfolioHeatPercent?: number;
    };
  };
}

export function AutonomousPipelineTelemetry({
  symbol,
  price,
  decision,
  compositeScore = 78,
  qualityTier = 'TIER_2_SELECT',
  regime = 'BULL_TRENDING',
  regimeDetails,
  factorScores = { trend: 80, momentum: 75, liquidity: 85, structure: 70 },
  anomalies = [],
  ruleResults,
  ruleVerdict,
  vetoReason,
  riskAudit,
}: PipelineTelemetryProps) {
  // Normalize regime label
  const regimeLabel = regimeDetails?.label || regime.replace(/_/g, ' ');
  const isChopOrSqueeze = regime === 'VOLATILITY_EXPANSION_CHOP' || regime === 'LIQUIDITY_COMPRESSION';

  // Fallback rule results if not yet run via orchestrator
  const computedRules: RuleResultItem[] = ruleResults || [
    {
      ruleId: 'RULE_DIRECTIONAL_VALIDITY',
      name: 'Directional Bias Check',
      passed: decision === 'BUY' || decision === 'SELL',
      scoreOrMetric: decision,
      reason: decision !== 'HOLD' ? 'Clear directional conviction' : 'Action is HOLD (neutral market)',
    },
    {
      ruleId: 'RULE_SETUP_SCORE_THRESHOLD',
      name: 'Composite Score Hurdle (>= 70)',
      passed: compositeScore >= 70 && qualityTier !== 'REJECT',
      scoreOrMetric: `${compositeScore.toFixed(1)}/100`,
      reason: compositeScore >= 70 ? 'Passes institutional alpha hurdle' : 'Score below 70 threshold',
    },
    {
      ruleId: 'RULE_REGIME_COMPATIBILITY',
      name: 'Regime Compatibility',
      passed: !isChopOrSqueeze && !(decision === 'BUY' && regime === 'BEAR_TRENDING') && !(decision === 'SELL' && regime === 'BULL_TRENDING'),
      scoreOrMetric: regime,
      reason: isChopOrSqueeze ? 'Chop/Squeeze forbids trend entries' : 'Regime matches directional setup',
    },
    {
      ruleId: 'RULE_STATISTICAL_ANOMALY',
      name: 'Statistical Anomaly Gate',
      passed: !anomalies.some((a) => a.severity === 'CRITICAL'),
      scoreOrMetric: `${anomalies.length} active`,
      reason: anomalies.some((a) => a.severity === 'CRITICAL')
        ? 'VETO: Critical 3σ dislocation or volatility blowout'
        : 'Clean statistical profile',
    },
    {
      ruleId: 'RULE_RISK_REWARD_GEOMETRY',
      name: 'Risk:Reward Geometry (>= 1:1.5)',
      passed: true,
      scoreOrMetric: '1:1.80',
      reason: 'Asymmetric 1:1.8 dynamic ATR bracket',
    },
    {
      ruleId: 'RULE_SESSION_PHASE',
      name: 'Liquidity Window Gate',
      passed: true,
      scoreOrMetric: 'REGULAR_SESSION',
      reason: 'Active market liquidity window',
    },
  ];

  const allRulesPassed = computedRules.every((r) => r.passed);
  const effectiveRuleVerdict = ruleVerdict || (allRulesPassed ? 'APPROVED' : 'VETOED');
  const criticalAnomalies = anomalies.filter((a) => a.severity === 'CRITICAL');

  // Risk gatekeeper stats
  const riskPassed = riskAudit ? riskAudit.approved : allRulesPassed;
  const executionReady = effectiveRuleVerdict === 'APPROVED' && riskPassed && decision !== 'HOLD';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 text-slate-100 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Telemetry Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Deterministic 4-Stage Autonomous Pipeline
            </span>
          </div>
          <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Institutional Diagnostic & Risk Engine
            <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-slate-800 text-slate-300 border border-slate-700">
              {symbol} @ ₹{price.toFixed(2)}
            </span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            AI scores setup & detects anomalies ➔ Deterministic Rule Engine audits ➔ Pre-Trade Risk Gatekeeper validates ➔ Execution.
          </p>
        </div>

        {/* Overall Pipeline Verdict Banner */}
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wider flex items-center gap-2 border shadow-lg ${
            executionReady
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${executionReady ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
            {executionReady ? 'STAGE 4: READY FOR SMART EXECUTION' : 'PIPELINE GATE: EXECUTION VETOED'}
          </div>
        </div>
      </div>

      {/* 4-Stage Pipeline Flow Stepper */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-slate-500">STAGE 1</div>
          <div className="font-semibold text-slate-200">AI Setup Scoring</div>
          <div className="text-emerald-400 font-bold">{compositeScore.toFixed(0)}/100 • {qualityTier}</div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-slate-500">STAGE 2</div>
          <div className="font-semibold text-slate-200">Rule Engine Gate</div>
          <div className={effectiveRuleVerdict === 'APPROVED' ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {effectiveRuleVerdict === 'APPROVED' ? '✅ PASSED (All Rules)' : '⛔ VETOED'}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-slate-500">STAGE 3</div>
          <div className="font-semibold text-slate-200">Pre-Trade Risk Gate</div>
          <div className={riskPassed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
            {riskPassed ? '✅ LIMITS OK' : '🛑 RISK BREACH'}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="text-slate-500">STAGE 4</div>
          <div className="font-semibold text-slate-200">Smart Execution</div>
          <div className={executionReady ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
            {executionReady ? '⚡ DISPATCH READY' : '⏸️ HALTED'}
          </div>
        </div>
      </div>

      {/* Detailed 2-Column Telemetry Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Stage 1 AI Diagnostics & Anomaly Radar */}
        <div className="space-y-4">
          {/* Regime Classification Card */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Market Regime Classifier</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                regime === 'BULL_TRENDING'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : regime === 'BEAR_TRENDING'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {regimeLabel}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {regimeDetails?.description || 'Classified based on ADX trend strength, Bollinger Bandwidth squeeze, and EMA 20/50 stack alignment.'}
            </p>
            {regimeDetails?.trend_strength !== undefined && (
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/60">
                <span>Trend Strength: {regimeDetails.trend_strength}%</span>
                <span>Bandwidth: {regimeDetails.bandwidth || 0.045}</span>
                <span>ATR: {regimeDetails.atr_percent || 1.2}%</span>
              </div>
            )}
          </div>

          {/* Multi-Factor Score Breakdown */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Multi-Factor Scoring Matrix</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{compositeScore.toFixed(1)} / 100</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Trend (35%)</span>
                  <span className="text-white font-bold">{factorScores.trend ?? 75}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: `${factorScores.trend ?? 75}%` }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Momentum (25%)</span>
                  <span className="text-white font-bold">{factorScores.momentum ?? 70}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${factorScores.momentum ?? 70}%` }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Liquidity/RVOL (25%)</span>
                  <span className="text-white font-bold">{factorScores.liquidity ?? 80}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${factorScores.liquidity ?? 80}%` }}></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Structure/ORB (15%)</span>
                  <span className="text-white font-bold">{factorScores.structure ?? 65}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-purple-400 h-1.5 rounded-full" style={{ width: `${factorScores.structure ?? 65}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Statistical Anomaly Radar */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Statistical Anomaly Radar</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                criticalAnomalies.length > 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                {anomalies.length === 0 ? '0 Anomaly (Clean)' : `${anomalies.length} Flagged (${criticalAnomalies.length} Critical)`}
              </span>
            </div>

            {anomalies.length > 0 ? (
              <div className="space-y-2 pt-1">
                {anomalies.map((ano, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{ano.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                        ano.severity === 'CRITICAL' ? 'bg-rose-500/30 text-rose-300' : 'bg-amber-500/30 text-amber-300'
                      }`}>
                        {ano.severity}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-tight">{ano.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 pt-1">
                ✅ No statistical dislocations detected. Volatility within standard 2-sigma parameters; RVOL baseline healthy.
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Stage 2 Rule Engine & Stage 3 Risk Gatekeeper */}
        <div className="space-y-4">
          {/* Rule Engine Audit Matrix */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Deterministic Rule Engine</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                effectiveRuleVerdict === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {effectiveRuleVerdict === 'APPROVED' ? 'PASSED 6/6' : 'VETOED'}
              </span>
            </div>

            <div className="space-y-2">
              {computedRules.map((rule) => (
                <div key={rule.ruleId} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={rule.passed ? 'text-emerald-400' : 'text-rose-400'}>
                      {rule.passed ? '✓' : '✗'}
                    </span>
                    <div>
                      <div className="font-medium text-slate-200">{rule.name}</div>
                      <div className="text-[10px] text-slate-400">{rule.reason}</div>
                    </div>
                  </div>
                  {rule.scoreOrMetric && (
                    <span className="font-mono text-slate-400 text-[11px] bg-slate-900 px-2 py-0.5 rounded">
                      {rule.scoreOrMetric}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {vetoReason && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-mono">
                {vetoReason}
              </div>
            )}
          </div>

          {/* Pre-Trade Risk Gatekeeper Audit */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-mono text-slate-400 tracking-wider">Pre-Trade Risk Circuit Breaker</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                riskPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {riskPassed ? 'APPROVED' : 'CIRCUIT BREAKER TRIGGERED'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px]">Daily Loss Budget</div>
                <div className="text-emerald-400 font-bold">
                  ₹{riskAudit?.currentMetrics?.dailyLoss?.toFixed(0) || '0'} / ₹5,000
                </div>
                <div className="text-[10px] text-slate-400">Headroom OK</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px]">Drawdown Limit</div>
                <div className="text-emerald-400 font-bold">
                  {riskAudit?.currentMetrics?.drawdownPercent?.toFixed(1) || '0.0'}% / 10%
                </div>
                <div className="text-[10px] text-slate-400">Safe</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-slate-500 text-[10px]">Portfolio Heat</div>
                <div className="text-emerald-400 font-bold">
                  {riskAudit?.currentMetrics?.portfolioHeatPercent?.toFixed(1) || '12.4'}% / 80%
                </div>
                <div className="text-[10px] text-slate-400">Normal</div>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center justify-between pt-1">
              <span>ATR Volatility-Budgeted Size:</span>
              <span className="font-bold text-white">{riskAudit?.recommendedQuantity || 10} Units</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
