/**
 * Unit Tests for Deterministic Rule Engine
 */

import { DeterministicRuleEngine, SetupEvaluationPayload } from './src/RuleEngine';

function runTests() {
  console.log('Testing Deterministic Rule Engine...');

  // Test Case 1: Prime Bullish Setup (Should PASS 6/6)
  const primeSetup: SetupEvaluationPayload = {
    symbol: 'RELIANCE',
    price: 2850.0,
    directional_bias: 'BUY',
    composite_score: 82.5,
    quality_tier: 'TIER_1_PRIME',
    regime: 'BULL_TRENDING',
    anomalies: [],
    proposed_trade: {
      action: 'BUY',
      quantity: 25,
      price: 2850.0,
      stop_loss: 2820.0,
      take_profit: 2910.0,
      risk_reward_ratio: 2.0,
    },
    trade_allowed_session: true,
  };

  const verdict1 = DeterministicRuleEngine.evaluate(primeSetup);
  console.log(`[Test 1 Prime Setup]: Approved=${verdict1.approved}, Passed=${verdict1.passedRules}/${verdict1.totalRules}`);
  if (!verdict1.approved) {
    throw new Error(`Expected prime setup to pass, but vetoed: ${verdict1.vetoReason}`);
  }

  // Test Case 2: Vetoed by High-Volatility Chop Regime
  const chopSetup: SetupEvaluationPayload = {
    ...primeSetup,
    regime: 'VOLATILITY_EXPANSION_CHOP',
  };
  const verdict2 = DeterministicRuleEngine.evaluate(chopSetup);
  console.log(`[Test 2 Chop Veto]: Approved=${verdict2.approved}, VetoReason=${verdict2.vetoReason}`);
  if (verdict2.approved) {
    throw new Error('Expected chop setup to be vetoed by Rule Engine!');
  }

  // Test Case 3: Vetoed by Critical Statistical Anomaly (3-Sigma VWAP dislocation)
  const anomalySetup: SetupEvaluationPayload = {
    ...primeSetup,
    anomalies: [
      {
        code: 'VWAP_DISLOCATION_3SIGMA',
        name: 'Upper VWAP Statistical Dislocation',
        severity: 'CRITICAL',
        description: 'Price extended > 2.5 sigma above VWAP',
      }
    ]
  };
  const verdict3 = DeterministicRuleEngine.evaluate(anomalySetup);
  console.log(`[Test 3 Anomaly Veto]: Approved=${verdict3.approved}, VetoReason=${verdict3.vetoReason}`);
  if (verdict3.approved) {
    throw new Error('Expected critical anomaly to be vetoed by Rule Engine!');
  }

  // Test Case 4: Vetoed by Score Below Hurdle
  const lowScoreSetup: SetupEvaluationPayload = {
    ...primeSetup,
    composite_score: 64.0,
  };
  const verdict4 = DeterministicRuleEngine.evaluate(lowScoreSetup);
  console.log(`[Test 4 Low Score Veto]: Approved=${verdict4.approved}, VetoReason=${verdict4.vetoReason}`);
  if (verdict4.approved) {
    throw new Error('Expected low score setup to be vetoed by Rule Engine!');
  }

  // Test Case 5: Vetoed by Poor Risk-Reward Geometry (< 1:1.5)
  const poorRRSetup: SetupEvaluationPayload = {
    ...primeSetup,
    proposed_trade: {
      ...primeSetup.proposed_trade!,
      risk_reward_ratio: 1.1, // Less than 1.45
    }
  };
  const verdict5 = DeterministicRuleEngine.evaluate(poorRRSetup);
  console.log(`[Test 5 Poor R:R Veto]: Approved=${verdict5.approved}, VetoReason=${verdict5.vetoReason}`);
  if (verdict5.approved) {
    throw new Error('Expected poor R:R setup to be vetoed by Rule Engine!');
  }

  console.log('SUCCESS: ALL RULE ENGINE TESTS PASSED PERFECTLY!');
}

runTests();
