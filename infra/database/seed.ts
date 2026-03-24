/**
 * Database Seed Script - Initialize with Sample Data
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

async function seedDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'trading_user',
    password: process.env.DB_PASSWORD || 'SecurePass123',
    database: process.env.DB_NAME || 'trading_platform',
  });

  try {
    console.log('🌱 Starting database seeding...');

    // Create sample user
    const hashedPassword = await bcrypt.hash('Demo@123456', 10);
    await pool.query(
      `INSERT INTO users (email, password, name, role, preferences, risk_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        'demo@tradepro.com',
        hashedPassword,
        'Demo User',
        'user',
        JSON.stringify({ notifications: true }),
        'medium',
      ]
    );
    console.log('✅ Sample user created');

    // Insert sample market history
    const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICI'];
    for (const symbol of symbols) {
      for (let i = 0; i < 30; i++) {
        const price = 2000 + Math.random() * 1000;
        await pool.query(
          `INSERT INTO market_history (time, symbol, price, open_price, high_price, low_price, volume)
           VALUES (NOW() - INTERVAL '1 day' * $1, $2, $3, $4, $5, $6, $7)`,
          [
            i,
            symbol,
            price,
            price * 0.98,
            price * 1.05,
            price * 0.95,
            Math.floor(Math.random() * 1000000),
          ]
        );
      }
    }
    console.log('✅ Market history seeded');

    // Insert sample AI signals
    for (const symbol of symbols) {
      await pool.query(
        `INSERT INTO ai_signals (symbol, signal, confidence, price_target, reasoning)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          symbol,
          Math.random() > 0.5 ? 'BUY' : 'SELL',
          Math.random() * 0.3 + 0.6,
          2000 + Math.random() * 1000,
          'Technical analysis based on SMA/RSI/MACD',
        ]
      );
    }
    console.log('✅ AI signals seeded');

    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pool.end();
  }
}

// Run seeding
seedDatabase();
