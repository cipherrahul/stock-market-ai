import express, { Express, Request, Response } from 'express';
import { Pool, PoolClient } from 'pg';
import axios from 'axios';
import dotenv from 'dotenv';
import { Kafka } from 'kafkajs';

dotenv.config();

const app: Express = express();
app.use(express.json());

// Database
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'trading_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'trading_platform',
});

// Kafka for events
const kafka = new Kafka({
  clientId: 'trading-engine-advanced',
  brokers: [(process.env.KAFKA_BROKER || 'localhost:9092')],
});

interface ExecutionResult {
  orderId: string;
  status: 'executed' | 'failed' | 'partial';
  executedPrice: number;
  executedQuantity: number;
  slippage: number;
  slippagePercent: number;
  brokerOrderId: string;
  transactionId: string;
}

/**
 * SLIPPAGE CALCULATION MODEL
 */
class SlippageCalculator {
  /**
   * Calculate realistic slippage based on:
   * - Market volatility
   * - Bid-ask spread
   * - Order size vs average volume
   * - Time of day
   */
  static calculateSlippage(params: {
    symbol: string;
    quantity: number;
    requestedPrice: number;
    volatility: number;
    avgVolume: number;
    side: 'BUY' | 'SELL';
  }): number {
    const { symbol, quantity, requestedPrice, volatility, avgVolume, side } = params;

    // Base slippage: bid-ask spread (0.02-0.05% for stocks)
    let baseSlippage = requestedPrice * 0.0003;

    // Volatility adjustment (+0.01-0.05% per volatility unit)
    const volatilityAdjustment = (volatility * requestedPrice * 0.01);

    // Order size adjustment
    const orderValueRatio = (quantity * requestedPrice) / (avgVolume * requestedPrice);
    const sizeAdjustment = Math.max(0, orderValueRatio - 0.1) * 0.0005 * requestedPrice;

    // Combine
    let totalSlippage = baseSlippage + volatilityAdjustment + sizeAdjustment;

    // Apply direction
    if (side === 'BUY') {
      return requestedPrice + totalSlippage; // Worse price for buyers
    } else {
      return requestedPrice - totalSlippage; // Worse price for sellers
    }
  }
}

/**
 * TRADE EXECUTION WITH TRANSACTION SAFETY
 */
async function executeTradeWithSafety(
  client: PoolClient,
  userId: string,
  symbol: string,
  quantity: number,
  requestedPrice: number,
  side: 'BUY' | 'SELL'
): Promise<ExecutionResult> {
  const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Step 1: Fetch market volatility
    const volatilityResult = await client.query(
      `SELECT 
        AVG(volume) as avg_volume,
        STDDEV(price) / AVG(price) as volatility
       FROM market_history 
       WHERE symbol = $1 
       AND time > NOW() - INTERVAL '30 days'`,
      [symbol]
    );

    const volatility = volatilityResult.rows[0]?.volatility || 0.02;
    const avgVolume = volatilityResult.rows[0]?.avg_volume || 1000000;

    // Step 2: Calculate slippage
    const executedPrice = SlippageCalculator.calculateSlippage({
      symbol,
      quantity,
      requestedPrice,
      volatility,
      avgVolume,
      side,
    });

    const slippage = Math.abs(executedPrice - requestedPrice);
    const slippagePercent = (slippage / requestedPrice) * 100;

    console.log(`📊 Slippage calculated: ${slippagePercent.toFixed(4)}%`);

    // Step 3: Create order record (PENDING state)
    const orderResult = await client.query(
      `INSERT INTO orders 
       (user_id, symbol, quantity, price, requested_price, side, status, slippage, transaction_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id`,
      [userId, symbol, quantity, executedPrice, requestedPrice, side, 'PENDING', slippage, transactionId]
    );

    const orderId = orderResult.rows[0].id;

    // Step 4: Validate risk before broker execution
    const riskValidation = await validateRiskLimits(client, userId, {
      symbol,
      quantity,
      price: executedPrice,
      side,
    });

    if (!riskValidation.allowed) {
      await client.query(
        `UPDATE orders SET status = $1, error_reason = $2 WHERE id = $3`,
        ['FAILED', riskValidation.reason, orderId]
      );

      throw new Error(`Risk validation failed: ${riskValidation.reason}`);
    }

    // Step 5: Call broker API (with retry logic)
    const brokerResponse = await executeWithBrokerRetry(
      symbol,
      quantity,
      executedPrice,
      side,
      3 // max retries
    );

    if (!brokerResponse.success) {
      // ROLLBACK: Update order status
      await client.query(
        `UPDATE orders SET status = $1, error_reason = $2 WHERE id = $3`,
        ['FAILED', brokerResponse.error, orderId]
      );

      throw new Error(`Broker execution failed: ${brokerResponse.error}`);
    }

    // Step 6: Update position (atomic transaction)
    await updatePosition(
      client,
      userId,
      symbol,
      quantity,
      executedPrice,
      side
    );

    // Step 7: Finalize order
    await client.query(
      `UPDATE orders 
       SET status = $1, executed_price = $2, broker_order_id = $3, executed_at = NOW()
       WHERE id = $4`,
      ['EXECUTED', executedPrice, brokerResponse.brokerId, orderId]
    );

    // Step 8: Record to trading history
    await client.query(
      `INSERT INTO trading_history 
       (user_id, symbol, entry_date, entry_price, quantity, side, status)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6)`,
      [userId, symbol, executedPrice, quantity, side, 'OPEN']
    );

    console.log(`✅ Trade executed: ${transactionId}`);

    return {
      orderId,
      status: 'executed',
      executedPrice,
      executedQuantity: quantity,
      slippage,
      slippagePercent,
      brokerOrderId: brokerResponse.brokerId,
      transactionId,
    };
  } catch (error: any) {
    console.error(`❌ Trade failed: ${transactionId}`, error.message);
    throw error;
  }
}

