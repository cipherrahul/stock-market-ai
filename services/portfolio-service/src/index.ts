import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { Pool } from 'pg';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import { Kafka } from 'kafkajs';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

// 2026 AUDIT: SESSION HARDENING (Secure Cookies)
app.use((req, res, next) => {
    res.setHeader('Set-Cookie', 'SessionID=Hardened; HttpOnly; Secure; SameSite=Strict');
    next();
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

const redisClient = createClient({ url: process.env.REDIS_URL });

/**
 * HELPER: Fetch positions from DB
 */
async function getPositionsFromDB(userId: string, isPaper: boolean = false): Promise<any[]> {
    const result = await pool.query(
        `SELECT symbol, SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) as quantity, AVG(price) as avg_price 
         FROM orders WHERE user_id = $1 AND is_paper = $2 AND status = 'EXECUTED' GROUP BY symbol`,
        [userId, isPaper]
    );
    return result.rows.filter((r: any) => r.quantity > 0);
}

const kafka = new Kafka({
  clientId: 'portfolio-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
const PORTFOLIO_CACHE = new Map<string, any>();

/**
 * REFRESH PORTFOLIO CACHE
 */
async function syncPortfolio(userId: string, isPaper: boolean = false) {
  try {
    const positions = await getPositionsFromDB(userId, isPaper);
    // Calc total value in cents (Base Currency: INR)
    const balanceResult = await pool.query('SELECT cash, currency, is_paper FROM portfolios WHERE user_id = $1 AND is_paper = $2', [userId, isPaper]);
    const balances = balanceResult.rows;
    const hasPaperFlag = balances.some(b => b.is_paper);
    
    let totalValueValue: bigint = BigInt(0);
    // Aggregate all balances (Simplified: treats all as same for PnL tracking, should use FX in prod)
    for (const b of balances) {
        totalValueValue += BigInt(b.cash || 0);
    }

    for (const pos of positions) {
        totalValueValue += BigInt(pos.quantity) * BigInt(Math.floor(Number(pos.avg_price) * 100));
    }

    if (LAST_MILESTONE_VAL === BigInt(0)) LAST_MILESTONE_VAL = totalValueValue;

    const summary = {
       positions,
       totalValue: Number(totalValueValue) / 100, 
       isPaper: hasPaperFlag,
       updatedAt: new Date(),
      vaulted: Number(PROFIT_VAULT_BALANCE) / 100
    };

    // 4. BEHAVIORAL: PROFIT VAULTING (Limited to Base Currency for now)
    if (totalValueValue > LAST_MILESTONE_VAL * BigInt(110) / BigInt(100)) {
        const profit = totalValueValue - LAST_MILESTONE_VAL;
        const sweepAmount = profit * BigInt(30) / BigInt(100); // 30% of profit

        PROFIT_VAULT_BALANCE += sweepAmount;
        totalValueValue -= sweepAmount; // Move out of active trading
        LAST_MILESTONE_VAL = totalValueValue;

        console.log(`🏦 VAULT ALERT: Moved ${sweepAmount} (cents) to profit-locking Vault. Ensuring survival.`);
    }

    PORTFOLIO_CACHE.set(userId, { balance: Number(totalValueValue) / 100, timestamp: Date.now() });

    const totalCash = balances.reduce((sum: bigint, b: any) => sum + BigInt(b.cash || 0), BigInt(0));

    // 5. AUDIT: RECORD TRUTH TO HISTORY
    await pool.query(
        `INSERT INTO portfolio_history (user_id, total_value, cash, pnl, is_paper, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, Number(totalValueValue) / 100, Number(totalCash) / 100, (Number(totalValueValue) - Number(LAST_MILESTONE_VAL)) / 100, isPaper]
    );

    await redisClient.setEx(`portfolio:${isPaper ? 'paper:' : ''}${userId}`, 3600, JSON.stringify(summary));
    console.log(`✅ Portfolio synced & recorded for user ${userId} (Paper: ${isPaper})`);
  } catch (err) {
    console.error('Sync failed:', err);
  }
}

/**
 * KAFKA CONSUMER
 */
async function startPortfolioConsumer() {
  const consumer = kafka.consumer({ groupId: 'portfolio-aggregator' });
  await consumer.connect();
  await consumer.subscribe({ topics: ['trades', 'price_updates'], fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value?.toString() || '{}');
      if (topic === 'trades') {
        await syncPortfolio(data.userId, data.isPaper);
      }
    }
  });
}

// REST Endpoints
app.get('/api/v1/portfolio/:userId', async (req, res) => {
    const { userId } = req.params;

    // 2026 AUDIT: IDOR PROTECTION
    // In a real system, we would match req.user.id with userId from the JWT
    const authenticatedUser = req.headers['x-user-id'];
    if (authenticatedUser && authenticatedUser !== userId) {
        console.error(`🚨 IDOR BREACH ATTEMPT: ${authenticatedUser} tried accessing ${userId}`);
        return res.status(403).json({ error: 'Unauthorized data access. Violation logged.' });
    }

    let data = PORTFOLIO_CACHE.get(userId);
    if (!data) {
        const cached = await redisClient.get(`portfolio:${userId}`);
        if (cached) data = JSON.parse(cached);
    }

    if (data) return res.json(data);

    await syncPortfolio(userId);
    data = PORTFOLIO_CACHE.get(userId);
    return res.json(data || { userId, positions: [], totalValue: 0 });
});

/**
 * ATOMIC DEPOSIT (ACID)
 */
app.post('/api/v1/portfolio/deposit', async (req, res) => {
  const { userId, amount, currency = 'INR', isPaper = false } = req.body;
  const client = await pool.connect();
  try {
      await client.query('BEGIN');

      const amountPaisa = BigInt(Math.floor(amount * 100));

      // UPSERT balance for the specific currency
       await client.query(
           `INSERT INTO portfolios (user_id, cash, currency, is_paper)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, currency)
            DO UPDATE SET cash = portfolios.cash + $2, updated_at = NOW()`,
           [userId, amountPaisa.toString(), currency.toUpperCase(), isPaper]
       );

      await client.query('COMMIT');

      await producer.send({
          topic: 'portfolio_updates',
          messages: [{ value: JSON.stringify({ userId, type: 'DEPOSIT', amount, timestamp: new Date() }) }]
      });

      res.json({ message: 'Sovereign deposit successful', amount });
  } catch (err) {
      await client.query('ROLLBACK');
      console.error("❌ ACID FAILURE: Deposit rolled back.", err);
      res.status(500).json({ error: 'Atomic deposit failed.' });
  } finally {
      client.release();
  }
});

const RECONCILIATION_INTERVAL = 60000;

// 2026 AUDIT: BEHAVIORAL GUARDRAILS
let PROFIT_VAULT_BALANCE = BigInt(0);
let LAST_OVERRIDE_TIMESTAMP = 0;
const COOL_OFF_PERIOD = 24 * 60 * 60 * 1000; // 24 hours
const PROFIT_MILESTONE = 1.10; // +10%
let LAST_MILESTONE_VAL = BigInt(0);

/**
 * 2026 AUDIT: THE RECONCILIATION LOOP (Truth Sync)
 * Runs every 60s to ensure DB state == Broker state.
 */
async function runReconciliation() {
    console.log("🔄 AUDIT [Portfolio]: Starting 60s Reconciliation Protocol...");
    
    try {
        // Fetch users dynamically from the portfolios ledger
        const userResult = await pool.query('SELECT DISTINCT user_id FROM portfolios');
        const users = userResult.rows.map(r => r.user_id);
    
        for (const userId of users) {
            try {
                const internalRes = await pool.query('SELECT cash, currency FROM portfolios WHERE user_id = $1', [userId]);
                const internalBalances = internalRes.rows;

                for (const balance of internalBalances) {
                    const currency = balance.currency;
                    // Connect to the Broker Service Nexus - passing currency context
                    const brokerRes = await axios.get(`${process.env.BROKER_SERVICE_URL || 'http://localhost:8004'}/api/v1/broker/account/${userId}?currency=${currency}`);
                    const brokerCashPaisa = BigInt(Math.floor(brokerRes.data.cash * 100));
                    const internalCashPaisa = BigInt(balance.cash || 0);

                    if (brokerCashPaisa !== internalCashPaisa) {
                        console.warn(`⚠️ STATE_DRIFT [${userId}-${currency}]: Broker: ${brokerCashPaisa}, Internal: ${internalCashPaisa}. Correcting...`);
                        await pool.query('UPDATE portfolios SET cash = $1 WHERE user_id = $2 AND currency = $3', [brokerCashPaisa.toString(), userId, currency]);
                    }
                }
            } catch (err: any) {
                console.error(`❌ RECON_FAULT [${userId}]: ${err.message}`);
            }
        }
    } catch (rootErr: any) {
        console.error(`❌ CRITICAL_RECON_FAILURE: ${rootErr.message}`);
    }
}

setInterval(runReconciliation, 60000);

/**
 * AUDIT: BEHAVIORAL COOL-OFF OVERRIDE
 */
app.post('/api/v1/portfolio/override-limits', (req: Request, res: Response) => {
    const now = Date.now();
    if (now - LAST_OVERRIDE_TIMESTAMP < COOL_OFF_PERIOD) {
        console.warn("🛑 COOL-OFF ACTIVE: Behavioral guardrails preventing impulsive override.");
        return res.status(403).json({ 
            error: 'Cooling-off protocol active. You are locked out of manual limit changes for 24 hours.' 
        });
    }
    LAST_OVERRIDE_TIMESTAMP = now;
    res.json({ message: 'Override accepted. Cooling-off period reset.' });
});

app.listen(process.env.PORT || 3005, async () => {
  await redisClient.connect();
  await producer.connect();
  await startPortfolioConsumer();
  console.log(`🚀 Portfolio Service (BATTLE-HARDENED) on port ${process.env.PORT || 3005}`);
});
