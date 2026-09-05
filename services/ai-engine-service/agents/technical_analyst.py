"""
Technical Analyst Agent
Evaluates price action, momentum, moving average crosses, and volatility.
"""

from typing import Dict, Any, List
import json
try:
    from .base import BaseAgent
except ImportError:
    from agents.base import BaseAgent


class TechnicalAnalyst(BaseAgent):
    def __init__(self):
        super().__init__(
            name="AlphaTech_Analyst",
            role="Senior Quantitative Technical Analyst"
        )

    async def analyze(self, symbol: str, indicators: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze technical indicators and return a structured thesis.
        """
        price = indicators.get("current_price", 0.0)
        rsi = indicators.get("rsi", 50.0)
        macd = indicators.get("macd", {})
        mas = indicators.get("moving_averages", {})
        bb = indicators.get("bollinger_bands", {})
        regime = indicators.get("regime", "CHOPPY_SIDEWAYS")
        levels = indicators.get("levels", {})

        # Grounded quantitative scoring
        bull_points = 0
        bear_points = 0
        signals_list = []

        # ── Intraday Benchmarks (VWAP, ORB, RVOL, Supertrend, Session) ─────────
        intraday = indicators.get("intraday", {})
        vwap_info = intraday.get("vwap", {})
        orb_info = intraday.get("orb", {})
        rvol_info = intraday.get("rvol", {})
        supertrend_info = intraday.get("supertrend", {})
        session_info = intraday.get("session", {})

        # 1. VWAP Alignment
        vwap_val = vwap_info.get("vwap", 0.0)
        if vwap_val > 0:
            if price > vwap_val:
                bull_points += 2
                signals_list.append(f"Trading above institutional VWAP ({vwap_val:.2f})")
            else:
                bear_points += 2
                signals_list.append(f"Trading below institutional VWAP ({vwap_val:.2f})")

        # 2. Opening Range Breakout (ORB) with RVOL Volume Confirmation
        orb_status = orb_info.get("breakout", "INSIDE_RANGE")
        rvol_val = rvol_info.get("rvol", 1.0)
        if orb_status == "BULLISH_BREAKOUT":
            if rvol_val >= 1.5:
                bull_points += 3
                signals_list.append(f"ORB Bullish Breakout confirmed by high volume (RVOL: {rvol_val:.1f}x)")
            else:
                bull_points += 1
                signals_list.append(f"ORB Bullish Breakout with low volume caution (RVOL: {rvol_val:.1f}x)")
        elif orb_status == "BEARISH_BREAKDOWN":
            if rvol_val >= 1.5:
                bear_points += 3
                signals_list.append(f"ORB Bearish Breakdown confirmed by high volume (RVOL: {rvol_val:.1f}x)")
            else:
                bear_points += 1
                signals_list.append(f"ORB Bearish Breakdown with low volume caution (RVOL: {rvol_val:.1f}x)")

        # 3. Supertrend Trailing Direction
        st_trend = supertrend_info.get("trend")
        if st_trend == "BULLISH":
            bull_points += 2
            signals_list.append(f"Supertrend Bullish (Stop: {supertrend_info.get('stop_line', 0)})")
        elif st_trend == "BEARISH":
            bear_points += 2
            signals_list.append(f"Supertrend Bearish (Stop: {supertrend_info.get('stop_line', 0)})")

        # ── Classic Technicals ──────────────────────────────────────────────
        if rsi < 35:
            bull_points += 2
            signals_list.append(f"RSI oversold at {rsi:.1f}")
        elif rsi > 70:
            bear_points += 2
            signals_list.append(f"RSI overbought at {rsi:.1f}")

        if macd.get("bullish_cross"):
            bull_points += 2
            signals_list.append("MACD bullish crossover")
        elif macd.get("macd", 0) < macd.get("signal", 0):
            bear_points += 1
            signals_list.append("MACD bearish posture")

        if mas.get("golden_cross"):
            bull_points += 2
            signals_list.append("EMA 50 above EMA 200 (Golden Cross)")
        else:
            bear_points += 1

        if price > mas.get("ema_20", price):
            bull_points += 1
            signals_list.append("Price trading above 20 EMA")
        else:
            bear_points += 1

        # Determine bias & baseline confidence
        total = bull_points + bear_points
        if total == 0: total = 1
        
        if bull_points > bear_points + 2:
            bias = "BULLISH"
            confidence = min(0.60 + (bull_points / 20.0), 0.95)
        elif bear_points > bull_points + 2:
            bias = "BEARISH"
            confidence = min(0.60 + (bear_points / 20.0), 0.95)
        else:
            bias = "NEUTRAL"
            confidence = 0.50

        # Session Phase Filter: Dampen false signals during midday chop or near square-off
        sess_phase = session_info.get("phase", "MARKET_CLOSED")
        if sess_phase == "MIDDAY_CHOP":
            confidence = max(0.40, confidence - 0.15)
            signals_list.append("Midday chop phase: confidence reduced to avoid false breakouts")
        elif sess_phase in ("SQUARE_OFF_ONLY", "MARKET_CLOSING"):
            bias = "NEUTRAL"
            confidence = 0.35
            signals_list.append(f"Session {sess_phase}: New entries prohibited, square-off window")

        # LLM Synthesis (if configured)
        system_prompt = (
            "You are a top-tier institutional quantitative technical analyst. "
            "Given recent indicator values, provide a sharp, 2-sentence technical rationale. "
            "Output JSON with keys: 'thesis' and 'pattern'."
        )
        user_prompt = f"Symbol: {symbol}, Price: {price}, RSI: {rsi}, MACD: {macd}, Regime: {regime}, Levels: {levels}"
        
        llm_response = await self.llm.generate_response(system_prompt, user_prompt)
        thesis = ""
        pattern = regime
        if llm_response:
            try:
                parsed = json.loads(llm_response.replace("```json", "").replace("```", "").strip())
                thesis = parsed.get("thesis", "")
                pattern = parsed.get("pattern", regime)
            except Exception:
                thesis = llm_response.strip()

        if not thesis:
            thesis = (
                f"{symbol} is in a {regime} regime at ${price:.2f}. "
                f"RSI at {rsi:.1f} with {'positive' if bias == 'BULLISH' else 'negative'} MACD momentum."
            )

        return {
            "agent": self.name,
            "bias": bias,
            "confidence": round(confidence, 2),
            "regime": regime,
            "pattern": pattern,
            "key_signals": signals_list,
            "support": levels.get("support", price * 0.97),
            "resistance": levels.get("resistance", price * 1.03),
            "thesis": thesis
        }
