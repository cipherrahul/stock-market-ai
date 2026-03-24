import { BaseBroker } from './adapters/BaseBroker';
import { ZerodhaAdapter } from './adapters/ZerodhaAdapter';
import { UpstoxAdapter } from './adapters/UpstoxAdapter';
import { OrderRequest, OrderResponse } from './types';

export class BrokerRegistry {
    private brokers: BaseBroker[] = [];

    constructor() {
        this.brokers.push(new ZerodhaAdapter());
        this.brokers.push(new UpstoxAdapter());
    }

    public getBestBroker(): BaseBroker | null {
        // Filter for connected brokers and sort by latency (ascending)
        const healthyBrokers = this.brokers
            .filter(b => b.connected)
            .sort((a, b) => a.latency - b.latency);

        return healthyBrokers.length > 0 ? healthyBrokers[0] : null;
    }

    public getAllStatus() {
        return this.brokers.map(b => b.getStatus());
    }
}

export class SmartOrderRouter {
    private registry: BrokerRegistry;

    constructor(registry: BrokerRegistry) {
        this.registry = registry;
    }

    async route(order: OrderRequest): Promise<OrderResponse> {
        const bestBroker = this.registry.getBestBroker();

        if (!bestBroker) {
            return {
                status: 'HEDGED',
                broker: 'NONE',
                reason: 'All Brokers Unreachable. Emergency Neutralization triggered.',
                timestamp: new Date().toISOString()
            };
        }

        try {
            return await bestBroker.executeOrder(order);
        } catch (error) {
            console.error(`❌ [SmartOrderRouter] Failover required for ${bestBroker.name}`);
            // Recurse to try next best broker (Registry should ideally mark the failed one as disconnected temporarily)
            // For now, simple implementation
            return {
                status: 'FAILED',
                broker: bestBroker.name,
                reason: 'Broker Execution Failed',
                timestamp: new Date().toISOString()
            };
        }
    }
}
