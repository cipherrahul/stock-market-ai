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

    // 2026 AUDIT: REMOVED SYNTHETIC HISTORY GENERATION
    // Platform now depends on live data ingest from day zero.
    console.log('ℹ️  Skipping synthetic history/signal generation (Real-time Only Mode)');

    console.log('🎉 Database seeding completed!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pool.end();
  }
}

// Run seeding
seedDatabase();
