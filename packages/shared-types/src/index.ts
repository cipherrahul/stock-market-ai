export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: Date;
}

export interface TradeSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  priceTarget: number;
  reasoning: string;
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  price: number;
  status: 'pending' | 'executed' | 'cancelled';
  createdAt: Date;
}

export interface Portfolio {
  userId: string;
  totalValue: number;
  cash: number;
  positions: Position[];
  pnl: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  volume: number;
  timestamp: Date;
}

export interface BacktestResult {
  strategy: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  return: number;
  sharpeRatio: number;
  maxDrawdown: number;
}
