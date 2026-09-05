"""
Multi-Agent Trading Debate Orchestrator.
Runs the collaborative consensus pipeline across the 4 specialized agents,
records the full debate transcript, and broadcasts events to Redis.
"""

from typing import Dict, Any, List, Optional
import json
import logging
import datetime
import redis

try:
    from .tools.market_data import fetch_ohlcv, get_current_quote
    from .tools.indicators import analyze_all_indicators
    from .tools.news_scraper import fetch_financial_news
    from .agents.technical_analyst import TechnicalAnalyst
    from .agents.sentiment_analyst import SentimentAnalyst
    from .agents.risk_guardian import RiskGuardian
    from .agents.portfolio_manager import PortfolioManager
except ImportError:
    from tools.market_data import fetch_ohlcv, get_current_quote
    from tools.indicators import analyze_all_indicators
    from tools.news_scraper import fetch_financial_news
    from agents.technical_analyst import TechnicalAnalyst
    from agents.sentiment_analyst import SentimentAnalyst
    from agents.risk_guardian import RiskGuardian
    from agents.portfolio_manager import PortfolioManager

logger = logging.getLogger(__name__)


class MultiAgentDebateOrchestrator:
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.tech_analyst = TechnicalAnalyst()
        self.sent_analyst = SentimentAnalyst()
        self.risk_guardian = RiskGuardian()
        self.portfolio_mgr = PortfolioManager()

        self.redis_client = None
        try:
            self.redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis connection deferred in Orchestrator: {e}")

    def _broadcast_thought(self, agent_name: str, role: str, stage: str, thought: str):
        """Emit agent thinking event to Redis channel for live UI streaming."""
        payload = {
            "agent": agent_name,
            "role": role,
            "stage": stage,
            "thought": thought,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        if self.redis_client:
            try:
                self.redis_client.publish("agent:thoughts", json.dumps(payload))
            except Exception:
                pass
        return payload

    async def run_analysis_cycle(
        self,
        symbol: str,
        account_balance: float = 100_000.0,
        publish_signal: bool = True,
        interval: str = "5m",
    ) -> Dict[str, Any]:
        """
        Execute full collaborative multi-agent debate on a given symbol.
        Defaults to 5m intraday resolution with session-phase gating.
        """
        debate_log: List[Dict[str, Any]] = []
        sym = symbol.upper().strip()

        # Step 1: Ingest Data & Quantitative Calculations
        thought_0 = self._broadcast_thought(
            "System_Ingress",
            "Data Pipeline",
            "INGESTION",
            f"Ingesting live order book, {interval} candlesticks, and Google News catalysts for {sym}..."
        )
        debate_log.append(thought_0)

        df = fetch_ohlcv(sym, period="5d" if interval in ("1m", "5m", "15m", "30m") else "1mo", interval=interval)
        indicators = analyze_all_indicators(df)
        current_price = indicators["current_price"]
        atr = indicators["volatility"]["atr"]
        intraday = indicators.get("intraday", {})
        session_info = intraday.get("session", {})
        vwap_val = intraday.get("vwap", {}).get("vwap", current_price)
        rvol_val = intraday.get("rvol", {}).get("rvol", 1.0)
        news_items = await fetch_financial_news(sym, max_items=5)

        # Step 2: Technical Analyst
        thought_1 = self._broadcast_thought(
            self.tech_analyst.name,
            self.tech_analyst.role,
            "TECHNICAL_ANALYSIS",
            f"Analyzing Intraday: VWAP=₹{vwap_val:.2f}, RVOL={rvol_val:.1f}x, Session={session_info.get('phase', 'N/A')}, RSI={indicators['rsi']}."
        )
        debate_log.append(thought_1)
        tech_thesis = await self.tech_analyst.analyze(sym, indicators)

        # Step 3: News & Sentiment Analyst
        thought_2 = self._broadcast_thought(
            self.sent_analyst.name,
            self.sent_analyst.role,
            "NEWS_SENTIMENT",
            f"Scanning {len(news_items)} live financial headlines for structural catalysts and sentiment..."
        )
        debate_log.append(thought_2)
        sent_thesis = await self.sent_analyst.analyze(sym, news_items)

        # Step 4: Risk Guardian (Audit & Veto Gate)
        thought_3 = self._broadcast_thought(
            self.risk_guardian.name,
            self.risk_guardian.role,
            "RISK_AUDIT",
            f"Auditing trade proposal: Tech({tech_thesis['bias']}) vs News({sent_thesis['sentiment_bias']}). Computing ATR stop-loss..."
        )
        debate_log.append(thought_3)
        risk_audit = await self.risk_guardian.audit_trade(
            symbol=sym,
            price=current_price,
            tech_thesis=tech_thesis,
            sent_thesis=sent_thesis,
            atr=atr,
            account_balance=account_balance,
        )

        # Step 5: Portfolio Manager (Consensus & Allocation)
        thought_4 = self._broadcast_thought(
            self.portfolio_mgr.name,
            self.portfolio_mgr.role,
            "PORTFOLIO_ALLOCATION",
            f"Reviewing Risk verdict (Approved={risk_audit['approved']}). Formulating final capital allocation..."
        )
        debate_log.append(thought_4)
        consensus = await self.portfolio_mgr.arbitrate(
            symbol=sym,
            price=current_price,
            tech_thesis=tech_thesis,
            sent_thesis=sent_thesis,
            risk_audit=risk_audit,
            account_balance=account_balance,
        )

        # Step 6: Institutional 4-Stage Pipeline Event Emission
        setup_eval = indicators.get("setup_evaluation", {})
        regime_info = indicators.get("regime_details", {})
        anomalies_list = indicators.get("anomalies", [])

        # Broadcast structured diagnostic setup event to Redis for Rule Engine & Risk Gatekeeper
        if publish_signal and self.redis_client:
            try:
                diagnostic_event = {
                    "event": "AI_SETUP_EVALUATED",
                    "symbol": sym,
                    "price": current_price,
                    "directional_bias": setup_eval.get("directional_bias", consensus["decision"]),
                    "composite_score": setup_eval.get("composite_score", round(consensus["conviction"] * 100, 1)),
                    "quality_tier": setup_eval.get("quality_tier", "TIER_2_SELECT"),
                    "factor_scores": setup_eval.get("factor_scores", {}),
                    "regime": indicators.get("regime", "MEAN_REVERTING_RANGE"),
                    "regime_details": regime_info,
                    "anomalies": anomalies_list,
                    "proposed_trade": {
                        "action": consensus["decision"],
                        "quantity": consensus["quantity"],
                        "price": current_price,
                        "stop_loss": consensus["stop_loss"],
                        "take_profit": consensus["take_profit"],
                        "risk_reward_ratio": consensus["risk_reward_ratio"],
                        "atr": atr,
                        "orderVariant": "MIS",
                    },
                    "conviction": consensus["conviction"],
                    "executive_memo": consensus["executive_memo"],
                    "session_phase": session_info.get("phase"),
                    "trade_allowed_session": session_info.get("trade_allowed", True),
                    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                # Publish diagnostic event for Rule Engine validation
                self.redis_client.publish("trading:signals", json.dumps(diagnostic_event))
                logger.info(f"📡 Published AI_SETUP_EVALUATED for {sym}: Score={diagnostic_event['composite_score']}, Regime={diagnostic_event['regime']}")
            except Exception as e:
                logger.warning(f"Failed to publish AI_SETUP_EVALUATED to Redis: {e}")

        return {
            "symbol": sym,
            "price": current_price,
            "decision": consensus["decision"],
            "quantity": consensus["quantity"],
            "conviction": consensus["conviction"],
            "executive_memo": consensus["executive_memo"],
            "risk_parameters": {
                "stop_loss": consensus["stop_loss"],
                "take_profit": consensus["take_profit"],
                "risk_reward_ratio": consensus["risk_reward_ratio"],
                "approved": risk_audit["approved"],
                "veto_reason": risk_audit["veto_reason"]
            },
            "agent_perspectives": {
                "technical": tech_thesis,
                "sentiment": sent_thesis,
                "risk": risk_audit,
            },
            "market_indicators": indicators,
            "setup_evaluation": setup_eval,
            "regime_details": regime_info,
            "anomalies": anomalies_list,
            "news_catalog": news_items[:3],
            "debate_log": debate_log,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
