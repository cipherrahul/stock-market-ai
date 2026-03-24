#!/usr/bin/env node
/**
 * Database Setup - Initialize PostgreSQL and run migrations
 * Usage: node scripts/setup-db.js
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function setupDatabase() {
  console.log('\n🔧 Trading Platform Database Setup\n');

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'trading_user',
    password: process.env.DB_PASSWORD || 'trading_password_123',
    database: process.env.DB_NAME || 'trading_platform_dev',
  };

  console.log('📋 Database Configuration:');
  console.log(`  Host: ${config.host}:${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}\n`);

  // Connect to database
  const pool = new Pool(config);

  try {
    console.log('✅ Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Connected successfully\n');

    // Read and execute schema
    console.log('📊 Applying database schema...');
    const schemaPath = path.join(__dirname, '..', 'infra', 'database', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    
    await client.query(schemaSQL);
    console.log('✅ Schema applied successfully\n');

    // Create indexes for performance
    console.log('🏗️  Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);',
      'CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_market_history_symbol ON market_history(symbol, time DESC);',
      'CREATE INDEX IF NOT EXISTS idx_portfolio_history_user ON portfolio_history(user_id, created_at DESC);',
    ];

    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }
    console.log('✅ Indexes created\n');

    // Test connectivity
    console.log('🧪 Testing connectivity...');
    const result = await client.query('SELECT version();');
    console.log(`✅ PostgreSQL version: ${result.rows[0].version.split(',')[0]}\n`);

    client.release();

    console.log('✨ Database setup complete!\n');
    console.log('📝 Next steps:');
    console.log('  1. Run: npm run seed (to add test data)');
    console.log('  2. Start services: npm start\n');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    if (error.message.includes('connect ECONNREFUSED')) {
      console.error('\n💡 Make sure PostgreSQL is running:');
      console.error('   Windows: Services > PostgreSQL > Start');
      console.error('   Or: pg_ctl -D "C:\\Program Files\\PostgreSQL\\15\\data" start');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
