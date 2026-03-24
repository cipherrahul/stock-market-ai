import { OrderRequest, OrderResponse, BrokerStatus } from '../types';

export abstract class BaseBroker {
    public abstract name: string;
    public abstract latency: number;
    public abstract connected: boolean;

    public abstract executeOrder(order: OrderRequest): Promise<OrderResponse>;
    public abstract getStatus(): BrokerStatus;
}
