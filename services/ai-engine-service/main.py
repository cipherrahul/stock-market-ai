"""
Sovereign AI Engine - Production Multi-Agent Trading System.
Exposes multi-agent consensus, quantitative technical tools, and real-time streaming endpoints.
"""

import os
import json
import logging
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

try:
    from .orchestrator import MultiAgentDebateOrchestrator
    from .tools.market_data import get_current_quote, fetch_ohlcv
    from .tools.indicators import analyze_all_indicators
except ImportError:
    from orchestrator import MultiAgentDebateOrchestrator
    from tools.market_data import get_current_quote, fetch_ohlcv
    from tools.indicators import analyze_all_indicators

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai-engine-service")

app = FastAPI(
    title="Sovereign Multi-Agent Trading Engine",
    version="3.0.0",
    description="State-of-the-art autonomous multi-agent quantitative debate and execution engine."
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Orchestrator
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
orchestrator = MultiAgentDebateOrchestrator(redis_url=REDIS_URL)


class AnalysisRequest(BaseModel):
    symbol: str
    account_balance: Optional[float] = 100_000.0
    publish_signal: Optional[bool] = True
    interval: Optional[str] = "5m"


@app.get("/health")
async def health():
    return {
        "status": "HEALTHY",
        "service": "ai-engine-service",
        "version": "3.0.0",
        "architecture": "Multi-Agent Swarm (Technical, Sentiment, Risk, Portfolio)",
        "llm_provider": orchestrator.tech_analyst.llm.model,
    }


@app.post("/api/v1/agents/analyze")
async def run_agent_analysis(req: AnalysisRequest):
    """
    Triggers the full collaborative multi-agent debate loop:
    1. Technical Analyst evaluates price momentum & indicators.
    2. Sentiment Analyst evaluates news catalysts.
    3. Risk Guardian audits the setup and evaluates veto conditions.
    4. Portfolio Manager synthesizes consensus, sizes the trade, and issues directive.
    """
    try:
        result = await orchestrator.run_analysis_cycle(
            symbol=req.symbol,
            account_balance=req.account_balance or 100_000.0,
            publish_signal=req.publish_signal if req.publish_signal is not None else True,
            interval=req.interval or "5m",
        )
        return result
    except Exception as e:
        logger.error(f"Analysis failed for {req.symbol}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/agents/indicators/{symbol}")
async def get_indicators(symbol: str, interval: str = "5m"):
    """Direct access to quantitative indicators for charting and intraday cockpit."""
    try:
        df = fetch_ohlcv(symbol, period="5d" if interval in ("1m", "5m", "15m", "30m") else "1mo", interval=interval)
        indicators = analyze_all_indicators(df)
        return indicators
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/agents/quote/{symbol}")
async def get_quote(symbol: str):
    """Fetch live quote snapshot."""
    try:
        return get_current_quote(symbol)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/ai/diagnostics/{symbol}")
async def get_ai_diagnostics(symbol: str, interval: str = "5m"):
    """
    Returns enterprise-grade 4-stage pipeline diagnostics for a symbol:
    - 5-State Market Regime
    - Statistical Anomaly Detection (VWAP 3-sigma, RVOL, Volatility blowouts)
    - Multi-Factor Setup Scores (Trend, Momentum, Liquidity, Structure)
    - Quality Tier and Directional Bias
    """
    try:
        df = fetch_ohlcv(symbol, period="5d" if interval in ("1m", "5m", "15m", "30m") else "1mo", interval=interval)
        indicators = analyze_all_indicators(df)
        setup_eval = indicators.get("setup_evaluation", {})
        regime_info = indicators.get("regime_details", {})
        anomalies = indicators.get("anomalies", [])

        return {
            "symbol": symbol.upper().strip(),
            "price": indicators.get("current_price"),
            "regime": indicators.get("regime"),
            "regime_details": regime_info,
            "anomalies": anomalies,
            "setup_evaluation": setup_eval,
            "intraday": indicators.get("intraday", {}),
            "volatility": indicators.get("volatility", {}),
            "levels": indicators.get("levels", {}),
            "rsi": indicators.get("rsi"),
            "macd": indicators.get("macd"),
            "moving_averages": indicators.get("moving_averages"),
        }
    except Exception as e:
        logger.error(f"Diagnostics generation failed for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------------
# Backward Compatibility Endpoints (Drop-in replacement for app.py & app_v2.py)
# ----------------------------------------------------------------------------

@app.get("/api/v1/ai/predict/{symbol}")
async def legacy_predict(symbol: str):
    """Backward-compatible endpoint for existing dashboard integrations."""
    result = await orchestrator.run_analysis_cycle(symbol=symbol, publish_signal=False)
    tech = result["agent_perspectives"]["technical"]
    sent = result["agent_perspectives"]["sentiment"]
    return {
        "symbol": result["symbol"],
        "price": result["price"],
        "signal": result["decision"],
        "confidence": result["conviction"],
        "rsi": result["market_indicators"]["rsi"],
        "sentiment": sent["sentiment_score"],
        "memo": result["executive_memo"],
        "regime": result["market_indicators"]["regime"],
    }


@app.post("/api/v1/ai/generate-signal")
async def legacy_generate_signal(
    payload: Optional[Dict[str, Any]] = None,
    symbol: Optional[str] = None
):
    """Backward-compatible endpoint for trading orchestrator and dashboard."""
    target_sym = "AAPL"
    if payload and "symbol" in payload:
        target_sym = str(payload["symbol"]).strip().upper()
    elif symbol:
        target_sym = symbol.strip().upper()

    result = await orchestrator.run_analysis_cycle(symbol=target_sym, publish_signal=True)
    return {
        "symbol": result["symbol"],
        "signal": result["decision"],
        "confidence": result["conviction"],
        "price_target": result["risk_parameters"]["take_profit"],
        "stop_loss": result["risk_parameters"]["stop_loss"],
        "reasoning": result["executive_memo"],
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 3004))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
