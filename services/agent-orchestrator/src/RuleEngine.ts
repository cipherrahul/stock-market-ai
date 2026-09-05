/**
 * Institutional Deterministic Rule Engine
 * Stage 2 of the 4-Stage Autonomous Pipeline:
 * Market In -> AI Diagnostics -> Rule Engine -> Risk Gatekeeper -> Smart Execution
 *
 * Enforces quantitative rules that NO AI hallucination or raw score can bypass.
 */

export interface RuleResult {
  ruleId: string;
  name: string;
  passed: boolean;
  scoreOrMetric?: string;
  reason?: string;
}

export interface SetupEvaluationPayload {
  symbol: string;
  price: number;
  directional_bias: 'LONG' | 'SHORT' | 'BUY' | 'SELL' | 'NEUTRAL' | 'HOLD';
  composite_score: number;
  quality_tier: string;
  factor_scores?: {
    trend?: number;
    momentum?: number;
    liquidity?: number;
    structure?: number;
  };
  regime: string;
  regime_details?: {
    id: string;
    label: string;
    trend_strength?: number;
    bandwidth?: number;
    atr_percent?: number;
  };
  anomalies?: Array<{
    code: string;
    name: string;
    severity: 'WARNING' | 'CRITICAL';
    description: string;
    metrics?: Record<string, any>;
  }>;
  proposed_trade?: {
    action: string;
    quantity: number;
    price: number;
    stop_loss: number;
    take_profit: number;
    risk_reward_ratio: number;
    atr?: number;
    orderVariant?: string;
  };
  session_phase?: string;
  trade_allowed_session?: boolean;
}

export interface RuleEngineVerdict {
  approved: boolean;
  verdict: 'APPROVED' | 'VETOED';
  totalRules: number;
  passedRules: number;
  vetoReason?: string;
  ruleResults: RuleResult[];
  timestamp: string;
}

export class DeterministicRuleEngine {
  private static readonly MIN_COMPOSITE_SCORE = 70.0;
  private static readonly MIN_RISK_REWARD = 1.45; // allows 1:1.5 with minor float tolerance