/**
 * Validate Risk Limits
 */
async function validateRiskLimits(
  client: PoolClient,
  userId: string,
  orderData: { symbol: string; quantity: number; price: number; side: string }
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const user = await client.query('SELECT preferences FROM users WHERE id = $1', [userId]);

    if (user.rows.length === 0) {
      return { allowed: false, reason: 'User not found' };
    }

    const settings = user.rows[0].preferences?.risk_settings || {};
    const orderValue = orderData.quantity * orderData.price;

    // Check max position size
    if (settings.max_position_size && orderValue > settings.max_position_size) {
      return { allowed: false, reason: 'Exceeds max position size' };
    }

    // Check daily loss limit
    if (settings.max_daily_loss) {
      const dailyResult = await client.query(
        `SELECT SUM(pl_amount) as daily_loss FROM trading_history 
         WHERE user_id = $1 AND exit_date >= CURRENT_DATE`,
        [userId]
      );
      const dailyLoss = Math.abs(dailyResult.rows[0]?.daily_loss || 0);
      if (dailyLoss > settings.max_daily_loss) {
        return { allowed: false, reason: 'Daily loss limit exceeded' };
      }
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'Risk validation error' };
  }
}

/**
 * Broker Execution with Retry Logic
 */
async function executeWithBrokerRetry(
  symbol: string,
  quantity: number,
  price: number,
  side: string,
  maxRetries: number
): Promise<{ success: boolean; brokerId?: string; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        `${process.env.BROKER_SERVICE_URL}/api/v1/broker/execute`,
        { symbol, quantity, price, side },
        { timeout: 10000 }
      );

      if (response.data.success) {
        return {
          success: true,
          brokerId: response.data.orderId,
        };
      }
    } catch (error) {
      console.warn(`Broker attempt ${attempt}/${maxRetries} failed`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  return {
    success: false,
    error: 'Broker execution failed after retries',
  };
}

/**
 * Update Position Atomically
 */
async function updatePosition(
  client: PoolClient,
  userId: string,
  symbol: string,
  quantity: number,
  price: number,
  side: 'BUY' | 'SELL'
): Promise<void> {
  const position = await client.query(
    `SELECT * FROM positions WHERE user_id = $1 AND symbol = $2`,
    [userId, symbol]
  );

  if (position.rows.length === 0) {
    // New position
    await client.query(
      `INSERT INTO positions (user_id, symbol, quantity, avg_cost, current_price, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [userId, symbol, side === 'BUY' ? quantity : -quantity, price, price]
    );
  } else {
    // Update existing
    const currentPos = position.rows[0];
    const qualityMultiplier = (currentPos.quantity * currentPos.avg_cost + 
                               (side === 'BUY' ? quantity : -quantity) * price) / 
                              (currentPos.quantity + (side === 'BUY' ? quantity : -quantity));

    await client.query(
      `UPDATE positions 
       SET quantity = quantity + $1, avg_cost = $2, current_price = $3, updated_at = NOW()
       WHERE user_id = $4 AND symbol = $5`,
      [side === 'BUY' ? quantity : -quantity, qualityMultiplier, price, userId, symbol]
    );
  }
}

/**
 * API: Execute Trade
 */
app.post('/api/v1/trading/execute', async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { userId, symbol, quantity, side, price } = req.body;

    const result = await executeTradeWithSafety(
      client,
      userId,
      symbol,
      quantity,
      price,
      side
    );

    await client.query('COMMIT');

    res.json(result);
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Trade execution error:', error);
    res.status(500).json({ error: error.message, status: 'failed' });
  } finally {
    client.release();
  }
});

/**
 * API: Get Order Details with Execution Quality
 */
app.get('/api/v1/trading/order/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const result = await pool.query(
      `SELECT *, 
        (executed_price - requested_price) / requested_price * 100 as actual_slippage_percent
       FROM orders 
       WHERE id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * Health Check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    service: 'trading-engine-service-advanced',
    features: ['slippage-calculation', 'transaction-safety', 'risk-validation'],
  });
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`\n⚡ ADVANCED Trading Engine Service`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`✅ Slippage calculation: ACTIVE`);
  console.log(`✅ Transaction safety: ACTIVE`);
  console.log(`✅ Risk validation: ACTIVE`);
  console.log(`✅ Broker retry logic: ACTIVE\n`);
});
