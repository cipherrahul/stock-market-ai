import { useState, useCallback, useRef } from 'react';
import axios from 'axios';

/**
 * REALTIME TRADING HOOK — Premium Grade
 * Manages buy/sell orders with real-time execution, exponential-backoff retries,
 * structured error classification, MIS/CNC order variants, and square-off support.
 */

export type OrderVariant = 'CNC' | 'MIS'; // CNC = delivery, MIS = intraday margin

export interface TradeRequest {
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  isPaper?: boolean;
  orderVariant?: OrderVariant;
  bid?: number;
  ask?: number;
}

export interface TradeResponse {
  orderId: string;
  transactionId?: string;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  symbol: string;
  quantity: number;
  side: 'BUY' | 'SELL';
  requestedPrice: number;
  executedPrice: number;
  slippage: number;
  slippagePercent: number;
  orderVariant?: OrderVariant;
  timestamp: string;
  message?: string;
  error?: string;
  errorCode?: string;
}

export interface IntradayPosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  side: 'BUY' | 'SELL';
  orderId: string;
}

// Human-readable error map from backend errorCode
const ERROR_CODE_MAP: Record<string, string> = {
  INSUFFICIENT_BALANCE: '💰 Insufficient balance — please add funds before placing this order.',
  INSUFFICIENT_HOLDINGS: '📉 You don\'t hold enough shares to sell this quantity.',
  RISK_LIMIT_EXCEEDED: '🛡️ Order exceeds your risk limit. Reduce quantity or position size.',
  BROKER_UNAVAILABLE: '📡 Broker service is momentarily unavailable. Retrying automatically…',
  BROKER_REJECTED: '❌ Broker rejected the order. Check symbol validity and market hours.',
  PORTFOLIO_VALIDATION_FAILED: '📂 Portfolio validation failed. Please refresh and try again.',
  VALIDATION_ERROR: '⚠️ Invalid order parameters. Please check all fields.',
  DEPENDENCY_UNAVAILABLE: '🔌 A required service is offline. Please retry in a moment.',
};

function classifyError(err: any): string {
  const errorCode = err?.response?.data?.errorCode as string;
  if (errorCode && ERROR_CODE_MAP[errorCode]) return ERROR_CODE_MAP[errorCode];
  const backendMsg = err?.response?.data?.error;
  if (backendMsg) return backendMsg;
  if (err?.code === 'ECONNABORTED') return '⏱️ Request timed out — market is highly active. Retrying…';
  if (err?.code === 'ERR_NETWORK') return '🌐 Network error — please check your connection.';
  return err?.message || 'Trade execution failed. Please try again.';
}

interface UseRealtimeTradingReturn {
  executing: boolean;
  lastTrade: TradeResponse | null;
  error: string | null;
  errorCode: string | null;
  retryCount: number;
  executeTrade: (request: TradeRequest) => Promise<TradeResponse>;
  squareOffAll: (userId: string) => Promise<{ squaredOff: number }>;
  clearError: () => void;
  setError: (error: string | null) => void;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function useRealtimeTrading(token: string, userId: string): UseRealtimeTradingReturn {
  const [executing, setExecuting] = useState(false);
  const [lastTrade, setLastTrade] = useState<TradeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const apiUrlRef = useRef(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

  const executeTrade = useCallback(
    async (request: TradeRequest): Promise<TradeResponse> => {
      const MAX_RETRIES = 3;
      const idempotencyKey = crypto.randomUUID(); // Stable across retries

      const attemptRequest = async (attempt: number): Promise<TradeResponse> => {
        const response = await axios.post(
          `${apiUrlRef.current}/api/v1/trading/execute`,
          { userId, idempotencyKey, ...request },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
              'X-Attempt': String(attempt),
            },
            timeout: 12000,
          }
        );
        return response.data as TradeResponse;
      };

      try {
        setExecuting(true);
        setError(null);
        setErrorCode(null);
        setRetryCount(0);

        let trade: TradeResponse | null = null;
        let lastErr: any = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            trade = await attemptRequest(attempt);
            setRetryCount(attempt - 1);
            break;
          } catch (err: any) {
            lastErr = err;
            const status = err?.response?.status;
            // Don't retry on client-side 4xx errors (validation, insufficient funds, etc.)
            if (status && status >= 400 && status < 500) throw err;
            // Retry on 5xx, network errors, timeouts
            if (attempt < MAX_RETRIES) {
              setRetryCount(attempt);
              const backoff = Math.pow(2, attempt) * 300; // 600ms, 1200ms
              await sleep(backoff);
            }
          }
        }

        if (!trade) throw lastErr;

        setLastTrade(trade);
        if (trade.status === 'FAILED') {
          const msg = classifyError({ response: { data: { error: trade.error, errorCode: trade.errorCode } } });
          setError(msg);
          setErrorCode(trade.errorCode || null);
        }
        return trade;
      } catch (err: any) {
        const msg = classifyError(err);
        const code = err?.response?.data?.errorCode || null;
        setError(msg);
        setErrorCode(code);
        const failedResponse: TradeResponse = {
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
          error: msg,
          errorCode: code,
        };
        setLastTrade(failedResponse);
        return failedResponse;
      } finally {
        setExecuting(false);
      }
    },
    [token, userId]
  );

  const squareOffAll = useCallback(
    async (targetUserId: string): Promise<{ squaredOff: number }> => {
      try {
        const response = await axios.post(
          `${apiUrlRef.current}/api/v1/trading/intraday/square-off/${targetUserId}`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 20000,
          }
        );
        return { squaredOff: response.data?.squaredOff || 0 };
      } catch (err: any) {
        throw new Error(classifyError(err));
      }
    },
    [token]
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
    setRetryCount(0);
  }, []);

  return {
    executing,
    lastTrade,
    error,
    errorCode,
    retryCount,
    executeTrade,
    squareOffAll,
    clearError,
    setError,
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
  if (!request.symbol || request.symbol.trim() === '')
    return { valid: false, error: 'Symbol is required' };
  if (!request.quantity || request.quantity <= 0)
    return { valid: false, error: 'Quantity must be greater than 0' };
  if (request.quantity > 100000)
    return { valid: false, error: 'Quantity exceeds maximum limit (100,000)' };
  if (!['BUY', 'SELL'].includes(request.side))
    return { valid: false, error: 'Invalid side (BUY or SELL)' };
  if (request.price !== undefined && request.price <= 0)
    return { valid: false, error: 'Price must be greater than 0' };
  if (request.stopLoss !== undefined && request.stopLoss <= 0)
    return { valid: false, error: 'Stop-loss must be greater than 0' };
  if (request.takeProfit !== undefined && request.takeProfit <= 0)
    return { valid: false, error: 'Take-profit must be greater than 0' };
  if (request.stopLoss && request.price && request.side === 'BUY' && request.stopLoss >= request.price)
    return { valid: false, error: 'Stop-loss must be below entry price for BUY' };
  if (request.takeProfit && request.price && request.side === 'BUY' && request.takeProfit <= request.price)
    return { valid: false, error: 'Take-profit must be above entry price for BUY' };
  return { valid: true };
}

