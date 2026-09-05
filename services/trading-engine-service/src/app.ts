import * as crypto from 'crypto';
import express = require('express');
import type { NextFunction, Request, Response } from 'express';
import axios = require('axios');
import type { AxiosInstance } from 'axios';
import { IntradaySquareOffManager } from './IntradaySquareOffManager';

export interface TradingConfig {
  maxPositionSize: number;
  port: number;
  portfolioServiceUrl: string;
  brokerServiceUrl: string;
  serviceName: string;
  serviceVersion: string;
  requestTimeoutMs: number;
}

export interface TradingOrderPayload {
  userId?: string;
  symbol?: string;
  quantity?: number;
  side?: string;
  price?: number;
  orderVariant?: 'CNC' | 'MIS';
  stopLoss?: number;
  takeProfit?: number;
  memo?: string;
  isPaper?: boolean;
}

export interface TradingDependencies {
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
    end?: () => Promise<void>;
  };
  httpClient?: Pick<AxiosInstance, 'get' | 'post'>;
}

interface OrderContext {
  userId: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  price: number;
  orderVariant: 'CNC' | 'MIS';
  stopLoss?: number;
  takeProfit?: number;
  memo?: string;
  isPaper: boolean;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

function buildValidationError(message: string, requestId?: string) {
  return {
    error: message,
    errorCode: 'VALIDATION_ERROR',
    requestId,
  };
}

function normaliseOrder(body: TradingOrderPayload): OrderContext | null {
  const side = typeof body.side === 'string' ? body.side.toUpperCase() : '';
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim().toUpperCase() : '';
  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const quantity = Number(body.quantity);
  const price = Number(body.price);

  if (!userId || !symbol || !Number.isFinite(quantity) || !Number.isFinite(price)) {
    return null;
  }

  if (!Number.isInteger(quantity) || quantity <= 0 || price <= 0 || !['BUY', 'SELL'].includes(side)) {
    return null;
  }

  const orderVariant: 'CNC' | 'MIS' = body.orderVariant === 'MIS' ? 'MIS' : 'CNC';
  const stopLoss = typeof body.stopLoss === 'number' && body.stopLoss > 0 ? body.stopLoss : undefined;
  const takeProfit = typeof body.takeProfit === 'number' && body.takeProfit > 0 ? body.takeProfit : undefined;
  const memo = typeof body.memo === 'string' ? body.memo.trim() : undefined;
  const isPaper = Boolean(body.isPaper);

  return {
    userId,
    symbol,
    quantity,
    side: side as 'BUY' | 'SELL',
    price,
    orderVariant,
    stopLoss,
    takeProfit,
    memo,
    isPaper,
  };
}

export function createTradingEngineApp(config: TradingConfig, dependencies: TradingDependencies) {
  const app = express();
  const httpClient =
    dependencies.httpClient ||
    (axios as any).create({
      timeout: config.requestTimeoutMs,
      validateStatus: () => true,
    });

  // Initialize Intraday Square-Off Manager
  const squareOffManager = new IntradaySquareOffManager({
    db: dependencies.db,
    brokerServiceUrl: config.brokerServiceUrl,
    httpClient,
  });
  squareOffManager.startDaemon();

  // Run auto-migration for intraday columns to guarantee DB schema readiness
  dependencies.db.query(`
    ALTER TABLE orders 
    ADD COLUMN IF NOT EXISTS order_variant VARCHAR(10) DEFAULT 'CNC',
    ADD COLUMN IF NOT EXISTS stop_loss DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS take_profit DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS slippage DECIMAL(10, 4),
    ADD COLUMN IF NOT EXISTS is_paper BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS memo TEXT;
  `).catch((err: any) => console.warn('Schema check notice:', err.message));

  app.use(express.json({ limit: '1mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.post('/api/v1/trading/execute', async (req: Request, res: Response) => {
    const requestId = req.id;
    const order = normaliseOrder(req.body);

    if (!order) {
      return res.status(400).json(buildValidationError('Invalid trade payload', requestId));
    }

    const idempotencyKey = req.headers['idempotency-key'];
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return res.status(400).json(buildValidationError('Idempotency-Key header is required', requestId));
    }

    if (order.price * order.quantity > config.maxPositionSize) {
      return res.status(400).json({
        error: 'Position size exceeds configured limit',
        errorCode: 'RISK_LIMIT_EXCEEDED',
        requestId,
      });
    }

    try {
      const existingOrder = await dependencies.db.query(
        'SELECT id, broker_order_id, status FROM orders WHERE idempotency_key = $1 LIMIT 1',
        [idempotencyKey.trim()]
      );

      if (existingOrder.rows.length > 0) {
        const previous = existingOrder.rows[0];
        return res.status(200).json({
          orderId: previous.id,
          brokerOrderId: previous.broker_order_id,
          status: previous.status,
          duplicate: true,
          requestId,
        });
      }

      const portfolioResponse = await httpClient.get(
        `${config.portfolioServiceUrl}/api/v1/portfolio/${encodeURIComponent(order.userId)}`,
        {
          headers: {
            'x-request-id': requestId || '',
            'x-user-id': order.userId,
          },
        }
      );

      if (portfolioResponse.status >= 500) {
        return res.status(503).json({
          error: 'Portfolio service unavailable',
          errorCode: 'DEPENDENCY_UNAVAILABLE',
          requestId,
        });
      }

      if (portfolioResponse.status >= 400) {
        return res.status(400).json({
          error: 'Portfolio validation failed',
          errorCode: 'PORTFOLIO_VALIDATION_FAILED',
          requestId,
        });
      }

      const portfolio = portfolioResponse.data || {};
      const cashBalance = Number(portfolio.balance ?? portfolio.totalValue ?? 0);
      const position = Array.isArray(portfolio.positions)
        ? portfolio.positions.find((entry: any) => entry.symbol === order.symbol)
        : undefined;
      const heldQuantity = Number(position?.quantity ?? 0);

      // ROCKET PRECISION: Safe Decimal Multiplication (8 decimals)
      const orderValue = Math.round((order.price * order.quantity + Number.EPSILON) * 100000000) / 100000000;
      const precisionBalance = Math.round((cashBalance + Number.EPSILON) * 100000000) / 100000000;

      if (order.side === 'BUY' && precisionBalance < orderValue) {
        return res.status(400).json({
          error: 'Insufficient balance for trade',
          errorCode: 'INSUFFICIENT_BALANCE',
          requestId,
        });
      }

      // For Delivery (CNC) SELL orders, require heldQuantity >= quantity.
      // For Intraday Margin (MIS) SELL orders, short-selling is fully supported!
      if (order.side === 'SELL' && order.orderVariant === 'CNC' && heldQuantity < order.quantity) {
        return res.status(400).json({
          error: 'Insufficient holdings for delivery sell order',
          errorCode: 'INSUFFICIENT_HOLDINGS',
          requestId,
        });
      }

      const brokerResponse = await httpClient.post(
        `${config.brokerServiceUrl}/api/v1/broker/execute`,
        {
          userId: order.userId,
          symbol: order.symbol,
          quantity: order.quantity,
          side: order.side,
          price: order.price,
          orderVariant: order.orderVariant,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
          memo: order.memo,
          isPaper: order.isPaper,
          idempotencyKey: idempotencyKey, // Forward client UUID
          bid: (req.body as any).bid,
          ask: (req.body as any).ask,
        },
        {
          headers: {
            'x-request-id': requestId || '',
          },
        }
      );

      if (brokerResponse.status >= 500) {
        return res.status(503).json({
          error: 'Broker unavailable',
          errorCode: 'BROKER_UNAVAILABLE',
          requestId,
        });
      }

      if (brokerResponse.status >= 400) {
        return res.status(400).json({
          error: brokerResponse.data?.error || 'Broker rejected order',
          errorCode: 'BROKER_REJECTED',
          requestId,
        });
      }

      const insertResult = await dependencies.db.query(
        `INSERT INTO orders (
          user_id, symbol, quantity, side, price, status, broker_order_id, idempotency_key,
          order_variant, stop_loss, take_profit, memo, is_paper, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING id, status, broker_order_id`,
        [
          order.userId,
          order.symbol,
          order.quantity,
          order.side,
          order.price,
          'EXECUTED',
          brokerResponse.data?.orderId || null,
          idempotencyKey.trim(),
          order.orderVariant,
          order.stopLoss || null,
          order.takeProfit || null,
          order.memo || null,
          order.isPaper,
        ]
      );

      return res.status(201).json({
        orderId: insertResult.rows[0]?.id,
        brokerOrderId: insertResult.rows[0]?.broker_order_id,
        status: insertResult.rows[0]?.status || 'EXECUTED',
        orderVariant: order.orderVariant,
        side: order.side,
        symbol: order.symbol,
        quantity: order.quantity,
        price: order.price,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        requestId,
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Trade execution failed',
        errorCode: 'TRADE_EXECUTION_FAILED',
        requestId,
      });
    }
  });

  app.post('/api/v1/trading/kill-switch', async (req: Request, res: Response) => {
    const requestId = req.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json(buildValidationError('userId is required', requestId));
    }

    try {
      console.log(`☢️ [RISK_CONTROL] Global Kill Switch activated for user: ${userId}`);
      
      // 1. Fetch all 'EXECUTED' orders that might be open positions
      const result = await dependencies.db.query(
        'SELECT symbol, quantity, side FROM orders WHERE user_id = $1 AND status = \'EXECUTED\'',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({
          message: 'No active positions to liquidate',
          status: 'SUCCESS',
          requestId
        });
      }

      // 2. Execute Offset Orders (Liquidation)
      const liquidations = result.rows.map(async (pos) => {
        const offsetSide = pos.side === 'BUY' ? 'SELL' : 'BUY';
        
        // Log liquidation attempt
        console.log(`📡 [Liquidation] Offsetting ${pos.quantity} ${pos.symbol} (Side: ${offsetSide})`);
        
        return httpClient.post(
          `${config.brokerServiceUrl}/api/v1/broker/execute`,
          {
            userId,
            symbol: pos.symbol,
            quantity: pos.quantity,
            side: offsetSide,
            price: 0, // Market Price
            memo: 'GLOBAL_KILL_SWITCH_ACTIVE',
            idempotencyKey: crypto.randomUUID()
          },
          { headers: { 'x-request-id': requestId || '' } }
        );
      });

      await Promise.all(liquidations);

      // 3. Update all previous orders to 'CLOSED' (Simulated position management)
      await dependencies.db.query(
        'UPDATE orders SET status = \'CLOSED\', updated_at = NOW() WHERE user_id = $1 AND status = \'EXECUTED\'',
        [userId]
      );

      return res.status(200).json({
        message: 'Fleet-wide liquidation complete',
        positionsLiquidated: result.rows.length,
        status: 'SUCCESS',
        requestId
      });

    } catch (error) {
      console.error('❌ [Kill Switch] Fatal failure during liquidation:', error);
      return res.status(500).json({
        error: 'Global liquidation failed',
        errorCode: 'FATAL_RISK_FAILURE',
        requestId,
      });
    }
  });

