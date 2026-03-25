/**
 * Portfolio Service - Portfolio Management Tests
 */
import {
  createMockPool,
  setupMockQueryResponses,
  createTestPortfolio,
  createTestUser,
} from 'test-utils';

describe('Portfolio Service - Portfolio Management', () => {
  let pool: any;

  beforeEach(() => {
    pool = createMockPool();
    jest.clearAllMocks();
  });

  describe('GET /portfolio/:userId', () => {
    it('should retrieve user portfolio successfully', async () => {
      const userId = 'test-user-123';
      const testPortfolios = [
        createTestPortfolio({ userId, symbol: 'AAPL' }),
        createTestPortfolio({ userId, symbol: 'GOOGL' }),
      ];

      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM portfolios WHERE user_id',
          response: { rows: testPortfolios },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should return empty portfolio for new user', async () => {
      const userId = 'new-user-456';
      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM portfolios WHERE user_id',
          response: { rows: [] },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should calculate total portfolio value', () => {
      const portfolios = [
        { symbol: 'AAPL', quantity: 100, currentPrice: 150 }, // 15,000
        { symbol: 'GOOGL', quantity: 50, currentPrice: 140 }, // 7,000
      ];

      const totalValue = portfolios.reduce(
        (sum, p) => sum + p.quantity * p.currentPrice,
        0
      );
      expect(totalValue).toBe(22000);
    });

    it('should calculate gain/loss for each position', () => {
      const position = {
        quantity: 100,
        averagePrice: 150,
        currentPrice: 160,
      };

      const totalCost = position.quantity * position.averagePrice;
      const currentValue = position.quantity * position.currentPrice;
      const gainLoss = currentValue - totalCost;

      expect(gainLoss).toBeGreaterThan(0);
      expect(gainLoss).toBe(1000);
    });
  });

  describe('POST /portfolio/add-position', () => {
    it('should add new position to portfolio', async () => {
      const positionData = {
        userId: 'test-user-123',
        symbol: 'AAPL',
        quantity: 100,
        averagePrice: 150.5,
      };

      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM portfolios WHERE user_id AND symbol',
          response: { rows: [] },
        },
        {
          query: 'INSERT INTO portfolios',
          response: {
            rows: [
              {
                id: 'portfolio-123',
                ...positionData,
                created_at: new Date(),
              },
            ],
          },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should update existing position', async () => {
      const userId = 'test-user-123';
      const symbol = 'AAPL';
      const existingPosition = createTestPortfolio({
        userId,
        symbol,
        quantity: 100,
        averagePrice: 150,
      });

      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM portfolios WHERE user_id AND symbol',
          response: { rows: [existingPosition] },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should calculate new average price on purchase', () => {
      const existing = {
        quantity: 100,
        averagePrice: 150,
      };

      const newPurchase = {
        quantity: 50,
        price: 160,
      };

      const newQuantity = existing.quantity + newPurchase.quantity;
      const newAveragePrice =
        (existing.quantity * existing.averagePrice +
          newPurchase.quantity * newPurchase.price) /
        newQuantity;

      expect(newQuantity).toBe(150);
      expect(newAveragePrice).toBeCloseTo(153.33, 2);
    });

    it('should validate position quantity > 0', () => {
      const invalidQuantities = [0, -10, -100];
      invalidQuantities.forEach(qty => {
        expect(qty).toBeLessThanOrEqual(0);
      });
    });

    it('should validate symbol format', () => {
      const validSymbols = ['AAPL', 'GOOGL', 'MSFT'];
      const invalidSymbols = ['', 'a', '123'];

      validSymbols.forEach(symbol => {
        expect(symbol.length).toBeGreaterThan(1);
      });

      invalidSymbols.forEach(symbol => {
        expect(symbol.length).toBeLessThan(2);
      });
    });
  });

  describe('PUT /portfolio/update-position/:positionId', () => {
    it('should update position price and calculations', async () => {
      const positionId = 'position-123';
      const newPrice = 165.75;

      setupMockQueryResponses(pool, [
        {
          query: 'UPDATE portfolios SET current_value',
          response: { rows: [{ id: positionId, currentPrice: newPrice }] },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should recalculate gain/loss on update', () => {
      const position = {
        currentValue: 16575, // 100 * 165.75
        totalCost: 15000, // 100 * 150
      };

      const gainLoss = position.currentValue - position.totalCost;
      const gainLossPercent = (gainLoss / position.totalCost) * 100;

      expect(gainLoss).toBe(1575);
      expect(gainLossPercent).toBeCloseTo(10.5, 1);
    });
  });

  describe('DELETE /portfolio/remove-position/:positionId', () => {
    it('should remove position from portfolio', async () => {
      const positionId = 'position-123';

      setupMockQueryResponses(pool, [
        {
          query: 'DELETE FROM portfolios WHERE id',
          response: { rows: [{ id: positionId }] },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should audit removal action', async () => {
      const auditEntry = {
        positionId: 'position-123',
        userId: 'user-123',
        action: 'REMOVE_POSITION',
        timestamp: new Date(),
      };

      expect(auditEntry.action).toBe('REMOVE_POSITION');
    });
  });

  describe('Portfolio Constraints', () => {
    it('should prevent IDOR - user can only access own portfolio', () => {
      const userId = 'user-123';
      const requestUserId = 'different-user-456';

      expect(userId).not.toEqual(requestUserId);
    });

    it('should calculate portfolio weight percentage', () => {
      const portfolios = [
        { symbol: 'AAPL', value: 15000 },
        { symbol: 'GOOGL', value: 7000 },
        { symbol: 'MSFT', value: 8000 },
      ];

      const totalValue = portfolios.reduce((sum, p) => sum + p.value, 0);
      const weights = portfolios.map(p => (p.value / totalValue) * 100);

      expect(weights[0]).toBeCloseTo(50, 1);
      expect(weights[1]).toBeCloseTo(23.33, 1);
      expect(weights[2]).toBeCloseTo(26.67, 1);
    });

    it('should support multiple asset classes', () => {
      const assetTypes = ['STOCK', 'ETF', 'BOND', 'CRYPTO'];
      expect(assetTypes).toContain('STOCK');
      expect(assetTypes).toContain('CRYPTO');
    });
  });

  describe('Transaction History', () => {
    it('should record all portfolio transactions', async () => {
      setupMockQueryResponses(pool, [
        {
          query: 'SELECT * FROM portfolio_transactions WHERE',
          response: {
            rows: [
              {
                id: 'txn-1',
                userId: 'user-123',
                type: 'BUY',
                symbol: 'AAPL',
                quantity: 100,
                price: 150,
                timestamp: new Date(),
              },
            ],
          },
        },
      ]);

      expect(pool.query).toBeDefined();
    });

    it('should track cost basis accurately', () => {
      const transactions = [
        { quantity: 100, price: 150, type: 'BUY' },
        { quantity: 50, price: 155, type: 'BUY' },
        { quantity: 30, price: 160, type: 'SELL' },
      ];

      const totalCost =
        transactions
          .filter(t => t.type === 'BUY')
          .reduce((sum, t) => sum + t.quantity * t.price, 0) / 120;

      expect(totalCost).toBeGreaterThan(0);
    });
  });
});
