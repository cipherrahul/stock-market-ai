import * as crypto from 'crypto';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

export interface SquareOffDependencies {
  db: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
  };
  brokerServiceUrl: string;
  httpClient?: Pick<AxiosInstance, 'get' | 'post'>;
}

export interface SquareOffResult {
  userId: string;
  squaredOffCount: number;
  orders: Array<{ symbol: string; quantity: number; offsetSide: 'BUY' | 'SELL'; status: string }>;
}

export class IntradaySquareOffManager {
  private timer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private dependencies: SquareOffDependencies;
  private autoSquareOffHour: number = 15;
  private autoSquareOffMinute: number = 15;

  constructor(dependencies: SquareOffDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Starts the background square-off supervisor daemon.
   * Checks current IST time every 30 seconds.
   */
  public startDaemon(intervalMs: number = 30_000): void {
    if (this.timer) return;

    console.log('⏰ [IntradaySquareOffManager] Supervisor daemon started (Auto Square-Off at 15:15 IST)');
    this.timer = setInterval(async () => {
      await this.checkAndExecuteScheduledSquareOff();
    }, intervalMs);
  }

  public stopDaemon(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('🛑 [IntradaySquareOffManager] Supervisor daemon stopped');
    }
  }

  /**
   * Helper: Check if current IST time is past 15:15 on a market weekday
   */
  public isSquareOffTime(): boolean {
    const nowUtc = new Date();
    // IST is UTC + 5:30
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(nowUtc.getTime() + istOffsetMs);
    const day = istTime.getUTCDay(); // 0 = Sun, 6 = Sat

    if (day === 0 || day === 6) return false; // Market closed on weekends

    const hours = istTime.getUTCHours();
    const minutes = istTime.getUTCMinutes();

    // Trigger window: between 15:15 IST and 15:30 IST
    return (hours === this.autoSquareOffHour && minutes >= this.autoSquareOffMinute) ||
           (hours === 15 && minutes < 30);
  }

  /**
   * Scheduled square-off check
   */
  public async checkAndExecuteScheduledSquareOff(): Promise<void> {
    if (this.isRunning) return;
    if (!this.isSquareOffTime()) return;

    try {
      this.isRunning = true;
      console.log('🚨 [IntradaySquareOffManager] 15:15 IST Triggered: Scanning for open MIS positions...');

      // Find all users with open positions from MIS orders
      const usersQuery = await this.dependencies.db.query(`
        SELECT DISTINCT user_id 
        FROM orders 
        WHERE order_variant = 'MIS' AND status = 'EXECUTED'
      `);

      for (const row of usersQuery.rows) {
        await this.squareOffUserPositions(row.user_id, 'SCHEDULED_1515_IST_SQUARE_OFF');
      }
    } catch (err: any) {
      console.error('❌ [IntradaySquareOffManager] Error during scheduled square-off:', err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Liquidates/offsets all active MIS positions for a specific user
   */
  public async squareOffUserPositions(
    userId: string,
    reason: string = 'MANUAL_EMERGENCY_SQUARE_OFF'
  ): Promise<SquareOffResult> {
    const client = this.dependencies.httpClient || axios;
    const results: SquareOffResult = {
      userId,
      squaredOffCount: 0,
      orders: [],
    };

    try {
      // Find net open quantity per symbol for MIS orders
      const ordersRes = await this.dependencies.db.query(`
        SELECT symbol,
               SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) AS net_qty
        FROM orders
        WHERE user_id = $1 AND order_variant = 'MIS' AND status = 'EXECUTED'
        GROUP BY symbol
        HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) != 0
      `, [userId]);

      for (const item of ordersRes.rows) {
        const netQty = Number(item.net_qty);
        if (netQty === 0) continue;

        const symbol = item.symbol;
        const offsetSide: 'BUY' | 'SELL' = netQty > 0 ? 'SELL' : 'BUY';
        const offsetQty = Math.abs(netQty);
        const idempotencyKey = `sqoff-${Date.now()}-${symbol}-${crypto.randomUUID().slice(0, 6)}`;

        console.log(`⚡ [SquareOff] Liquidating ${symbol}: Net Qty=${netQty} -> Placing ${offsetSide} ${offsetQty} (${reason})`);

        try {
          const brokerRes = await client.post(
            `${this.dependencies.brokerServiceUrl}/api/v1/broker/execute`,
            {
              userId,
              symbol,
              quantity: offsetQty,
              side: offsetSide,
              price: 0, // Market order for instantaneous execution
              memo: `AUTO_SQUARE_OFF_${reason}`,
              idempotencyKey,
            },
            { timeout: 5000 }
          );

          // Record offsetting order into database
          await this.dependencies.db.query(`
            INSERT INTO orders (
              user_id, symbol, quantity, side, price, status, broker_order_id, 
              order_variant, memo, idempotency_key, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          `, [
            userId,
            symbol,
            offsetQty,
            offsetSide,
            brokerRes.data?.executedPrice || 0,
            'EXECUTED',
            brokerRes.data?.orderId || null,
            'MIS',
            `SQUARE_OFF: ${reason}`,
            idempotencyKey,
          ]);

          results.squaredOffCount++;
          results.orders.push({
            symbol,
            quantity: offsetQty,
            offsetSide,
            status: 'EXECUTED',
          });
        } catch (execErr: any) {
          console.error(`❌ [SquareOff] Failed to liquidate ${symbol} for user ${userId}:`, execErr.message);
          results.orders.push({
            symbol,
            quantity: offsetQty,
            offsetSide,
            status: 'FAILED',
          });
        }
      }
    } catch (dbErr: any) {
      console.error(`❌ [SquareOff] DB query failed for user ${userId}:`, dbErr.message);
    }

    return results;
  }
}
