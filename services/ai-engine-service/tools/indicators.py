"""
Deterministic Quantitative Technical Indicators
Clean, high-performance implementations using NumPy & Pandas.
"""

from typing import Dict, Any, List, Optional, Tuple
import numpy as np
import pandas as pd


def calculate_ema(series: pd.Series, span: int) -> pd.Series:
    """Calculate Exponential Moving Average."""
    return series.ewm(span=span, adjust=False).mean()


def calculate_rsi(prices: pd.Series, period: int = 14) -> float:
    """Calculate 14-period RSI."""
    if len(prices) < period + 1:
        return 50.0
    delta = prices.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()

    # Exponential smoothing
    for i in range(period, len(prices)):
        avg_gain.iloc[i] = (avg_gain.iloc[i - 1] * (period - 1) + gain.iloc[i]) / period
        avg_loss.iloc[i] = (avg_loss.iloc[i - 1] * (period - 1) + loss.iloc[i]) / period

    rs = avg_gain / avg_loss
    rsi_series = 100.0 - (100.0 / (1.0 + rs))
    latest_rsi = rsi_series.iloc[-1]
    if np.isnan(latest_rsi):
        return 50.0
    return float(np.clip(latest_rsi, 0.0, 100.0))


def calculate_macd(
    prices: pd.Series,
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> Tuple[float, float, float]:
    """
    Calculate MACD line, signal line, and histogram.
    Returns: (macd, signal, histogram)
    """
    if len(prices) < slow_period + signal_period:
        return 0.0, 0.0, 0.0

    fast_ema = calculate_ema(prices, fast_period)
    slow_ema = calculate_ema(prices, slow_period)
    macd_line = fast_ema - slow_ema
    signal_line = calculate_ema(macd_line, signal_period)
    histogram = macd_line - signal_line

    return (
        float(macd_line.iloc[-1]),
        float(signal_line.iloc[-1]),
        float(histogram.iloc[-1]),
    )


def calculate_bollinger_bands(
    prices: pd.Series, period: int = 20, num_std: float = 2.0
) -> Tuple[float, float, float]:
    """
    Calculate Bollinger Bands.
    Returns: (upper_band, middle_band, lower_band)
    """
    if len(prices) < period:
        latest = float(prices.iloc[-1]) if len(prices) > 0 else 0.0
        return latest * 1.05, latest, latest * 0.95

    sma = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std()
    upper = sma + (std * num_std)
    lower = sma - (std * num_std)

    return float(upper.iloc[-1]), float(sma.iloc[-1]), float(lower.iloc[-1])


def calculate_atr(df: pd.DataFrame, period: int = 14) -> float:
    """
    Calculate Average True Range (ATR) for volatility and stop-loss sizing.
    Expects df with columns ['High', 'Low', 'Close']
    """
    if len(df) < period + 1:
        return float(df['Close'].iloc[-1] * 0.02) if 'Close' in df and len(df) > 0 else 1.0

    high = df['High']
    low = df['Low']
    close = df['Close']
    prev_close = close.shift(1)

    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    atr = tr.rolling(window=period).mean()
    latest_atr = atr.iloc[-1]
    return float(latest_atr) if not np.isnan(latest_atr) else float(close.iloc[-1] * 0.02)


def calculate_support_resistance(prices: pd.Series, window: int = 20) -> Dict[str, float]:
    """Calculate key support and resistance levels from recent swing highs/lows."""
    if len(prices) < window:
        current = float(prices.iloc[-1])
        return {"support": current * 0.97, "resistance": current * 1.03}

    recent = prices.iloc[-window:]
    resistance = float(recent.max())
    support = float(recent.min())
    return {"support": round(support, 2), "resistance": round(resistance, 2)}


def calculate_vwap(df: pd.DataFrame) -> Dict[str, float]:
    """
    Calculate Volume-Weighted Average Price (VWAP) and Standard Deviation Bands.
    Essential institutional intraday benchmark.
    """
    if df.empty or 'Close' not in df or 'Volume' not in df:
        return {"vwap": 0.0, "upper_1": 0.0, "lower_1": 0.0, "upper_2": 0.0, "lower_2": 0.0}

    high = df['High'] if 'High' in df else df['Close']
    low = df['Low'] if 'Low' in df else df['Close']
    close = df['Close']
    volume = df['Volume'].replace(0, 1)

    typical_price = (high + low + close) / 3.0
    cum_vol = volume.cumsum()
    cum_tp_vol = (typical_price * volume).cumsum()

    vwap_series = cum_tp_vol / cum_vol
    current_vwap = float(vwap_series.iloc[-1])

    # Standard deviation bands
    variance = ((typical_price - vwap_series) ** 2 * volume).cumsum() / cum_vol
    std_dev = np.sqrt(np.maximum(variance, 0.0))
    current_std = float(std_dev.iloc[-1]) if len(std_dev) > 0 else (current_vwap * 0.005)

    return {
        "vwap": round(current_vwap, 2),
        "upper_1": round(current_vwap + current_std, 2),
        "lower_1": round(current_vwap - current_std, 2),
        "upper_2": round(current_vwap + 2 * current_std, 2),
        "lower_2": round(current_vwap - 2 * current_std, 2),
    }


def calculate_orb(df: pd.DataFrame, opening_bars: int = 3) -> Dict[str, Any]:
    """
    Calculate Opening Range Breakout (ORB) levels.
    Default: first 3 bars (e.g., 15 minutes on a 5m timeframe).
    """
    if df.empty or 'Close' not in df:
        return {"orb_high": 0.0, "orb_low": 0.0, "breakout": "INSIDE_RANGE", "range_pct": 0.0}

    bars = min(len(df), max(1, opening_bars))
    opening_slice = df.iloc[:bars]

    orb_high = float(opening_slice['High'].max()) if 'High' in opening_slice else float(opening_slice['Close'].max())
    orb_low = float(opening_slice['Low'].min()) if 'Low' in opening_slice else float(opening_slice['Close'].min())
    current_close = float(df['Close'].iloc[-1])

    range_size = orb_high - orb_low
    range_pct = (range_size / orb_low * 100) if orb_low > 0 else 0.0

    if current_close > orb_high:
        breakout = "BULLISH_BREAKOUT"
    elif current_close < orb_low:
        breakout = "BEARISH_BREAKDOWN"
    else:
        breakout = "INSIDE_RANGE"

    return {
        "orb_high": round(orb_high, 2),
        "orb_low": round(orb_low, 2),
        "breakout": breakout,
        "range_pct": round(range_pct, 2),
    }


def calculate_rvol(df: pd.DataFrame, period: int = 20) -> Dict[str, Any]:
    """
    Calculate Relative Volume (RVOL).
    Breakouts without RVOL >= 1.5 are high-probability fakeouts.
    """
    if df.empty or 'Volume' not in df or len(df) < 2:
        return {"rvol": 1.0, "status": "NORMAL_VOLUME", "current_vol": 0, "avg_vol": 0}

    current_vol = float(df['Volume'].iloc[-1])
    # Exclude current bar from average
    history_vol = df['Volume'].iloc[:-1]
    lookback = min(len(history_vol), period)
    avg_vol = float(history_vol.iloc[-lookback:].mean()) if lookback > 0 else current_vol

    rvol = round(current_vol / max(avg_vol, 1.0), 2)
    if rvol >= 2.0:
        status = "EXTREME_VOLUME"
    elif rvol >= 1.5:
        status = "HIGH_VOLUME"
    elif rvol <= 0.6:
        status = "LOW_VOLUME"
    else:
        status = "NORMAL_VOLUME"

    return {
        "rvol": rvol,
        "status": status,
        "current_vol": int(current_vol),
        "avg_vol": int(avg_vol),
    }


def calculate_supertrend(df: pd.DataFrame, period: int = 10, multiplier: float = 3.0) -> Dict[str, Any]:
    """
    Calculate ATR-based Supertrend.
    Returns: trend direction ('BULLISH' / 'BEARISH') and dynamic stop line.
    """
    if df.empty or 'Close' not in df or len(df) < period:
        latest = float(df['Close'].iloc[-1]) if len(df) > 0 else 100.0
        return {"trend": "NEUTRAL", "stop_line": round(latest * 0.98, 2)}

    high = df['High'] if 'High' in df else df['Close']
    low = df['Low'] if 'Low' in df else df['Close']
    close = df['Close']

    atr = calculate_atr(df, period)
    hl2 = (high + low) / 2.0
    basic_upper = hl2 + (multiplier * atr)
    basic_lower = hl2 - (multiplier * atr)

    current_close = float(close.iloc[-1])
    current_upper = float(basic_upper.iloc[-1])
    current_lower = float(basic_lower.iloc[-1])

    if current_close > current_lower:
        trend = "BULLISH"
        stop_line = current_lower
    else:
        trend = "BEARISH"
        stop_line = current_upper

    return {
        "trend": trend,
        "stop_line": round(stop_line, 2),
    }


def get_market_session_phase() -> Dict[str, Any]:
    """
    Classifies the current Indian Market (IST: UTC+5:30) trading phase.
    Protects intraday traders from false breakouts during midday chop and enforces square-off.
    """
    import datetime
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    ist = now_utc + datetime.timedelta(hours=5, minutes=30)
    minutes = ist.hour * 60 + ist.minute
    day_of_week = ist.weekday() # 0 = Monday, 6 = Sunday

    is_weekend = day_of_week >= 5

    # NSE/BSE Trading Timings
    OPEN_MIN = 9 * 60 + 15      # 09:15 IST
    ORB_END_MIN = 9 * 60 + 45   # 09:45 IST
    PRIME_END_MIN = 11 * 60 + 30 # 11:30 IST
    CHOP_END_MIN = 13 * 60 + 0   # 13:00 IST
    POWER_END_MIN = 15 * 60 + 0  # 15:00 IST
    SQUAREOFF_MIN = 15 * 60 + 15 # 15:15 IST
    CLOSE_MIN = 15 * 60 + 30     # 15:30 IST

    if is_weekend or minutes < OPEN_MIN or minutes >= CLOSE_MIN:
        phase = "MARKET_CLOSED"
        trade_allowed = False
        guidance = "Market is closed. Analysis active in simulation/paper mode."
    elif minutes < ORB_END_MIN:
        phase = "ORB_SETUP"
        trade_allowed = True
        guidance = "Price discovery phase. Establishing initial 15-30m range. Avoid premature breakout chasing."
    elif minutes < PRIME_END_MIN:
        phase = "PRIME_TREND"
        trade_allowed = True
        guidance = "Highest alpha window. Trend continuation with VWAP & RVOL confirmation."
    elif minutes < CHOP_END_MIN:
        phase = "MIDDAY_CHOP"
        trade_allowed = False  # Suppress aggressive breakout trades
        guidance = "Low-volume lunch period. High fakeout risk. Mean-reversion or hold only."
    elif minutes < POWER_END_MIN:
        phase = "POWER_HOUR"
        trade_allowed = True
        guidance = "Afternoon trend expansion. FII/DII volume repositioning."
    elif minutes < SQUAREOFF_MIN:
        phase = "SQUARE_OFF_ONLY"
        trade_allowed = False
        guidance = "Exit window. No new intraday entries allowed. Square off open MIS positions."
    else:
        phase = "MARKET_CLOSING"
        trade_allowed = False
        guidance = "Terminal square-off and settlement zone."

    return {
        "phase": phase,
        "trade_allowed": trade_allowed,
        "ist_time": ist.strftime("%H:%M:%S IST"),
        "guidance": guidance,
    }


def analyze_all_indicators(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Takes an OHLCV DataFrame and computes all quantitative indicators,
    including institutional intraday benchmarks (VWAP, ORB, RVOL, Supertrend, Session Phase).
    """
    if df.empty or 'Close' not in df:
        raise ValueError("DataFrame must contain 'Close' price series.")

    close = df['Close'].astype(float)
    current_price = float(close.iloc[-1])

    rsi = calculate_rsi(close)
    macd, macd_signal, macd_hist = calculate_macd(close)
    bb_upper, bb_mid, bb_lower = calculate_bollinger_bands(close)
    
    # EMAs
    ema_20 = float(calculate_ema(close, 20).iloc[-1]) if len(close) >= 20 else current_price
    ema_50 = float(calculate_ema(close, 50).iloc[-1]) if len(close) >= 50 else current_price
    ema_200 = float(calculate_ema(close, 200).iloc[-1]) if len(close) >= 200 else ema_50

    # ATR
    atr = calculate_atr(df)
    sr = calculate_support_resistance(close)

    # Intraday specific indicators
    vwap_data = calculate_vwap(df)
    orb_data = calculate_orb(df, opening_bars=3)
    rvol_data = calculate_rvol(df, period=20)
    supertrend_data = calculate_supertrend(df, period=10, multiplier=3.0)
    session_data = get_market_session_phase()

    # Institutional Market Regime Classifier (5-State Machine)
    bb_bandwidth = (bb_upper - bb_lower) / max(bb_mid, 0.001)
    atr_pct = (atr / current_price) * 100
    vwap_val = vwap_data["vwap"]

    if bb_bandwidth < 0.030:
        regime_id = "LIQUIDITY_COMPRESSION"
        regime_label = "Liquidity Compression (Coiling Range)"
        regime_desc = "Low volatility volatility squeeze; market coiling for breakout expansion."
        trend_strength = 20.0
    elif bb_bandwidth > 0.090 and ((current_price > ema_20) != (current_price > vwap_val)):
        regime_id = "VOLATILITY_EXPANSION_CHOP"
        regime_label = "High Volatility Chop"
        regime_desc = "Expanded volatility with conflicting moving average and VWAP signals. High whipsaw risk."
        trend_strength = 35.0
    elif current_price > ema_50 and ema_20 > ema_50 and current_price >= vwap_val:
        regime_id = "BULL_TRENDING"
        regime_label = "Bullish Momentum Trend"
        regime_desc = "Institutional accumulation above VWAP with clean moving average stack."
        trend_strength = min(100.0, 50.0 + (rsi - 50.0) * 1.5)
    elif current_price < ema_50 and ema_20 < ema_50 and current_price <= vwap_val:
        regime_id = "BEAR_TRENDING"
        regime_label = "Bearish Momentum Trend"
        regime_desc = "Institutional liquidation below VWAP with downward moving average stack."
        trend_strength = min(100.0, 50.0 + (50.0 - rsi) * 1.5)
    else:
        regime_id = "MEAN_REVERTING_RANGE"
        regime_label = "Mean-Reverting Range"
        regime_desc = "Sideways oscillation bounded by Bollinger Bands and VWAP bands."
        trend_strength = 30.0

    regime_info = {
        "id": regime_id,
        "label": regime_label,
        "description": regime_desc,
        "trend_strength": round(trend_strength, 1),
        "bandwidth": round(bb_bandwidth, 4),
        "atr_percent": round(atr_pct, 2),
    }

    # Statistical Anomaly Detection
    anomalies: List[Dict[str, Any]] = []

    # 1. Volume Burst Anomaly
    rvol_current = rvol_data.get("rvol", 1.0)
    if rvol_current >= 2.5:
        anomalies.append({
            "code": "VOLUME_BURST_ANOMALY",
            "name": "Institutional Volume Climax",
            "severity": "WARNING",
            "description": f"RVOL at {rvol_current:.1f}x baseline — high probability of institutional block orders.",
            "metrics": {"rvol": rvol_current}
        })

    # 2. VWAP 3-Sigma Dislocation Anomaly
    upper_2 = vwap_data.get("upper_2", current_price * 1.02)
    lower_2 = vwap_data.get("lower_2", current_price * 0.98)
    if current_price >= upper_2:
        anomalies.append({
            "code": "VWAP_DISLOCATION_3SIGMA",
            "name": "Upper VWAP Statistical Dislocation",
            "severity": "CRITICAL",
            "description": f"Price stretched >2.5σ above VWAP (₹{vwap_val:.2f}) — severe mean-reversion snapback risk.",
            "metrics": {"vwap": vwap_val, "upper_2": upper_2}
        })
    elif current_price <= lower_2:
        anomalies.append({
            "code": "VWAP_DISLOCATION_3SIGMA",
            "name": "Lower VWAP Statistical Dislocation",
            "severity": "CRITICAL",
            "description": f"Price stretched >2.5σ below VWAP (₹{vwap_val:.2f}) — severe mean-reversion snapback risk.",
            "metrics": {"vwap": vwap_val, "lower_2": lower_2}
        })

    # 3. Volatility Spike Anomaly
    if len(df) >= 2:
        last_bar_range = float(df['High'].iloc[-1] - df['Low'].iloc[-1])
        if atr > 0 and (last_bar_range / atr) >= 2.2:
            anomalies.append({
                "code": "VOLATILITY_SPIKE",
                "name": "Bar Volatility Blowout",
                "severity": "CRITICAL",
                "description": f"Latest bar range is {(last_bar_range / atr):.1f}x typical ATR — slippage & spread expansion danger.",
                "metrics": {"bar_range": last_bar_range, "atr": atr}
            })

    # 4. Momentum Exhaustion Anomaly
    if rsi >= 78.0:
        anomalies.append({
            "code": "MOMENTUM_EXHAUSTION",
            "name": "Extreme Overbought Exhaustion",
            "severity": "WARNING",
            "description": f"RSI at {rsi:.1f} indicates momentum climax exhaustion.",
            "metrics": {"rsi": rsi}
        })
    elif rsi <= 22.0:
        anomalies.append({
            "code": "MOMENTUM_EXHAUSTION",
            "name": "Extreme Oversold Exhaustion",
            "severity": "WARNING",
            "description": f"RSI at {rsi:.1f} indicates selling climax exhaustion.",
            "metrics": {"rsi": rsi}
        })

    # Multi-Factor Setup Scoring Engine (0 - 100)
    # Factor 1: Trend Score (0 - 100)
    trend_score = 50.0
    if regime_id == "BULL_TRENDING":
        trend_score = 85.0 if current_price > ema_20 else 70.0
    elif regime_id == "BEAR_TRENDING":
        trend_score = 85.0 if current_price < ema_20 else 70.0
    elif regime_id == "VOLATILITY_EXPANSION_CHOP":
        trend_score = 30.0
    elif regime_id == "LIQUIDITY_COMPRESSION":
        trend_score = 45.0

    # Factor 2: Momentum Score (0 - 100)
    # Healthy trend RSI is between 45 and 68 for bull, 32 and 55 for bear
    if 48.0 <= rsi <= 65.0 and regime_id == "BULL_TRENDING":
        momentum_score = 90.0
    elif 35.0 <= rsi <= 52.0 and regime_id == "BEAR_TRENDING":
        momentum_score = 90.0
    elif rsi > 70.0 or rsi < 30.0:
        momentum_score = 35.0  # Penalized for exhaustion
    else:
        momentum_score = 55.0

    # Factor 3: Liquidity & Volume Score (0 - 100)
    if rvol_current >= 1.5 and rvol_current < 2.5:
        liquidity_score = 92.0  # Perfect institutional flow
    elif rvol_current >= 1.1:
        liquidity_score = 75.0
    elif rvol_current >= 2.5:
        liquidity_score = 50.0  # Excessive anomaly risk
    else:
        liquidity_score = 40.0

    # Factor 4: Structure & Level Quality Score (0 - 100)
    orb_status = orb_data.get("breakout", "INSIDE_RANGE")
    if orb_status in ("BULLISH_BREAKOUT", "BEARISH_BREAKDOWN"):
        structure_score = 88.0
    else:
        structure_score = 60.0

    # Composite Alpha Score calculation
    raw_composite = (trend_score * 0.35) + (momentum_score * 0.25) + (liquidity_score * 0.25) + (structure_score * 0.15)

    # Anomaly penalties
    critical_anomalies = [a for a in anomalies if a["severity"] == "CRITICAL"]
    if critical_anomalies:
        raw_composite = max(10.0, raw_composite - 30.0)
    elif anomalies:
        raw_composite = max(20.0, raw_composite - 12.0)

    composite_score = round(raw_composite, 1)

    # Directional Bias Determination
    if regime_id == "BULL_TRENDING" and composite_score >= 60.0:
        directional_bias = "LONG"
    elif regime_id == "BEAR_TRENDING" and composite_score >= 60.0:
        directional_bias = "SHORT"
    else:
        directional_bias = "NEUTRAL"

    # Setup Quality Tiering
    if composite_score >= 80.0 and len(critical_anomalies) == 0:
        quality_tier = "TIER_1_PRIME"
    elif composite_score >= 70.0 and len(critical_anomalies) == 0:
        quality_tier = "TIER_2_SELECT"
    elif composite_score >= 55.0:
        quality_tier = "TIER_3_MARGINAL"
    else:
        quality_tier = "REJECT"

    setup_evaluation = {
        "composite_score": composite_score,
        "directional_bias": directional_bias,
        "quality_tier": quality_tier,
        "factor_scores": {
            "trend": round(trend_score, 1),
            "momentum": round(momentum_score, 1),
            "liquidity": round(liquidity_score, 1),
            "structure": round(structure_score, 1),
        },
        "anomaly_count": len(anomalies),
        "critical_anomalies": len(critical_anomalies),
    }

    return {
        "current_price": round(current_price, 2),
        "rsi": round(rsi, 2),
        "macd": {
            "macd": round(macd, 4),
            "signal": round(macd_signal, 4),
            "histogram": round(macd_hist, 4),
            "bullish_cross": macd > macd_signal and macd_hist > 0,
        },
        "moving_averages": {
            "ema_20": round(ema_20, 2),
            "ema_50": round(ema_50, 2),
            "ema_200": round(ema_200, 2),
            "golden_cross": ema_50 > ema_200,
        },
        "bollinger_bands": {
            "upper": round(bb_upper, 2),
            "middle": round(bb_mid, 2),
            "lower": round(bb_lower, 2),
            "percent_b": round((current_price - bb_lower) / max(bb_upper - bb_lower, 0.001), 3),
            "bandwidth": round(bb_bandwidth, 4),
        },
        "volatility": {
            "atr": round(atr, 2),
            "atr_percent": round(atr_pct, 2),
        },
        "levels": sr,
        "regime": regime_info["id"],
        "regime_details": regime_info,
        "anomalies": anomalies,
        "setup_evaluation": setup_evaluation,
        "intraday": {
            "vwap": vwap_data,
            "orb": orb_data,
            "rvol": rvol_data,
            "supertrend": supertrend_data,
            "session": session_data,
        },
    }
