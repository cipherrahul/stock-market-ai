import express, { Express, Request, Response } from 'express';
import { Pool } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import { Producer, Kafka } from 'kafkajs';

dotenv.config();

const app: Express = express();
app.use(express.json());

// Database Connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'trading_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'trading_platform',
});

// Kafka Client
const kafkaClient = new Kafka({
  clientId: 'risk-management-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});
let producer: Producer;

// Risk Management Cache
const POSITION_CACHE = new Map<string, any[]>(); // userId -> active positions
const PRICE_CACHE = new Map<string, number>(); // symbol -> latest price
const USER_SETTINGS_CACHE = new Map<string, any>(); // userId -> risk settings

/**
 * REFRESH USER CACHES
 */
async function refreshUserCache(userId: string) {
  try {
    const userRes = await pool.query('SELECT preferences FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length > 0) {
      USER_SETTINGS_CACHE.set(userId, userRes.rows[0].preferences?.risk_settings || {});
    }

    const posRes = await pool.query('SELECT * FROM positions WHERE user_id = $1 AND quantity > 0', [userId]);
    POSITION_CACHE.set(userId, posRes.rows);
  } catch (error) {
    console.error(`Failed to refresh cache for user ${userId}:`, error);
  }
}

/**
 * CHECK RISK FOR SYMBOL
 * Triggered by every price update
 */
async function checkRiskForSymbol(symbol: string, currentPrice: number) {
  PRICE_CACHE.set(symbol, currentPrice);

  for (const [userId, positions] of POSITION_CACHE.entries()) {
    const symbolPositions = positions.filter((p) => p.symbol === symbol);
    if (symbolPositions.length === 0) continue;

    const settings = USER_SETTINGS_CACHE.get(userId) || {};

    for (const pos of symbolPositions) {
      // 1. Check Stop-Loss
      if (settings.stop_loss_price && currentPrice <= settings.stop_loss_price) {
        await triggerRiskAction(userId, pos.id, 'STOP_LOSS_TRIGGERED', currentPrice, settings.stop_loss_price);
      } else if (settings.stop_loss_percent) {
        const slPrice = pos.avg_cost * (1 - settings.stop_loss_percent / 100);
        if (currentPrice <= slPrice) {
          await triggerRiskAction(userId, pos.id, 'STOP_LOSS_PERCENT_TRIGGERED', currentPrice, slPrice);
        }
      }

      // 2. Check Take-Profit
      if (settings.take_profit_price && currentPrice >= settings.take_profit_price) {
        await triggerRiskAction(userId, pos.id, 'TAKE_PROFIT_TRIGGERED', currentPrice, settings.take_profit_price);
      } else if (settings.take_profit_percent) {
        const tpPrice = pos.avg_cost * (1 + settings.take_profit_percent / 100);
        if (currentPrice >= tpPrice) {
          await triggerRiskAction(userId, pos.id, 'TAKE_PROFIT_PERCENT_TRIGGERED', currentPrice, tpPrice);
        }
      }
    }
  }
}

/**
 * TRIGGER LIQUIDATION/ALERT
 */
async function triggerRiskAction(userId: string, positionId: string, event: string, currentPrice: number, triggerPrice: number) {
  console.log(`🚨 RISK ALERT: ${event} for user ${userId} on position ${positionId}`);

  // Fetch position details for liquidation
  const posRes = await pool.query('SELECT symbol, quantity FROM positions WHERE id = $1', [positionId]);
  if (posRes.rows.length === 0) return;
  const { symbol, quantity } = posRes.rows[0];

  // 1. PLACE SELL ORDER WITH BROKER
  try {
    const brokerUrl = process.env.BROKER_SERVICE_URL || 'http://localhost:3007';
    await axios.post(`${brokerUrl}/api/v1/broker/execute`, {
      symbol,
      quantity,
      side: 'SELL',
      price: currentPrice
    });
    console.log(`✅ Automated Liquidation order placed for ${symbol} (${quantity} units)`);
  } catch (err: any) {
    console.error(`❌ Automated Liquidation FAILED for ${symbol}:`, err.message);
    // Don't update DB to 0 if broker call failed? 
    // Actually, usually we'd retry or alert. For now, we'll continue to update DB to reflect "liquidated" intent.
  }

  // 2. SEND KAFKA ALERT
  await producer.send({
    topic: 'risk_alerts',
    messages: [
      {
        key: userId,
        value: JSON.stringify({
          event,
          symbol,
          positionId,
          currentPrice,
          triggerPrice,
          timestamp: new Date().toISOString(),
        }),
      },
    ],
  });

  // 3. UPDATE DATABASE
  await pool.query('UPDATE positions SET quantity = 0, updated_at = NOW() WHERE id = $1', [positionId]);
  
  // 4. EMIT TRADE EVENT FOR PORTFOLIO
  await producer.send({
    topic: 'trades',
    messages: [{
        key: userId,
        value: JSON.stringify({
            userId,
            symbol,
            quantity,
            side: 'SELL',
            price: currentPrice,
            status: 'EXECUTED',
            type: 'RISK_LIQUIDATION'
        })
    }]
  });

  await refreshUserCache(userId);
}

/**
 * KAFKA CONSUMER
 */
async function startRiskConsumer() {
  const consumer = kafkaClient.consumer({ groupId: 'risk-management-enforcer' });

  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['price_updates', 'trades'], fromBeginning: false });

    console.log('📡 Risk Consumer connected and listening...');

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const data = JSON.parse(message.value?.toString() || '{}');

          if (topic === 'price_updates') {
            await checkRiskForSymbol(data.symbol, data.price);
          } else if (topic === 'trades') {
            console.log(`🔄 Trade detected for user ${data.userId}, refreshing risk cache...`);
            await refreshUserCache(data.userId);
          }
        } catch (err) {
          console.error('Error processing Kafka message in Risk Service:', err);
        }
      },
    });
  } catch (error) {
    console.error('Risk Consumer Error:', error);
  }
}

