"""
Verification Test for Intraday Alpha Engine & Indicators.
"""
import sys
import os
import pandas as pd
import numpy as np

# Add ai-engine-service path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-engine-service")))

from tools.indicators import (
    calculate_vwap,
    calculate_orb,
    calculate_rvol,
    calculate_supertrend,
    get_market_session_phase,
    analyze_all_indicators
)

def test_intraday_indicators():
    print("[TEST] Running Intraday Alpha & Indicator Verification...")

    # Create synthetic 5m OHLCV DataFrame (30 candles)
    np.random.seed(42)
    periods = 30
    dates = pd.date_range(end=pd.Timestamp.now(), periods=periods, freq='5min')
    base_price = 2500.0 # e.g. RELIANCE
    close_prices = [base_price]
    for _ in range(periods - 1):
        close_prices.append(close_prices[-1] * (1.0 + np.random.normal(0, 0.003)))
    
    close = pd.Series(close_prices)
    high = [c * (1.0 + u) for c, u in zip(close_prices, np.random.uniform(0.001, 0.005, periods).tolist())]
    low = [c * (1.0 - u) for c, u in zip(close_prices, np.random.uniform(0.001, 0.005, periods).tolist())]
    open_prices = close.shift(1).fillna(base_price)
    volume = np.random.randint(10000, 50000, periods)
    # Simulate high volume spike on last bar
    volume[-1] = 95000

    df = pd.DataFrame({
        'Date': dates,
        'Open': open_prices,
        'High': high,
        'Low': low,
        'Close': close,
        'Volume': volume
    })

    # 1. Test VWAP
    vwap_res = calculate_vwap(df)
    assert vwap_res['vwap'] > 0, "VWAP must be positive"
    assert vwap_res['upper_1'] > vwap_res['vwap'], "Upper band must exceed VWAP"
    assert vwap_res['lower_1'] < vwap_res['vwap'], "Lower band must be below VWAP"
    print(f"[OK] VWAP: Rs.{vwap_res['vwap']} (Bands: Rs.{vwap_res['lower_1']} - Rs.{vwap_res['upper_1']})")

    # 2. Test ORB (Opening Range Breakout)
    orb_res = calculate_orb(df, opening_bars=3)
    assert orb_res['orb_high'] >= orb_res['orb_low'], "ORB High >= ORB Low"
    assert orb_res['breakout'] in ('BULLISH_BREAKOUT', 'BEARISH_BREAKDOWN', 'INSIDE_RANGE')
    print(f"[OK] ORB: High=Rs.{orb_res['orb_high']} | Low=Rs.{orb_res['orb_low']} | Status={orb_res['breakout']}")

    # 3. Test RVOL (Relative Volume)
    rvol_res = calculate_rvol(df, period=20)
    assert rvol_res['rvol'] > 1.5, f"RVOL expected >= 1.5 with spike, got {rvol_res['rvol']}"
    assert rvol_res['status'] in ('HIGH_VOLUME', 'EXTREME_VOLUME')
    print(f"[OK] RVOL: {rvol_res['rvol']}x ({rvol_res['status']})")

    # 4. Test Supertrend
    st_res = calculate_supertrend(df, period=10, multiplier=3.0)
    assert st_res['trend'] in ('BULLISH', 'BEARISH')
    assert st_res['stop_line'] > 0
    print(f"[OK] Supertrend: {st_res['trend']} (Stop: Rs.{st_res['stop_line']})")

    # 5. Test Market Session Phase
    session_res = get_market_session_phase()
    assert 'phase' in session_res
    assert 'trade_allowed' in session_res
    print(f"[OK] Session Phase: {session_res['phase']} (Trade Allowed: {session_res['trade_allowed']})")

    # 6. Test Full Indicator Package
    all_res = analyze_all_indicators(df)
    assert 'intraday' in all_res
    assert all_res['intraday']['vwap']['vwap'] > 0
    assert 'regime' in all_res
    print(f"[OK] Full Intraday Analysis Payload: Regime={all_res['regime']}")

    print("\nALL INTRADAY ALPHA INDICATOR TESTS PASSED!")

if __name__ == '__main__':
    test_intraday_indicators()
