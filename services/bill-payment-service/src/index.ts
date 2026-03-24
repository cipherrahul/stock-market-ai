import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import dotenv from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';

dotenv.config();

const app = express();
app.use(bodyParser.json() as any);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const kafka = new Kafka({
  clientId: 'bill-payment-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();
const PORT = process.env.BILL_PAYMENT_PORT || 3016;

/**
 * AUTONOMOUS BILL SETTLEMENT LOOP
 * Scans the PostgreSQL 'bills' table for PENDING liabilities.
 */
async function checkAndPayBills() {
    console.log("🤵 CFO Agent: Scanning for live upcoming liabilities...");
    
    try {
        const res = await pool.query("SELECT * FROM bills WHERE status = 'PENDING'");
        const pendingBills = res.rows;

        for (const bill of pendingBills) {
            console.log(`🔍 Detected ${bill.category} bill: $${bill.amount} for ${bill.vendor} due on ${bill.due_date}`);
            
            // 1. Check Liveness Balance from Portfolio
            const portfolioRes = await axios.get(`${process.env.PORTFOLIO_SERVICE_URL}/portfolio/user_123`);
            const cash = portfolioRes.data.cash || 0;
            
            if (cash >= parseFloat(bill.amount)) {
                console.log(`✅ Liquidity Confirmed. Executing AUTONOMOUS PAYMENT for ${bill.vendor}...`);
                
                // 2. Execute Withdrawal from Broker-to-Bank
                await axios.post(`${process.env.PORTFOLIO_SERVICE_URL}/portfolio/withdraw`, {
                    userId: 'user_123',
                    amount: bill.amount,
                    destination: 'BANK_ACCOUNT_PRIMARY'
                });

                // 3. Update DB (Atomic)
                await pool.query(
                    "UPDATE bills SET status = 'PAID', updated_at = NOW() WHERE id = $1",
                    [bill.id]
                );
                
                // 4. Broadcast Event to Kafka
                await producer.send({
                    topic: 'cfo_actions',
                    messages: [{
                        value: JSON.stringify({
                            event: 'BILL_PAID_AUTONOMOUSLY',
                            billId: bill.id,
                            vendor: bill.vendor,
                            amount: bill.amount,
                            timestamp: new Date().toISOString()
                        })
                    }]
                });
                console.log(`✅ [BillService] ${bill.vendor} bill paid and DB synchronized.`);
            } else {
                console.warn(`⚠️ INSUFFICIENT FUNDS for ${bill.vendor}. Waiting for Trading Profits...`);
            }
        }
    } catch (err: any) {
        console.error("❌ CFO Error during bill payment cycle:", err.message);
    }
}

// Start Cycle every 60 seconds
setInterval(checkAndPayBills, 60000);

app.get('/bills', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM bills");
        res.json(result.rows);
    } catch (err: any) {
        res.status(500).json({ error: 'DB Fetch Failed' });
    }
});

app.listen(PORT, async () => {
    try {
        await producer.connect();
        await checkAndPayBills(); // Initial scan
        console.log(`🤵 Bill Payment Service (CFO Agent) live on port ${PORT}`);
    } catch (err: any) {
        console.error("❌ Failed to start Bill Payment Service:", err.message);
    }
});
