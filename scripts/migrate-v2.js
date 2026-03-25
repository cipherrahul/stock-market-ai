#!/usr/bin/env node
/**
 * Migration v2.1 - Add Shadow Trading and AI Memo support
 * Usage: node scripts/migrate-v2.js
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  console.log('\n🔧 Running Migration v2.1: Shadow Trading & AI Memos\n');

  const config = {
    host: 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'trading_user',
    password: process.env.DB_PASSWORD || 'SecurePass123',
    database: process.env.DB_NAME || 'trading_platform',
  };

  const pool = new Pool(config);

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database\n');

    // 1. Add is_paper to portfolios
    console.log('📊 Updating portfolios table...');
    await client.query(`
      ALTER TABLE portfolios 
      ADD COLUMN IF NOT EXISTS is_paper BOOLEAN DEFAULT FALSE;
    `);
    
    // 2. Add columns to orders
    console.log('📦 Updating orders table...');
    await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS memo TEXT,
      ADD COLUMN IF NOT EXISTS is_paper BOOLEAN DEFAULT FALSE;
    `);

    // 3. Add is_paper to portfolio_history
    console.log('📈 Updating portfolio_history table...');
    await client.query(`
      ALTER TABLE portfolio_history 
      ADD COLUMN IF NOT EXISTS is_paper BOOLEAN DEFAULT FALSE;
    `);

    console.log('\n✨ Migration v2.1 complete!\n');
    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
