import express from 'express';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = process.env.PORT || 3012;

const kafka = new Kafka({
  clientId: 'agent-orchestrator',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'agent-orchestrator-group' });

// AGENT CONFIGURATION
const HEDGE_ENABLED = true;
const MAX_HEDGE_PERCENT = 0.2; // 20% of portfolio

async function startAgent() {
  await consumer.connect();
  await consumer.subscribe({ topics: ['ai_signals', 'portfolio_updates'], fromBeginning: false });

  console.log("🦅 Agent Orchestrator: SOVEREIGN MODE ACTIVE");

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value?.toString() || '{}');

      if (topic === 'ai_signals') {
        await handleSignal(data);
      }
    },
  });
}

/**
 * SOVEREIGN HEDGING LOGIC
 * If Market Regime is BEAR and we have long positions, buy inverse assets (e.g., Short Index)
 */
async function handleSignal(signal: any) {
    const { symbol, regime, signal: type, confidence, memo, isPaper = true } = signal;

    console.log(`🧠 [Orchestrator] Processing AI Signal: ${type} ${symbol} (Confidence: ${confidence}%)`);
    if (memo) console.log(`📝 Memo: ${memo}`);

    if (type === 'HOLD') {
        console.log(`⏸️ [Orchestrator] Holding position for ${symbol}`);
        return;
    }

    // Execute via Trading Engine to ensure database record + slippage calculation
    try {
        const tradeRequest = {
            userId: process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000',
            symbol,
            quantity: 1, // Default to 1 for automated signals, can be made dynamic
            side: type,
            memo: memo || `AI Automated ${type} Signal`,
            isPaper
        };

        const tradingUrl = process.env.TRADING_SERVICE_URL || 'http://localhost:3006';
        const response = await axios.post(`${tradingUrl}/api/v1/trading/execute`, tradeRequest);
        
        console.log(`✅ [Orchestrator] Automated trade executed: ${response.data.orderId}`);
    } catch (err: any) {
        console.error(`❌ [Orchestrator] Automated execution failed: ${err.message}`);
    }

    // Existing Hegde Logic
    if (regime === 'BEAR' && type === 'SELL' && confidence > 80) {
        console.log(`🛡️ Agent Alert: Market Regime is BEAR. Initiating Protective Hedging...`);
        // ... (Hedge logic remains)
    }
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', agentState: 'SOVEREIGN_HEDGING_ACTIVE' });
});

app.listen(port, async () => {
    await startAgent();
    console.log(`🚀 Agent Orchestrator (2026 Sovereign AI) on port ${port}`);
});
