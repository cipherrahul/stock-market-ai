export interface OrderRequest {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    idempotencyKey: string;
    userId: string;
    memo?: string;
    isPaper?: boolean;
}

export interface OrderResponse {
    status: 'EXECUTED' | 'FAILED' | 'REJECTED' | 'HEDGED';
    orderId?: string;
    broker: string;
    reason?: string;
    memo?: string;
    executedPrice?: number;
    timestamp: string;
}

export interface BrokerStatus {
    name: string;
    connected: boolean;
    latency: number; // ms
    lastChecked: string;
}
