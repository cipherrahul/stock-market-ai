"""
Risk Guardian Agent (The Devil's Advocate)
Audits proposed trades, enforces capital preservation, calculates dynamic ATR stop-loss/take-profit,
and holds veto authority over excessive exposure.
"""

from typing import Dict, Any, List, Optional
import json
try:
    from .base import BaseAgent
except ImportError:
    from agents.base import BaseAgent


class RiskGuardian(BaseAgent):
    def __init__(self):
        super().__init__(
            name="RiskSentinel_Guardian",
            role="Chief Risk Officer & Portfolio Auditor"
        )

    async def audit_trade(
        self,
        symbol: str,
        price: float,
        tech_thesis: Dict[str, Any],
        sent_thesis: Dict[str, Any],
        atr: float,
        account_balance: float = 100_000.0,
        max_risk_pct: float = 0.02, # 2% max risk per trade
    ) -> Dict[str, Any]:
        """
        Audit trade proposition. Returns approval status, stop loss, take profit, and max risk.
        """
        tech_bias = tech_thesis.get("bias", "NEUTRAL")
        tech_conf = tech_thesis.get("confidence", 0.5)
        sent_bias = sent_thesis.get("sentiment_bias", "NEUTRAL")
        sent_score = sent_thesis.get("sentiment_score", 0.0)

        # 1. Conflict Check (Divergence Audit)
        conflict_detected = False
        if (tech_bias == "BULLISH" and sent_bias == "BEARISH") or (tech_bias == "BEARISH" and sent_bias == "BULLISH"):
            conflict_detected = True

        # 2. Dynamic ATR Risk Calculations
        # 1.5x ATR for Stop-Loss, 3.0x ATR for Take-Profit (2:1 Risk-Reward)
        volatility_buffer = max(atr * 1.5, price * 0.015)
        
        if tech_bias == "BUY" or tech_bias == "BULLISH":
            proposed_direction = "BUY"
            stop_loss = round(price - volatility_buffer, 2)
            take_profit = round(price + (volatility_buffer * 2.0), 2)
        elif tech_bias == "SELL" or tech_bias == "BEARISH":
            proposed_direction = "SELL"
            stop_loss = round(price + volatility_buffer, 2)
            take_profit = round(price - (volatility_buffer * 2.0), 2)
        else:
            proposed_direction = "HOLD"
            stop_loss = round(price * 0.98, 2)
            take_profit = round(price * 1.04, 2)

        risk_per_share = abs(price - stop_loss)
        max_dollar_risk = account_balance * max_risk_pct
        max_shares_allowed = int(max_dollar_risk / max(risk_per_share, 0.01))

        # 3. Veto Authority Logic
        vetoed = False
        veto_reason = ""

        if proposed_direction == "HOLD":
            vetoed = True
            veto_reason = "Direction is neutral; no edge identified."
        elif tech_conf < 0.60:
            vetoed = True
            veto_reason = f"Technical confidence ({tech_conf*100:.1f}%) below minimum institutional hurdle (60%)."
        elif conflict_detected and abs(sent_score) > 0.4:
            vetoed = True
            veto_reason = f"Severe divergence: Technicals are {tech_bias} but News sentiment is opposing ({sent_score:+.2f})."
        elif risk_per_share <= 0:
            vetoed = True
            veto_reason = "Invalid risk parameters."

        # Risk Audit Thesis
        if vetoed:
            thesis = f"❌ TRADE VETOED: {veto_reason} Capital preserved."
        else:
            thesis = (
                f"✅ TRADE APPROVED: Risk-Reward 2.0:1 verified. "
                f"Stop-Loss: ${stop_loss} | Target: ${take_profit}. Max size: {max_shares_allowed} units."
            )

        return {
            "agent": self.name,
            "approved": not vetoed,
            "proposed_direction": proposed_direction,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "risk_per_share": round(risk_per_share, 2),
            "max_shares_allowed": max_shares_allowed,
            "reward_risk_ratio": 2.0,
            "conflict_detected": conflict_detected,
            "veto_reason": veto_reason if vetoed else None,
            "audit_verdict": thesis
        }
