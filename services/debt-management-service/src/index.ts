import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 3017;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

/**
 * DEBT OPTIMIZATION AGENT
 * Analyzes real entries from the 'liabilities' table.
 */
async function optimizeDebt() {
    console.log("🤵 CFO Agent: Analyzing live debt interest velocity...");
    
    try {
        // High-Fidelity Query
        const res = await pool.query(
            "SELECT * FROM liabilities WHERE status = 'ACTIVE' ORDER BY apr DESC LIMIT 1"
        );
        const highInterestDebt = res.rows[0];

        if (highInterestDebt && highInterestDebt.apr > 10) {
            console.log(`🎯 Identified HIGH-INTEREST debt: ${highInterestDebt.type} at ${highInterestDebt.apr}% APR.`);
            
            // 1. Check for 'Surplus Alpha' from Portfolio
            const portfolioRes = await axios.get(`${process.env.PORTFOLIO_SERVICE_URL}/portfolio/user_123`);
            const cash = portfolioRes.data.cash || 0;
            const dailyGain = portfolioRes.data.last_daily_gain || 0;

            // Rule: If daily gain > $5,000, allocate 20% to debt reduction
            if (dailyGain > 5000) {
                const repayment = Math.min(dailyGain * 0.2, parseFloat(highInterestDebt.balance));
                console.log(`💸 SURPLUS DETECTED. Allocating $${repayment} from trading alpha to ${highInterestDebt.type} reduction.`);
                
                // Execute Repayment (Atomic Transaction)
                await pool.query(
                    "UPDATE liabilities SET balance = balance - $1, status = CASE WHEN balance - $1 <= 0 THEN 'PAID' ELSE 'ACTIVE' END WHERE id = $2",
                    [repayment, highInterestDebt.id]
                );

                console.log(`✅ Debt Rebalanced in PostgreSQL. High-interest exposure reduced.`);
            }
        }
    } catch (err: any) {
        console.error("❌ CFO Debt Optimization Error:", err.message);
    }
}

// Optimization check every 5 minutes
setInterval(optimizeDebt, 300000);

app.get('/liabilities', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM liabilities");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'DB Fetch Failed' });
    }
});

app.listen(PORT, () => {
    console.log(`🤵 Debt Management Service (CFO Agent) active on port ${PORT}`);
});
