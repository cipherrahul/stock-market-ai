import express from 'express';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Run backtest
app.post('/api/v1/backtesting/run', async (req, res) => {
  try {
    const { strategy, startDate, endDate, initialCapital, symbol } = req.body;

    // Fetch historical data
    const result = await pool.query(
      'SELECT * FROM market_history WHERE symbol = $1 AND date BETWEEN $2 AND $3 ORDER BY date',
      [symbol, startDate, endDate]
    );

    const data = result.rows;

    // Advanced Strategy Simulation (Mirroring AI Ensemble)
    let capital = initialCapital;
    let position = 0; // Current quantity held
    let trades = [];
    let equityCurve = [initialCapital];

    // Helper: Simple Moving Average
    const getSMA = (prices: number[], period: number) => {
      if (prices.length < period) return null;
      const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
      return sum / period;
    };

    // Helper: RSI
    const getRSI = (prices: number[], period: number = 14) => {
      if (prices.length <= period) return 50;
      let gains = 0;
      let losses = 0;
      for (let i = prices.length - period; i < prices.length; i++) {
        const diff = prices[i] - prices[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
      }
      if (losses === 0) return 100;
      const rs = gains / losses;
      return 100 - (100 / (1 + rs));
    };

    const priceHistory: number[] = [];

    for (let i = 0; i < data.length; i++) {
      const curr = data[i];
      priceHistory.push(curr.price);
      
      const sma20 = getSMA(priceHistory, 20);
      const sma50 = getSMA(priceHistory, 50);
      const rsi = getRSI(priceHistory, 14);

      // Signal Logic
      let signal = 'HOLD';
      if (sma20 && sma50) {
        if (sma20 > sma50 * 1.005 && rsi < 70) signal = 'BUY';
        else if (sma20 < sma50 * 0.995 || rsi > 80) signal = 'SELL';
      }

      if (signal === 'BUY' && position === 0) {
        // Buy full position
        const quantity = Math.floor(capital / curr.price);
        if (quantity > 0) {
          position = quantity;
          capital -= quantity * curr.price;
          trades.push({ type: 'BUY', price: curr.price, quantity, date: curr.date });
        }
      } else if (signal === 'SELL' && position > 0) {
        // Sell entire position
        capital += position * curr.price;
        trades.push({ type: 'SELL', price: curr.price, quantity: position, date: curr.date });
        position = 0;
      }

      const currentEquity = capital + (position * curr.price);
      equityCurve.push(currentEquity);
    }

    // Finalize if still holding
    if (position > 0) {
      capital += position * data[data.length - 1].price;
      position = 0;
    }

    const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
    
    // Performance Metrics Calculation
    const returnsArray = [];
    for(let i=1; i<equityCurve.length; i++) {
        returnsArray.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
    }
    const avgReturn = returnsArray.reduce((p,c) => p+c, 0) / returnsArray.length;
    const stdDev = Math.sqrt(returnsArray.map(x => Math.pow(x - avgReturn, 2)).reduce((a,b) => a+b) / returnsArray.length);
    const sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev) * Math.sqrt(252); // Annualized

    let peak = -Infinity;
    let maxDrawdown = 0;
    for (const val of equityCurve) {
        if (val > peak) peak = val;
        const dd = (peak - val) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    res.json({
      strategy,
      symbol,
      startDate,
      endDate,
      initialCapital,
      finalCapital: capital,
      totalReturn: totalReturn.toFixed(2) + '%',
      totalTrades: trades.length,
      sharpeRatio: sharpeRatio.toFixed(2),
      maxDrawdown: (maxDrawdown * 100).toFixed(2) + '%',
      trades: trades.slice(-10), // Return last 10 trades
    });
  } catch (error) {
    res.status(500).json({ error: 'Backtest failed' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'backtesting-service' });
});

app.listen(process.env.PORT || 3008, () => {
  console.log(`Backtesting Service on port ${process.env.PORT || 3008}`);
});