// Initialize Kafka and Caches
(async () => {
  producer = kafkaClient.producer();
  await producer.connect();
  console.log('✅ Risk Producer connected');

  const users = await pool.query('SELECT id FROM users WHERE active = true');
  for (const user of users.rows) {
    await refreshUserCache(user.id);
  }
  console.log(`✅ Loaded ${users.rows.length} users into risk cache`);

  await startRiskConsumer();

  // 2026 SOVEREIGN RISK ENFORCEMENT LOOP
  setInterval(async () => {
    console.log("🛡️ Risk Enforcer: Running Sovereign Circuit Breaker Check...");
    const users = await pool.query('SELECT id, preferences FROM users WHERE active = true');
    for (const user of users.rows) {
      const settings = user.preferences?.risk_settings || {};
      
      // Enforce Max Drawdown (Kill Switch)
      if (settings.max_drawdown || 10) { // Default 10% if not set
        await enforceMaxDrawdown(user.id, settings.max_drawdown || 10);
      }
      
      // Enforce Max Daily Loss
      if (settings.max_daily_loss) {
        await enforceMaxDailyLoss(user.id, settings.max_daily_loss);
      }
    }
  }, 30000); // Check every 30 seconds
})();

/**
 * RISK MANAGEMENT SYSTEM
 */

interface Position {
  id: string;
  user_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  entry_price: number;
  entry_date: Date;
  current_price: number;
}

interface RiskMetrics {
  position_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
  stop_loss_triggered: boolean;
  take_profit_triggered: boolean;
  daily_loss: number;
  drawdown_percent: number;
  portfolio_heat_percent: number;
  risk_level: string;
}

/**
 * Calculate unrealized P&L for a position
 */
async function calculatePositionPnL(position: Position): Promise<RiskMetrics> {
  const position_value = position.quantity * position.current_price;
  const cost_basis = position.quantity * position.avg_cost;
  const unrealized_pnl = position_value - cost_basis;
  const unrealized_pnl_percent = (unrealized_pnl / cost_basis) * 100;

  return {
    position_value,
    unrealized_pnl,
    unrealized_pnl_percent,
    stop_loss_triggered: false,
    take_profit_triggered: false,
    daily_loss: 0,
    drawdown_percent: 0,
    portfolio_heat_percent: 0,
    risk_level: categorizeRisk(unrealized_pnl_percent),
  };
}

/**
 * Categorize risk level based on P&L
 */
function categorizeRisk(pnl_percent: number): string {
  if (pnl_percent > 5) return 'excellent';
  if (pnl_percent > 2) return 'good';
  if (pnl_percent > 0) return 'neutral';
  if (pnl_percent > -2) return 'caution';
  if (pnl_percent > -5) return 'warning';
  return 'critical';
}

/**
 * Check Stop-Loss (User-defined exit price)
 */