  /**
   * Evaluates AI setup diagnostics against deterministic institutional rules.
   */
  public static evaluate(setup: SetupEvaluationPayload): RuleEngineVerdict {
    const results: RuleResult[] = [];
    const normalizedAction = (setup.proposed_trade?.action || setup.directional_bias || '').toUpperCase();

    // -------------------------------------------------------------
    // RULE 1: Directional Conviction Gate
    // -------------------------------------------------------------
    const isDirectional = normalizedAction === 'BUY' || normalizedAction === 'LONG' ||
                          normalizedAction === 'SELL' || normalizedAction === 'SHORT';
    results.push({
      ruleId: 'RULE_DIRECTIONAL_VALIDITY',
      name: 'Directional Bias Check',
      passed: isDirectional,
      scoreOrMetric: normalizedAction,
      reason: isDirectional ? 'Clear directional bias present' : `Action is ${normalizedAction} (non-directional)`,
    });

    // -------------------------------------------------------------
    // RULE 2: Multi-Factor Composite Score Hurdle
    // -------------------------------------------------------------
    const score = setup.composite_score ?? 0;
    const scorePassed = score >= this.MIN_COMPOSITE_SCORE && setup.quality_tier !== 'REJECT';
    results.push({
      ruleId: 'RULE_SETUP_SCORE_THRESHOLD',
      name: 'AI Composite Score Hurdle',
      passed: scorePassed,
      scoreOrMetric: `${score.toFixed(1)}/100 (${setup.quality_tier || 'UNKNOWN'})`,
      reason: scorePassed
        ? `Score ${score.toFixed(1)} exceeds hurdle (${this.MIN_COMPOSITE_SCORE})`
        : `Score ${score.toFixed(1)} below required threshold (${this.MIN_COMPOSITE_SCORE}) or tier REJECT`,
    });

    // -------------------------------------------------------------
    // RULE 3: Market Regime Compatibility Gate
    // -------------------------------------------------------------
    const regime = (setup.regime || setup.regime_details?.id || 'MEAN_REVERTING_RANGE').toUpperCase();
    let regimeCompatible = true;
    let regimeReason = `Regime ${regime} is tradeable`;

    if (regime === 'VOLATILITY_EXPANSION_CHOP') {
      regimeCompatible = false;
      regimeReason = 'Market is in high-volatility chop; trend continuation strategies strictly forbidden';
    } else if (regime === 'LIQUIDITY_COMPRESSION') {
      regimeCompatible = false;
      regimeReason = 'Market is in low-volatility squeeze; awaiting breakout expansion confirmation';
    } else if ((normalizedAction === 'BUY' || normalizedAction === 'LONG') && regime === 'BEAR_TRENDING') {
      regimeCompatible = false;
      regimeReason = 'Long trade forbidden in Bearish Momentum Trend regime';
    } else if ((normalizedAction === 'SELL' || normalizedAction === 'SHORT') && regime === 'BULL_TRENDING') {
      regimeCompatible = false;
      regimeReason = 'Short trade forbidden in Bullish Momentum Trend regime';
    }

    results.push({
      ruleId: 'RULE_REGIME_COMPATIBILITY',
      name: 'Market Regime Compatibility',
      passed: regimeCompatible,
      scoreOrMetric: regime,
      reason: regimeReason,
    });

    // -------------------------------------------------------------
    // RULE 4: Statistical Anomaly Interceptor
    // -------------------------------------------------------------
    const anomalies = setup.anomalies || [];
    const criticalAnomalies = anomalies.filter((a) => a.severity === 'CRITICAL');
    const anomalyPassed = criticalAnomalies.length === 0;
    const criticalCodes = criticalAnomalies.map((a) => a.code).join(', ');

    results.push({
      ruleId: 'RULE_STATISTICAL_ANOMALY',
      name: 'Statistical Anomaly Gate',
      passed: anomalyPassed,
      scoreOrMetric: `${anomalies.length} active (${criticalAnomalies.length} critical)`,
      reason: anomalyPassed
        ? 'No critical statistical anomalies detected'
        : `CRITICAL anomaly active: ${criticalCodes} (mean-reversion or volatility blow-out risk)`,
    });

    // -------------------------------------------------------------
    // RULE 5: Risk-Reward Geometry & Bracket Gate
    // -------------------------------------------------------------
    const rrRatio = setup.proposed_trade?.risk_reward_ratio || 0;
    const rrPassed = rrRatio >= this.MIN_RISK_REWARD;
    results.push({
      ruleId: 'RULE_RISK_REWARD_GEOMETRY',
      name: 'Risk-to-Reward Geometry',
      passed: rrPassed,
      scoreOrMetric: `1:${rrRatio.toFixed(2)}`,
      reason: rrPassed
        ? `R:R of 1:${rrRatio.toFixed(2)} satisfies min 1:1.5 hurdle`
        : `R:R of 1:${rrRatio.toFixed(2)} fails institutional hurdle (min 1:1.5 required)`,
    });

    // -------------------------------------------------------------
    // RULE 6: Session Window & Liquidity Phase Gate
    // -------------------------------------------------------------
    const sessionAllowed = setup.trade_allowed_session !== false;
    const phase = setup.session_phase || 'REGULAR_SESSION';
    const isSquareOff = phase === 'SQUARE_OFF_ONLY' || phase === 'MARKET_CLOSING';
    const sessionPassed = sessionAllowed && !isSquareOff;

    results.push({
      ruleId: 'RULE_SESSION_PHASE',
      name: 'Session Liquidity Window Gate',
      passed: sessionPassed,
      scoreOrMetric: phase,
      reason: sessionPassed
        ? `Active liquidity window (${phase})`
        : `Trading halted during session phase: ${phase}`,
    });

    // -------------------------------------------------------------
    // Verdict Synthesis
    // -------------------------------------------------------------
    const failedRules = results.filter((r) => !r.passed);
    const approved = failedRules.length === 0;
    const vetoReason = failedRules.length > 0
      ? `Rule Engine Veto [${failedRules[0].name}]: ${failedRules[0].reason}`
      : undefined;

    return {
      approved,
      verdict: approved ? 'APPROVED' : 'VETOED',
      totalRules: results.length,
      passedRules: results.length - failedRules.length,
      vetoReason,
      ruleResults: results,
      timestamp: new Date().toISOString(),
    };
  }
}
