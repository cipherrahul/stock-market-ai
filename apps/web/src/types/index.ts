export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Portfolio {
  user_id: string;
  total_quantity: number;
  total_value: number;
  total_trades: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  avg_sell_price?: number;
  current_price?: number;
  pnl?: number;
}

export interface Order {
  id: string;
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  price: number;
  status: 'pending' | 'executed' | 'cancelled';
  createdAt: string;
}

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent?: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: string;
}

export interface TradeSignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price_target: number;
  reasoning: string;
}

export interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PnL {
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  returnPercentage: number;
}
