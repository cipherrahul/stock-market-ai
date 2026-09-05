"""
Portfolio Manager Agent (Consensus Arbiter & Allocator)
Synthesizes arguments from Technical and Sentiment agents, respects Risk Guardian vetos,
determines exact position sizing, and signs execution directives.
"""

from typing import Dict, Any, List
import json
try:
    from .base import BaseAgent
except ImportError:
    from agents.base import BaseAgent


class PortfolioManager(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Sovereign_PortfolioManager",
            role="Chief Investment Officer & Allocation Arbiter"
        )

    async def arbitrate(
        self,
        symbol: str,
        price: float,
        tech_thesis: Dict[str, Any],
        sent_thesis: Dict[str, Any],
        risk_audit: Dict[str, Any],
        account_balance: float = 100_000.0,
    ) -> Dict[str, Any]:
        """
        Formulate consensus decision and execute sizing.
        """
        approved = risk_audit.get("approved", False)
        direction = risk_audit.get("proposed_direction", "HOLD")
        tech_conf = tech_thesis.get("confidence", 0.5)
        sent_score = sent_thesis.get("sentiment_score", 0.0)
        max_shares = risk_audit.get("max_shares_allowed", 0)

        # If Risk Vetoed, mandate HOLD
        if not approved or direction == "HOLD":
            final_action = "HOLD"
            allocated_quantity = 0
            overall_conviction = 0.50
            executive_memo = f"Decision: HOLD on {symbol}. {risk_audit.get('veto_reason', 'Neutral parameters')}."
        else:
            final_action = direction
            # Conviction confluence weighting (60% Technical + 40% Sentiment)
            sentiment_conf_component = (sent_score + 1.0) / 2.0  # normalize -1..1 to 0..1
            overall_conviction = (tech_conf * 0.65) + (sentiment_conf_component * 0.35)
            
            # Sizing based on conviction
            conviction_factor = max(0.2, min(overall_conviction, 1.0))
            allocated_quantity = max(1, int(max_shares * conviction_factor))

            executive_memo = (
                f"Consensus {final_action} on {symbol} at ${price:.2f} (Conviction: {overall_conviction*100:.1f}%). "
                f"Technicals confirm {tech_thesis.get('pattern', 'trend')} while sentiment is {sent_thesis.get('sentiment_bias')}. "
                f"Allocated {allocated_quantity} shares with strict stop at ${risk_audit.get('stop_loss')} "
                f"and target at ${risk_audit.get('take_profit')}."
            )

        # Optional LLM Executive Synthesis for rich human-in-the-loop explanation
        system_prompt = (
            "You are the Chief Investment Officer of an autonomous trading hedge fund. "
            "Deliver a crisp 2-sentence executive summary of the committee's decision. "
            "Be direct, institutional, and grounded in the data."
        )
        user_prompt = (
            f"Asset: {symbol}, Action: {final_action}, Quantity: {allocated_quantity}, "
            f"Conviction: {overall_conviction:.2f}, Tech: {tech_thesis.get('thesis')}, "
            f"Sentiment: {sent_thesis.get('thesis')}, Risk: {risk_audit.get('audit_verdict')}"
        )
        llm_memo = await self.llm.generate_response(system_prompt, user_prompt)
        if llm_memo and len(llm_memo.strip()) > 20:
            executive_memo = llm_memo.strip()

        return {
            "decision": final_action,
            "symbol": symbol.upper(),
            "execution_price": price,
            "quantity": allocated_quantity,
            "conviction": round(overall_conviction, 2),
            "stop_loss": risk_audit.get("stop_loss"),
            "take_profit": risk_audit.get("take_profit"),
            "risk_reward_ratio": risk_audit.get("reward_risk_ratio", 2.0),
            "executive_memo": executive_memo,
            "is_paper": True,
            "idempotency_key": f"order-{symbol}-{int(price*100)}",
        }
