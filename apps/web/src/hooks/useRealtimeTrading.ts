import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

/**
 * REALTIME TRADING HOOK
 * Manages buy/sell orders with real-time execution and status updates
 */

interface TradeRequest {
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  price?: number; // Optional: if not provided, use market price
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeResponse {
  orderId: string;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  requestedPrice: number;
  executedPrice: number;
  slippage: number;
  slippagePercent: number;
  timestamp: string;
  message?: string;
  error?: string;
}

interface UseRealtimeTradingReturn {
  executing: boolean;
  lastTrade: TradeResponse | null;
  error: string | null;
  executeTrade: (request: TradeRequest) => Promise<TradeResponse>;
  clearError: () => void;
}

export function useRealtimeTrading(token: string, userId: string): UseRealtimeTradingReturn {
  const [executing, setExecuting] = useState(false);
  const [lastTrade, setLastTrade] = useState<TradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiUrlRef = useRef(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

  const executeTrade = useCallback(
    async (request: TradeRequest): Promise<TradeResponse> => {
      try {
        setExecuting(true);
        setError(null);

        const response = await axios.post(
          `${apiUrlRef.current}/api/v1/trading/execute`,
          {
            userId,
            ...request,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );

        const trade = response.data as TradeResponse;
        setLastTrade(trade);

        if (trade.status === 'FAILED') {
          setError(trade.error || 'Trade execution failed');
        }

        console.log(`✅ ${trade.side} ${trade.quantity} ${trade.symbol} @ ₹${trade.executedPrice}`);
        return trade;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.error ||
          err.message ||
          'Failed to execute trade';

        setError(errorMessage);
        console.error('❌ Trade execution error:', errorMessage);

        return {
          orderId: '',
          status: 'FAILED',
          symbol: request.symbol,
          quantity: request.quantity,
          side: request.side,
          requestedPrice: request.price || 0,
          executedPrice: 0,
          slippage: 0,
          slippagePercent: 0,
          timestamp: new Date().toISOString(),
          error: errorMessage,
        };
      } finally {
        setExecuting(false);
      }
    },
    [token, userId]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    executing,
    lastTrade,
    error,
    executeTrade,
    clearError,
  };
}

/**
 * VALIDATION HELPER
 */

interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateTradeRequest(request: TradeRequest): ValidationResult {
  if (!request.symbol || request.symbol.trim() === '') {
    return { valid: false, error: 'Symbol is required' };
  }

  if (!request.quantity || request.quantity <= 0) {
    return { valid: false, error: 'Quantity must be greater than 0' };
  }

  if (request.quantity > 100000) {
    return { valid: false, error: 'Quantity exceeds maximum limit' };
  }

  if (!['BUY', 'SELL'].includes(request.side)) {
    return { valid: false, error: 'Invalid side (BUY or SELL)' };
  }

  if (request.price && request.price <= 0) {
    return { valid: false, error: 'Price must be greater than 0' };
  }

  if (request.stopLoss && request.stopLoss <= 0) {
    return { valid: false, error: 'Stop-loss must be greater than 0' };
  }

  if (request.takeProfit && request.takeProfit <= 0) {
    return { valid: false, error: 'Take-profit must be greater than 0' };
  }

  return { valid: true };
}