  // ── Manual Emergency 1-Click Intraday Square-Off ──────────────────────────
  app.post('/api/v1/trading/square-off', async (req: Request, res: Response) => {
    const { userId, reason } = req.body;
    if (!userId) {
      return res.status(400).json(buildValidationError('userId is required', req.id));
    }
    try {
      const result = await squareOffManager.squareOffUserPositions(userId, reason || 'MANUAL_1CLICK_EMERGENCY');
      return res.status(200).json({ ...result, requestId: req.id });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Square-off failed', requestId: req.id });
    }
  });

  // ── Active Intraday (MIS) Positions for User ──────────────────────────────
  app.get('/api/v1/trading/intraday/positions/:userId', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query(`
        SELECT symbol,
               SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) AS net_quantity,
               AVG(price) AS avg_buy_price,
               COUNT(*) AS total_trades
        FROM orders
        WHERE user_id = $1 AND order_variant = 'MIS' AND status = 'EXECUTED'
        GROUP BY symbol
        HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) != 0
      `, [req.params.userId]);

      const positions = result.rows.map(r => ({
        symbol: r.symbol,
        quantity: Math.abs(Number(r.net_quantity)),
        side: Number(r.net_quantity) > 0 ? 'BUY' : 'SELL',
        avgBuyPrice: Number(r.avg_buy_price),
        orderVariant: 'MIS'
      }));

      return res.status(200).json({ positions, requestId: req.id });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to fetch intraday positions', requestId: req.id });
    }
  });

  // --- INSTITUTIONAL FLEET & INTELLIGENCE ENDPOINTS ---

  app.get('/api/v1/fleet/health', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query('SELECT service_name, status, latency_ms, last_ping FROM fleet_health');
      res.status(200).json({ services: result.rows, requestId: req.id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch fleet health', requestId: req.id });
    }
  });

  app.get('/api/v1/fleet/agents/:userId', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query(
        'SELECT id, name, strategy, status, allocation, pnl, trades_count FROM agents WHERE user_id = $1',
        [req.params.userId]
      );
      res.status(200).json({ agents: result.rows, requestId: req.id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch agents', requestId: req.id });
    }
  });

  app.get('/api/v1/intelligence/news', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query(
        'SELECT id, headline, source, impact, sentiment, correlation_symbol, published_at FROM news_feed ORDER BY published_at DESC LIMIT 20'
      );
      res.status(200).json({ news: result.rows, requestId: req.id });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch news feed', requestId: req.id });
    }
  });

  app.get('/api/v1/trading/orders/:userId', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query(
        `SELECT id, user_id, symbol, quantity, side, price, status, broker_order_id, created_at
         FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [req.params.userId]
      );

      res.status(200).json({
        orders: result.rows,
        requestId: req.id,
      });
    } catch {
      res.status(500).json({
        error: 'Failed to fetch orders',
        errorCode: 'ORDERS_FETCH_FAILED',
        requestId: req.id,
      });
    }
  });

  app.get('/api/v1/trading/orders/:orderId/status', async (req: Request, res: Response) => {
    try {
      const result = await dependencies.db.query(
        'SELECT id, status, broker_order_id, updated_at FROM orders WHERE id = $1 LIMIT 1',
        [req.params.orderId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Order not found',
          errorCode: 'ORDER_NOT_FOUND',
          requestId: req.id,
        });
      }

      return res.status(200).json({
        order: result.rows[0],
        requestId: req.id,
      });
    } catch {
      return res.status(500).json({
        error: 'Failed to fetch order status',
        errorCode: 'ORDER_STATUS_FAILED',
        requestId: req.id,
      });
    }
  });

  app.get('/health', async (req: Request, res: Response) => {
    try {
      await dependencies.db.query('SELECT 1');
      res.status(200).json({
        status: 'healthy',
        service: config.serviceName,
        version: config.serviceVersion,
        requestId: req.id,
      });
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        service: config.serviceName,
        requestId: req.id,
      });
    }
  });

  app.get('/ready', async (req: Request, res: Response) => {
    try {
      await dependencies.db.query('SELECT 1');
      res.status(200).json({
        status: 'ready',
        service: config.serviceName,
        requestId: req.id,
      });
    } catch {
      res.status(503).json({
        status: 'not_ready',
        service: config.serviceName,
        requestId: req.id,
      });
    }
  });

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Route not found',
      errorCode: 'NOT_FOUND',
      requestId: req.id,
    });
  });

  return app;
}
