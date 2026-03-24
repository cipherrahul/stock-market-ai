/**
 * Constants and Enums
 */

export enum OrderStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
}

export const POPULAR_SYMBOLS = [
  'RELIANCE',
  'TCS',
  'INFY',
  'HDFC',
  'ICICI',
  'SBIN',
  'WIPRO',
  'HCLTECH',
  'BAJAJFINSV',
  'MARUTI',
];

export const RISK_LEVELS = [
  { value: RiskLevel.LOW, label: 'Low Risk', description: 'Conservative approach' },
  { value: RiskLevel.MEDIUM, label: 'Medium Risk', description: 'Balanced approach' },
  { value: RiskLevel.HIGH, label: 'High Risk', description: 'Aggressive approach' },
];

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
  },
  USER: {
    PROFILE: '/api/v1/user/profile',
    SETTINGS: '/api/v1/user/settings',
    UPDATE: '/api/v1/user/update',
  },
  MARKET: {
    QUOTE: '/api/v1/market/quote/:symbol',
    HISTORY: '/api/v1/market/history/:symbol',
    SEARCH: '/api/v1/market/search',
    TOP_MOVERS: '/api/v1/market/top-movers',
  },
  TRADING: {
    PLACE_ORDER: '/api/v1/trading/order',
    CANCEL_ORDER: '/api/v1/trading/order/:orderId/cancel',
    HISTORY: '/api/v1/trading/history/:userId',
    POSITIONS: '/api/v1/trading/positions/:userId',
  },
  PORTFOLIO: {
    SUMMARY: '/api/v1/portfolio/:userId/summary',
    HISTORY: '/api/v1/portfolio/:userId/history',
    PERFORMANCE: '/api/v1/portfolio/:userId/performance',
    ANALYTICS: '/api/v1/portfolio/:userId/analytics',
  },
  AI: {
    GENERATE_SIGNAL: '/api/v1/ai/generate-signal',
    SIGNALS: '/api/v1/ai/signals',
    BACKTEST: '/api/v1/ai/backtest',
  },
};

export const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export const TOAST_DURATION = {
  SHORT: 2000,
  NORMAL: 4000,
  LONG: 6000,
};
