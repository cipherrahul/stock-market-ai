import { BaseBroker } from './adapters/BaseBroker';
import { ZerodhaAdapter } from './adapters/ZerodhaAdapter';
import { UpstoxAdapter } from './adapters/UpstoxAdapter';
import { AlpacaAdapter } from './adapters/AlpacaAdapter';
import { OrderRequest, OrderResponse } from './types';

export class BrokerRegistry {
    private brokers: BaseBroker[] = [];

    constructor() {
        this.brokers.push(new ZerodhaAdapter());
        this.brokers.push(new UpstoxAdapter());
        this.brokers.push(new AlpacaAdapter(
            process.env.ALPACA_API_KEY || 'PK_DEBUG_KEY',
            process.env.ALPACA_API_SECRET || 'SK_DEBUG_SECRET'
        ));
    }

    public getBestBroker(): BaseBroker | null {
        // Filter for connected brokers and sort by latency (ascending)
        const healthyBrokers = this.brokers
            .filter(b => b.connected)
            .sort((a, b) => a.latency - b.latency);

        return healthyBrokers.length > 0 ? healthyBrokers[0] : null;
    }

    public getPaperBroker(): BaseBroker | null {
        // Alpaca is our primary shadow broker
        return this.brokers.find(b => b.name === 'Alpaca') || this.getBestBroker();
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
        let brokerToUse: BaseBroker | null = null;
        
        if (order.isPaper) {
            // Find a broker that supports paper (Alpaca by default)
            brokerToUse = this.registry.getPaperBroker();
        } else {
            brokerToUse = this.registry.getBestBroker();
        }

        if (!brokerToUse) {
            return {
                status: 'HEDGED',
                broker: 'NONE',
                reason: 'All Brokers Unreachable. Emergency Neutralization triggered.',
                timestamp: new Date().toISOString()
            };
        }

        try {
            return await brokerToUse.executeOrder(order);
        } catch (error) {
            console.error(`❌ [SmartOrderRouter] Failover required for ${brokerToUse.name}`);
            // Recurse to try next best broker
            return {
                status: 'FAILED',
                broker: brokerToUse.name,
                reason: 'Broker Execution Failed',
                timestamp: new Date().toISOString()
            };
        }
    }
}
