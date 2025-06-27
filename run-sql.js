#!/usr/bin/env node

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";
import { readFileSync } from 'fs';

// Load .env file
try {
  const envFile = readFileSync('.env', 'utf8');
  const envVars = envFile.split('\n').filter(line => line.includes('='));
  envVars.forEach(line => {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  });
} catch (error) {
  console.log('⚠️  No .env file found, using existing environment variables');
}

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in environment');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function runSQL(query) {
  try {
    console.log(`🔍 Executing: ${query}\n`);
    
    const result = await db.execute(sql.raw(query));
    
    if (result.rows && result.rows.length > 0) {
      console.table(result.rows);
    } else {
      console.log('✅ Query executed successfully (no rows returned)');
    }
    
  } catch (error) {
    console.error('❌ SQL Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Get SQL query from command line args
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node run-sql.js "SELECT * FROM cards LIMIT 5"');
  console.log('Example: node run-sql.js "SELECT COUNT(*) FROM cards WHERE oracle_id IS NOT NULL"');
  process.exit(1);
}

runSQL(query);