import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { BrokerRegistry, SmartOrderRouter } from './BrokerRegistry';
import { OrderRequest } from './types';

dotenv.config();

const app = express();
app.use(bodyParser.json() as any);

const registry = new BrokerRegistry();
const router = new SmartOrderRouter(registry);

// 2026 AUDIT: CONTEXTUAL STATE
let API_ACCESS_REVOKED = false;
const IDEMPOTENCY_CACHE = new Set<string>();
const RATE_LIMIT_WINDOW = 1000;
let REQUEST_COUNT = 0;

/**
 * 2026 AUDIT: ORDER EXECUTION (Smart Order Routing)
 */
app.post('/api/v1/broker/execute', async (req: Request, res: Response) => {
  try {
    if (API_ACCESS_REVOKED) return res.status(403).json({ error: 'System Access Revoked' });

    // 1. RATE LIMITING
    REQUEST_COUNT++;
    setTimeout(() => REQUEST_COUNT--, RATE_LIMIT_WINDOW);
    if (REQUEST_COUNT > 5) return res.status(429).json({ error: 'Institutional Rate Limit Exceeded' });

    const { symbol, side, price, quantity, idempotencyKey, bid, ask, userId } = req.body;

    // 2. IDEMPOTENCY
    if (IDEMPOTENCY_CACHE.has(idempotencyKey)) {
        return res.status(409).json({ error: 'Duplicate Order detected' });
    }
    IDEMPOTENCY_CACHE.add(idempotencyKey);
    setTimeout(() => IDEMPOTENCY_CACHE.delete(idempotencyKey), 60000);

    // 3. SLIPPAGE GATE
    if (bid && ask) {
        const spread = (ask - bid) / bid;
        if (spread > 0.005) return res.status(422).json({ error: 'Toxic Liquidity detected' });
    }

    // 4. SHADOW SIMULATION (1,000 MONTE CARLO SHOCKS)
    let survivalCount = 0;
    for (let i = 0; i < 1000; i++) {
        const shockSpread = 0.001 * (1 + Math.random() * 5);
        const shockLag = 10 + Math.random() * 500;
        if (shockSpread < 0.02 && shockLag < 300) survivalCount++;
    }
    if (survivalCount < 950) return res.status(422).json({ error: 'Shadow Stress Test Failed' });

    // 5. SMART ORDER ROUTING (SOR)
    const orderRequest: OrderRequest = { symbol, side, price, quantity, idempotencyKey, userId };
    const result = await router.route(orderRequest);

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: 'Broker execution failed' });
  }
});

app.get('/api/v1/broker/health', (req: Request, res: Response) => {
    res.json({
        status: 'OK',
        brokers: registry.getAllStatus()
    });
});

app.post('/api/v1/broker/revoke', (req: Request, res: Response) => {
    API_ACCESS_REVOKED = true;
    res.json({ message: 'API Access Revoked' });
});

app.listen(process.env.PORT || 3007, () => {
  console.log(`Institutional Broker Service on port ${process.env.PORT || 3007}`);
});
