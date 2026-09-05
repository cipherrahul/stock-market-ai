"""
News & Sentiment Analyst Agent
Extracts market narrative, identifies corporate catalysts, and scores sentiment.
"""

from typing import Dict, Any, List
import json
try:
    from .base import BaseAgent
except ImportError:
    from agents.base import BaseAgent


class SentimentAnalyst(BaseAgent):
    def __init__(self):
        super().__init__(
            name="MacroNews_Sentinel",
            role="Chief Fundamental & Market Narrative Analyst"
        )

    async def analyze(self, symbol: str, news_items: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Synthesize headlines into a grounded narrative thesis and sentiment score.
        """
        headlines = [item.get("title", "") for item in news_items if item.get("title")]
        combined_text = " | ".join(headlines)

        # Baseline semantic scoring
        bull_words = {"growth", "profit", "surge", "record", "beat", "rally", "upgrade", "outperform", "dividend", "expansion"}
        bear_words = {"fall", "slump", "loss", "miss", "probe", "lawsuit", "decline", "downgrade", "warning", "debt", "risk"}

        text_lower = combined_text.lower()
        bull_count = sum(1 for w in bull_words if w in text_lower)
        bear_count = sum(1 for w in bear_words if w in text_lower)

        raw_sentiment = 0.0
        if bull_count + bear_count > 0:
            raw_sentiment = (bull_count - bear_count) / (bull_count + bear_count)

        # LLM Catalyst & Semantic Extraction (if configured)
        system_prompt = (
            "You are a hedge fund market narrative analyst. "
            "Given recent news headlines for a stock, extract the primary catalyst, assign a sentiment score from -1.0 (very negative) to +1.0 (very positive), "
            "and rate the catalyst impact as HIGH, MEDIUM, or LOW. "
            "Output JSON with keys: 'catalyst', 'sentiment_score', 'impact', 'thesis'."
        )
        user_prompt = f"Stock: {symbol}\nHeadlines:\n" + "\n".join(f"- {h}" for h in headlines[:5])

        llm_response = await self.llm.generate_response(system_prompt, user_prompt)
        catalyst = headlines[0] if headlines else "Consolidation before earnings"
        impact = "MEDIUM"
        thesis = ""
        sentiment_score = raw_sentiment

        if llm_response:
            try:
                parsed = json.loads(llm_response.replace("```json", "").replace("```", "").strip())
                catalyst = parsed.get("catalyst", catalyst)
                sentiment_score = float(parsed.get("sentiment_score", sentiment_score))
                impact = parsed.get("impact", impact)
                thesis = parsed.get("thesis", "")
            except Exception:
                pass

        if not thesis:
            if sentiment_score > 0.2:
                thesis = f"Positive news momentum on {symbol}. Key catalyst: {catalyst}"
            elif sentiment_score < -0.2:
                thesis = f"Negative news pressure on {symbol}. Caution urged due to: {catalyst}"
            else:
                thesis = f"Neutral market sentiment on {symbol} with balanced headline flow."

        return {
            "agent": self.name,
            "sentiment_score": round(sentiment_score, 2),
            "sentiment_bias": "BULLISH" if sentiment_score > 0.15 else "BEARISH" if sentiment_score < -0.15 else "NEUTRAL",
            "impact": impact,
            "primary_catalyst": catalyst,
            "thesis": thesis,
            "sources_count": len(headlines)
        }
