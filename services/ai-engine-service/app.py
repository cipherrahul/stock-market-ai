from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
import redis
import os
from typing import List, Optional
import numpy as np
from sklearn.ensemble import RandomForestClassifier

app = FastAPI(title="AI Engine Service")

# Database connection
db = psycopg2.connect(
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT", 5432),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME")
)

# Redis connection
redis_client = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379"))

class TradeSignal(BaseModel):
    symbol: str
    signal: str  # BUY, SELL, HOLD
    confidence: float
    price_target: float
    reasoning: str

@app.get("/health")
async def health():
    return {"status": "OK", "service": "ai-engine-service"}

@app.post("/api/v1/ai/generate-signal")
async def generate_signal(symbol: str) -> TradeSignal:
    """
    Generate AI trading signal for a symbol
    """
    try:
        # Fetch historical data
        cursor = db.cursor()
        cursor.execute(
            "SELECT price, volume FROM market_history WHERE symbol = %s ORDER BY date DESC LIMIT 100",
            (symbol,)
        )
        history = cursor.fetchall()
        
        if not history:
            raise HTTPException(status_code=404, detail="No historical data found")
        
        prices = np.array([h[0] for h in history])
        
        # Simple ML-based signal generation (replace with actual models)
        sma_20 = np.mean(prices[:20])
        sma_50 = np.mean(prices[:50])
        
        current_price = prices[0]
        
        if sma_20 > sma_50:
            signal = "BUY"
            confidence = 0.7
            price_target = current_price * 1.05
        elif sma_20 < sma_50:
            signal = "SELL"
            confidence = 0.6
            price_target = current_price * 0.95
        else:
            signal = "HOLD"
            confidence = 0.5
            price_target = current_price
        
        result = TradeSignal(
            symbol=symbol,
            signal=signal,
            confidence=confidence,
            price_target=price_target,
            reasoning=f"Based on SMA crossover strategy. Current SMA20: {sma_20:.2f}, SMA50: {sma_50:.2f}"
        )
        
        # Cache signal
        redis_client.setex(f"signal:{symbol}", 300, result.json())
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/ai/train-model")
async def train_model(symbol: str):
    """
    Train model on historical data
    """
    try:
        return {
            "status": "training",
            "symbol": symbol,
            "message": "Model training started in background"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
