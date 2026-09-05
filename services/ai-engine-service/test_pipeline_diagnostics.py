"""
Verification Test for Institutional AI Diagnostics & Indicator Engine
Tests:
1. 5-State Market Regime Classifier
2. Statistical Anomaly Detection (Volume Climax, 3-Sigma VWAP, Volatility Spikes)
3. Multi-Factor Setup Scorer (Trend, Momentum, Liquidity, Structure)
"""

import sys
import numpy as np
import pandas as pd
from tools.indicators import analyze_all_indicators

def test_bullish_trending_regime():
    # Construct a realistic 60-bar upward trending wave (up 3, pullback 1)
    bars = 60
    base_price = 100.0
    prices = []
    p = base_price
    for i in range(bars):
        if i % 3 == 0 and i > 0:
            p -= 0.65 # pullback to keep RSI in optimal 55-65 trend band
        else:
            p += 0.55 # upward impulse
        prices.append(p)
    highs = [pr + 0.5 for pr in prices]
    lows = [pr - 0.5 for pr in prices]
    # High RVOL institutional flow
    volumes = [10_000 for _ in range(bars - 5)] + [18_000 for _ in range(5)]

    df = pd.DataFrame({
        'Open': prices,
        'High': highs,
        'Low': lows,
        'Close': prices,
        'Volume': volumes
    })

    result = analyze_all_indicators(df)
    regime = result['regime']
    setup = result['setup_evaluation']

    print(f"[PASS] Bull Trend Test: Regime={regime}, Score={setup['composite_score']}, Bias={setup['directional_bias']}, Tier={setup['quality_tier']}")
    print(f"       Factor scores: {setup['factor_scores']}")
    print(f"       Anomalies: {[a['code'] for a in result['anomalies']]}")
    assert regime == 'BULL_TRENDING', f"Expected BULL_TRENDING, got {regime}"
    assert setup['directional_bias'] == 'LONG', f"Expected LONG, got {setup['directional_bias']}"
    assert setup['composite_score'] >= 70.0, f"Expected score >= 70, got {setup['composite_score']}"

def test_volatility_chop_and_anomaly_detection():
    # Construct an oscillating choppy dataset with a massive volume climax and huge range bar
    bars = 60
    prices = [100.0 + (5.0 if i % 2 == 0 else -5.0) for i in range(bars)]
    highs = [p + 2.0 for p in prices]
    lows = [p - 2.0 for p in prices]
    volumes = [1000 for _ in range(bars - 1)] + [50_000] # 50x volume spike

    # Blow out the last bar
    highs[-1] = prices[-1] + 25.0
    lows[-1] = prices[-1] - 25.0

    df = pd.DataFrame({
        'Open': prices,
        'High': highs,
        'Low': lows,
        'Close': prices,
        'Volume': volumes
    })

    result = analyze_all_indicators(df)
    anomalies = result['anomalies']
    anomaly_codes = [a['code'] for a in anomalies]

    print(f"[PASS] Anomaly Test: Detected {len(anomalies)} anomalies: {anomaly_codes}")
    assert 'VOLUME_BURST_ANOMALY' in anomaly_codes or 'VOLATILITY_SPIKE' in anomaly_codes, f"Anomaly not detected: {anomaly_codes}"
    print(f"   Setup Evaluation: {result['setup_evaluation']}")

if __name__ == '__main__':
    print("Testing Institutional AI Diagnostics Engine...")
    test_bullish_trending_regime()
    test_volatility_chop_and_anomaly_detection()
    print("SUCCESS: ALL AI DIAGNOSTICS TESTS PASSED!")
