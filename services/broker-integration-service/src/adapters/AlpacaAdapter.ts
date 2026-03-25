import axios from 'axios';
import { BaseBroker } from './BaseBroker';
import { OrderRequest, OrderResponse, BrokerStatus } from '../types';

export class AlpacaAdapter extends BaseBroker {
    public name = 'ALPACA_GLOBAL';
    public latency = 45; // Simulated baseline for US-West-2
    public connected = true;

    private apiKey: string;
    private apiSecret: string;
    private baseUrl: string;

    constructor(apiKey: string, apiSecret: string, isPaper: boolean = true) {
        super();
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = isPaper 
            ? 'https://paper-api.alpaca.markets' 
            : 'https://api.alpaca.markets';
    }

    public async executeOrder(order: OrderRequest): Promise<OrderResponse> {
        try {
            const response = await axios.post(
                `${this.baseUrl}/v2/orders`,
                {
                    symbol: order.symbol,
                    qty: order.quantity.toString(),
                    side: order.side.toLowerCase(),
                    type: 'market',
                    time_in_force: 'day',
                    client_order_id: order.idempotencyKey
                },
                {
                    headers: {
                        'APCA-API-KEY-ID': this.apiKey,
                        'APCA-API-SECRET-KEY': this.apiSecret
                    }
                }
            );

            return {
                status: 'EXECUTED',
                orderId: response.data.id,
                broker: this.name,
                executedPrice: parseFloat(response.data.filled_avg_price) || order.price,
                timestamp: new Date().toISOString()
            };
        } catch (err: any) {
            console.error(`❌ ALPACA_ERROR: ${err.response?.data?.message || err.message}`);
            return {
                status: 'FAILED',
                broker: this.name,
                reason: err.response?.data?.message || 'Connection Error',
                timestamp: new Date().toISOString()
            };
        }
    }

    public getStatus(): BrokerStatus {
        return {
            name: this.name,
            connected: this.connected,
            latency: this.latency,
            lastChecked: new Date().toISOString()
        };
    }
}
