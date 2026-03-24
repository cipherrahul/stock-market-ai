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
    const { symbol, regime, signal: type, confidence } = signal;

    if (regime === 'BEAR' && type === 'SELL' && confidence > 80) {
        console.log(`🛡️ Agent Alert: Market Regime is BEAR. Initiating Protective Hedging for ${symbol}...`);
        
        // 2026 SOVEREIGN HEDGE: Executing real-world SQQQ position to neutralize delta
        try {
            const hedgeOrder = {
                symbol: 'SQQQ', // Institutional Inverse ETF
                side: 'BUY',
                quantity: 100, // Dynamic calculation planned for Phase 22
                idempotencyKey: `hedge_${Date.now()}`,
                userId: 'user_123',
                isAgentic: true,
                reason: 'AUTO_HEDGE_BEAR_REGIME'
            };

            await axios.post(`${process.env.BROKER_SERVICE_URL}/api/v1/broker/execute`, hedgeOrder);
            console.log("✅ [SovereignHedge] Real-world SQQQ Position Opened Successfully.");
        } catch (err: any) {
            console.warn("⚠️ [SovereignHedge] Protection Execution Failed:", err.message);
        }
    }
}

app.get('/health', (req, res) => {
  res.json({ status: 'OK', agentState: 'SOVEREIGN_HEDGING_ACTIVE' });
});

app.listen(port, async () => {
    await startAgent();
    console.log(`🚀 Agent Orchestrator (2026 Sovereign AI) on port ${port}`);
});
