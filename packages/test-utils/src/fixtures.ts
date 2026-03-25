/**
 * Test fixtures and data factories
 */

export interface TestUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

export interface TestOrder {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  price: number;
  type: 'BUY' | 'SELL';
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
  createdAt: Date;
}

export interface TestPortfolio {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentValue: number;
  updatedAt: Date;
}

/**
 * Create a test user fixture
 */
export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  return {
    id: 'test-user-123',
    email: 'test@example.com',
    passwordHash: '$2b$12$hashedpassword',
    name: 'Test User',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple test users
 */
export function createTestUsers(count: number): TestUser[] {
  return Array.from({ length: count }, (_, i) =>
    createTestUser({
      id: `test-user-${i}`,
      email: `user${i}@example.com`,
    })
  );
}

/**
 * Create a test order fixture
 */
export function createTestOrder(overrides?: Partial<TestOrder>): TestOrder {
  return {
    id: 'test-order-123',
    userId: 'test-user-123',
    symbol: 'AAPL',
    quantity: 100,
    price: 150.0,
    type: 'BUY',
    status: 'PENDING',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple test orders
 */
export function createTestOrders(count: number): TestOrder[] {
  return Array.from({ length: count }, (_, i) =>
    createTestOrder({
      id: `test-order-${i}`,
      symbol: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'][i % 5],
      price: 100 + i * 10,
    })
  );
}

/**
 * Create a test portfolio fixture
 */
export function createTestPortfolio(
  overrides?: Partial<TestPortfolio>
): TestPortfolio {
  return {
    id: 'test-portfolio-123',
    userId: 'test-user-123',
    symbol: 'AAPL',
    quantity: 100,
    averagePrice: 150.0,
    currentValue: 15500.0,
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create multiple portfolio entries
 */
export function createTestPortfolios(count: number): TestPortfolio[] {
  return Array.from({ length: count }, (_, i) =>
    createTestPortfolio({
      id: `test-portfolio-${i}`,
      symbol: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'][i % 5],
      quantity: (i + 1) * 50,
      averagePrice: 100 + i * 10,
    })
  );
}

/**
 * Create common test data sets
 */
export function createTestDataSet() {
  return {
    user: createTestUser(),
    users: createTestUsers(5),
    order: createTestOrder(),
    orders: createTestOrders(10),
    portfolio: createTestPortfolio(),
    portfolios: createTestPortfolios(5),
  };
}
