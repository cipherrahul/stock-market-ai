import * as crypto from 'crypto';
import express = require('express');
import type { NextFunction, Request, Response } from 'express';

export interface PortfolioConfig {
  port: number;
  serviceName: string;
  serviceVersion: string;
  cacheTtlSeconds: number;
}

export interface PortfolioDependencies {
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
    connect?: () => Promise<{
      query: (sql: string, params?: unknown[]) => Promise<any>;
      release: () => void;
    }>;
    end?: () => Promise<void>;
  };
  cache?: {
    get: (key: string) => Promise<string | null>;
    setEx: (key: string, ttlSeconds: number, value: string) => Promise<unknown>;
    ping?: () => Promise<unknown>;
    quit?: () => Promise<unknown>;
    isOpen?: boolean;
  };
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
}

function toMoney(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

async function loadPortfolioSummary(
  deps: PortfolioDependencies,
  userId: string,
  isPaper: boolean
) {
  const positionsResult = await deps.db.query(
    `SELECT symbol,
            SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) AS quantity,
            AVG(price) AS avg_price
     FROM orders
     WHERE user_id = $1 AND COALESCE(is_paper, false) = $2 AND UPPER(status) = 'EXECUTED'
     GROUP BY symbol`,
    [userId, isPaper]
  );

  const balancesResult = await deps.db.query(
    `SELECT COALESCE(SUM(cash), 0) AS cash
     FROM portfolios
     WHERE user_id = $1 AND COALESCE(is_paper, false) = $2`,
    [userId, isPaper]
  );

  const positions = positionsResult.rows
    .map((row) => ({
      symbol: row.symbol,
      quantity: Number(row.quantity || 0),
      averagePrice: Number(row.avg_price || 0),
      marketValue: Number(row.quantity || 0) * Number(row.avg_price || 0),
    }))
    .filter((row) => row.quantity > 0);

  const cashBalance = toMoney(balancesResult.rows[0]?.cash);
  const investedValue = positions.reduce((sum, position) => sum + position.marketValue, 0);

  return {
    userId,
    isPaper,
    balance: cashBalance,
    cash: cashBalance,
    totalValue: cashBalance + investedValue,
    positions,
    updatedAt: new Date().toISOString(),
  };
}

export function createPortfolioApp(config: PortfolioConfig, deps: PortfolioDependencies) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    req.id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  app.get('/api/v1/portfolio/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const authenticatedUser = req.headers['x-user-id'];
    const isPaper = parseBoolean(req.query.paper, false);

    if (typeof authenticatedUser === 'string' && authenticatedUser !== userId) {
      return res.status(403).json({
        error: 'Unauthorized data access',
        errorCode: 'FORBIDDEN',
        requestId: req.id,
      });
    }

    const cacheKey = `portfolio:${isPaper ? 'paper:' : ''}${userId}`;

    try {
      if (deps.cache) {
        const cached = await deps.cache.get(cacheKey);
        if (cached) {
          return res.status(200).json(JSON.parse(cached));
        }
      }

      const summary = await loadPortfolioSummary(deps, userId, isPaper);
      if (deps.cache) {
        await deps.cache.setEx(cacheKey, config.cacheTtlSeconds, JSON.stringify(summary));
      }

      return res.status(200).json(summary);
    } catch {
      return res.status(500).json({
        error: 'Failed to fetch portfolio',
        errorCode: 'PORTFOLIO_FETCH_FAILED',
        requestId: req.id,
      });
    }
  });

  app.get('/api/v1/portfolio/:userId/performance', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const isPaper = parseBoolean(req.query.paper, false);

    try {
      const historyResult = await deps.db.query(
        `SELECT total_value, cash, pnl, created_at
         FROM portfolio_history
         WHERE user_id = $1 AND COALESCE(is_paper, false) = $2
         ORDER BY created_at DESC
         LIMIT 30`,
        [userId, isPaper]
      );

      return res.status(200).json({
        userId,
        points: historyResult.rows,
        requestId: req.id,
      });
    } catch {
      return res.status(500).json({
        error: 'Failed to fetch portfolio performance',
        errorCode: 'PORTFOLIO_PERFORMANCE_FAILED',
        requestId: req.id,
      });
    }
  });

  app.get('/api/v1/portfolio/:userId/risk-heatmap', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const isPaper = parseBoolean(req.query.paper, false);

    const SECTOR_MAP: Record<string, string> = {
        'RELIANCE': 'ENERGY',
        'TCS': 'TECH',
        'INFY': 'TECH',
        'HDFCBANK': 'FINANCE',
        'ICICIBANK': 'FINANCE',
        'ZOMATO': 'CONSUMER'
    };

    try {
      const summary = await loadPortfolioSummary(deps, userId, isPaper);
      const totalValue = summary.totalValue || 1; // Avoid division by zero

      const heatmap = summary.positions.map(pos => ({
          symbol: pos.symbol,
          weight: pos.marketValue / totalValue,
          pnl: 0, // In a real system, would fetch current market price
          sector: SECTOR_MAP[pos.symbol] || 'OTHER'
      }));

      return res.status(200).json({ heatmap, requestId: req.id });
    } catch {
      return res.status(500).json({ error: 'Heatmap calculation failed', requestId: req.id });
    }
  });

  app.post('/api/v1/portfolio/deposit', async (req: Request, res: Response) => {
    const { userId, amount, currency = 'INR', isPaper = false } = req.body || {};
    const numericAmount = Number(amount);

    if (typeof userId !== 'string' || !userId.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: 'Invalid deposit payload',
        errorCode: 'VALIDATION_ERROR',
        requestId: req.id,
      });
    }

    if (!deps.db.connect) {
      return res.status(500).json({
        error: 'Transactional database client unavailable',
        errorCode: 'DEPOSIT_UNAVAILABLE',
        requestId: req.id,
      });
    }

    const client = await deps.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO portfolios (user_id, cash, currency, is_paper, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, currency, is_paper)
         DO UPDATE SET cash = portfolios.cash + EXCLUDED.cash, updated_at = NOW()`,
        [userId.trim(), numericAmount, String(currency).toUpperCase(), parseBoolean(isPaper)]
      );
      await client.query('COMMIT');

      return res.status(200).json({
        message: 'Deposit successful',
        requestId: req.id,
      });
    } catch {
      await client.query('ROLLBACK');
      return res.status(500).json({
        error: 'Atomic deposit failed',
        errorCode: 'DEPOSIT_FAILED',
        requestId: req.id,
      });
    } finally {
      client.release();
    }
  });

  app.get('/health', async (req: Request, res: Response) => {
    try {
      await deps.db.query('SELECT 1');
      let cacheHealthy = 'disabled';
      if (deps.cache?.ping) {
        await deps.cache.ping();
        cacheHealthy = 'healthy';
      }

      return res.status(200).json({
        status: 'healthy',
        service: config.serviceName,
        version: config.serviceVersion,
        dependencies: {
          database: 'healthy',
          cache: cacheHealthy,
        },
        requestId: req.id,
      });
    } catch {
      return res.status(503).json({
        status: 'unhealthy',
        service: config.serviceName,
        requestId: req.id,
      });
    }
  });

  app.get('/ready', async (req: Request, res: Response) => {
    try {
      await deps.db.query('SELECT 1');
      return res.status(200).json({
        status: 'ready',
        service: config.serviceName,
        requestId: req.id,
      });
    } catch {
      return res.status(503).json({
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