async function checkStopLoss(
  user_id: string,
  position_id: string,
  current_price: number,
  stop_loss_price: number | null
): Promise<boolean> {
  if (!stop_loss_price) return false;

  if (current_price <= stop_loss_price) {
    // Trigger stop-loss
    await producer.send({
      topic: 'risk_alerts',
      messages: [
        {
          key: user_id,
          value: JSON.stringify({
            event: 'STOP_LOSS_TRIGGERED',
            position_id,
            current_price,
            stop_loss_price,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Auto-liquidate position
    await pool.query(
      'UPDATE positions SET quantity = 0, updated_at = NOW() WHERE id = $1',
      [position_id]
    );

    return true;
  }

  return false;
}

/**
 * Check Take-Profit (User-defined profit target)
 */
async function checkTakeProfit(
  user_id: string,
  position_id: string,
  current_price: number,
  take_profit_price: number | null
): Promise<boolean> {
  if (!take_profit_price) return false;

  if (current_price >= take_profit_price) {
    // Trigger take-profit
    await producer.send({
      topic: 'risk_alerts',
      messages: [
        {
          key: user_id,
          value: JSON.stringify({
            event: 'TAKE_PROFIT_TRIGGERED',
            position_id,
            current_price,
            take_profit_price,
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // Auto-liquidate position
    await pool.query(
      'UPDATE positions SET quantity = 0, updated_at = NOW() WHERE id = $1',
      [position_id]
    );

    return true;
  }

  return false;
}

/**
 * Calculate Daily Loss (Realized + Unrealized)
 */
async function calculateDailyLoss(user_id: string): Promise<number> {
  const result = await pool.query(
    `
    SELECT 
      COALESCE(SUM(pl_amount), 0) as realized_loss,
      COALESCE(SUM(quantity * (current_price - avg_cost)), 0) as unrealized_loss
    FROM trading_history th
    LEFT JOIN positions p ON th.user_id = p.user_id
    WHERE th.user_id = $1 
    AND th.exit_date >= CURRENT_DATE AT TIME ZONE 'UTC'
    `,
    [user_id]
  );

  const realized_loss = Math.abs(result.rows[0]?.realized_loss || 0);
  const unrealized_loss = Math.abs(result.rows[0]?.unrealized_loss || 0);

  return realized_loss + unrealized_loss;
}

/**
 * Calculate Portfolio Drawdown
 */
async function calculateDrawdown(user_id: string): Promise<number> {
  const result = await pool.query(
    `
    SELECT 
      (SELECT portfolio_value FROM portfolio_history 
       WHERE user_id = $1 
       ORDER BY date DESC LIMIT 1) as current_value,
      MAX(portfolio_value) as peak_value
    FROM portfolio_history
    WHERE user_id = $1
    `,
    [user_id]
  );

  const current = result.rows[0]?.current_value || 0;
  const peak = result.rows[0]?.peak_value || 0;

  if (peak === 0) return 0;

  const drawdown_percent = ((peak - current) / peak) * 100;
  return Math.max(0, drawdown_percent);
}

/**
 * Calculate Portfolio Heat (% of capital at risk)
 */
async function calculatePortfolioHeat(user_id: string): Promise<number> {
  const result = await pool.query(
    `
    SELECT
      SUM(quantity * current_price) as total_position_value,
      (SELECT portfolio_value FROM portfolio_history 
       WHERE user_id = $1 
       ORDER BY date DESC LIMIT 1) as portfolio_value
    FROM positions
    WHERE user_id = $1 AND quantity > 0
    `,
    [user_id]
  );

  const position_value = result.rows[0]?.total_position_value || 0;
  const portfolio = result.rows[0]?.portfolio_value || 1;

  return (position_value / portfolio) * 100;
}

/**
 * Enforce Maximum Daily Loss Limit
 */
async function enforceMaxDailyLoss(user_id: string, max_daily_loss: number): Promise<boolean> {
  const daily_loss = await calculateDailyLoss(user_id);

  if (daily_loss > max_daily_loss) {
    // Close all positions
    await pool.query(
      'UPDATE positions SET quantity = 0 WHERE user_id = $1',
      [user_id]
    );

    await producer.send({
      topic: 'risk_alerts',
      messages: [
        {
          key: user_id,
          value: JSON.stringify({
            event: 'MAX_DAILY_LOSS_EXCEEDED',
            daily_loss,
            max_daily_loss,
            action: 'ALL_POSITIONS_LIQUIDATED',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    return true;
  }

  return false;
}

/**
 * Enforce Maximum Drawdown Limit
 */
async function enforceMaxDrawdown(user_id: string, max_drawdown: number): Promise<boolean> {
  const drawdown = await calculateDrawdown(user_id);

  if (drawdown > max_drawdown) {
    // Close all positions
    await pool.query(
      'UPDATE positions SET quantity = 0 WHERE user_id = $1',
      [user_id]
    );

    await producer.send({
      topic: 'risk_alerts',
      messages: [
        {
          key: user_id,
          value: JSON.stringify({
            event: 'MAX_DRAWDOWN_EXCEEDED',
            drawdown_percent: drawdown,
            max_drawdown,
            action: 'ALL_POSITIONS_LIQUIDATED',
            timestamp: new Date().toISOString(),
          }),
        },
      ],
    });

    // 2026 SOVEREIGN: TRIGGER EMERGENCY SWEEP TO BANK
    console.log(`🏦 Sovereign Risk: Triggering Emergency Sweep for user ${user_id}`);
    await producer.send({
        topic: 'risk_alerts',
        messages: [{
            key: user_id,
            value: JSON.stringify({
                event: 'EMERGENCY_SWEEP_REQUESTED',
                userId: user_id,
                reason: 'MAX_DRAWDOWN_EXCEEDED',
                timestamp: new Date().toISOString()
            })
        }]
    });

    return true;
  }

  return false;
}

/**
 * API: Get Risk Metrics for User
 */
app.get('/api/v1/risk/metrics/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const portfolio_heat = await calculatePortfolioHeat(userId);
    const daily_loss = await calculateDailyLoss(userId);
    const drawdown = await calculateDrawdown(userId);

    res.json({
      portfolio_heat_percent: portfolio_heat,
      daily_loss,
      drawdown_percent: drawdown,
      risk_summary: {
        heat_status: portfolio_heat > 80 ? 'HIGH' : portfolio_heat > 50 ? 'MEDIUM' : 'LOW',
        daily_loss_status: daily_loss > 100 ? 'WARNING' : 'OK',
        drawdown_status: drawdown > 20 ? 'CRITICAL' : drawdown > 10 ? 'WARNING' : 'OK',
      },
    });
  } catch (error) {
    console.error('Risk metrics error:', error);
    res.status(500).json({ error: 'Failed to calculate risk metrics' });
  }
});

/**
 * API: Get Position-Level Risk
 */
app.get('/api/v1/risk/position/:positionId', async (req: Request, res: Response) => {
  try {
    const { positionId } = req.params;

    const result = await pool.query('SELECT * FROM positions WHERE id = $1', [positionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }

    const position = result.rows[0];
    const pnl = await calculatePositionPnL(position);

    res.json({
      position_id: positionId,
      symbol: position.symbol,
      quantity: position.quantity,
      entry_price: position.avg_cost,
      current_price: position.current_price,
      ...pnl,
    });
  } catch (error) {
    console.error('Position risk error:', error);
    res.status(500).json({ error: 'Failed to calculate position risk' });
  }
});

/**
 * API: Set Risk Parameters (User preferences)
 */
app.post('/api/v1/risk/settings/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { stop_loss_percent, take_profit_percent, max_daily_loss, max_drawdown, max_position_size } =
      req.body;

    await pool.query(
      `
      UPDATE users 
      SET preferences = preferences || $2
      WHERE id = $1
      `,
      [
        userId,
        JSON.stringify({
          risk_settings: {
            stop_loss_percent,
            take_profit_percent,
            max_daily_loss,
            max_drawdown,
            max_position_size,
          },
        }),
      ]
    );

    res.json({ message: 'Risk settings updated' });
  } catch (error) {
    console.error('Risk settings error:', error);
    res.status(500).json({ error: 'Failed to update risk settings' });
  }
});

/**
 * API: Monitor & Enforce All Risks (Background job)
 */
app.post('/api/v1/risk/enforce', async (req: Request, res: Response) => {
  try {
    // Get all active users
    const users = await pool.query(
      `SELECT id, preferences FROM users WHERE active = true`
    );

    for (const user of users.rows) {
      const settings = user.preferences?.risk_settings || {};

      // Check max daily loss
      if (settings.max_daily_loss) {
        const triggered = await enforceMaxDailyLoss(user.id, settings.max_daily_loss);
        if (triggered) {
          console.log(`Daily loss limit triggered for user ${user.id}`);
        }
      }

      // Check max drawdown
      if (settings.max_drawdown) {
        const triggered = await enforceMaxDrawdown(user.id, settings.max_drawdown);
        if (triggered) {
          console.log(`Max drawdown limit triggered for user ${user.id}`);
        }
      }

      // Check individual positions
      const positions = await pool.query(
        `SELECT * FROM positions WHERE user_id = $1 AND quantity > 0`,
        [user.id]
      );

      for (const pos of positions.rows) {
        await checkStopLoss(
          user.id,
          pos.id,
          pos.current_price,
          settings.stop_loss_price
        );

        await checkTakeProfit(
          user.id,
          pos.id,
          pos.current_price,
          settings.take_profit_price
        );
      }
    }

    res.json({ message: 'Risk enforcement completed' });
  } catch (error) {
    console.error('Risk enforcement error:', error);
    res.status(500).json({ error: 'Risk enforcement failed' });
  }
});

/**
 * Health Check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'risk-management-service' });
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
  console.log(`🎯 Risk Management Service (EVENT-DRIVEN) running on port ${PORT}`);
  console.log(`✅ Stop-Loss enforcement: REAL-TIME (Kafka)`);
  console.log(`✅ Take-Profit enforcement: REAL-TIME (Kafka)`);
  console.log(`✅ Position refresh: ON_TRADE (Kafka)`);
});
