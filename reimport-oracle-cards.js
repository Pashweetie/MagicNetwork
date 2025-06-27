import { readFileSync } from 'fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';
import ws from "ws";

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
  console.log('⚠️  No .env file found');
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function reimportOracleCards() {
  try {
    console.log('🗑️  Clearing existing cards...');
    
    // Clear existing cards
    await db.execute(sql`DELETE FROM cards`);
    console.log('✅ Cleared all existing cards');
    
    // Check current count
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM cards`);
    console.log(`📊 Cards in database: ${countResult.rows[0].count}`);
    
    console.log('\n🔄 Starting fresh import from oracle_cards...');
    console.log('⚠️  This will take several minutes...');
    
    // Import the oracle cards using the same service
    const { cardDatabaseService } = await import('./server/services/card-database-service.js');
    await cardDatabaseService.downloadAllCards();
    
    // Check final count
    const finalCount = await db.execute(sql`SELECT COUNT(*) as count FROM cards`);
    const oracleIdCount = await db.execute(sql`SELECT COUNT(oracle_id) as count FROM cards WHERE oracle_id IS NOT NULL`);
    
    console.log('\n📊 Import complete!');
    console.log(`Total cards: ${finalCount.rows[0].count}`);
    console.log(`Cards with oracle_id: ${oracleIdCount.rows[0].count}`);
    console.log(`Oracle ID coverage: ${((oracleIdCount.rows[0].count / finalCount.rows[0].count) * 100).toFixed(1)}%`);
    
    if (oracleIdCount.rows[0].count > 0) {
      console.log('✅ SUCCESS: Oracle IDs are now preserved!');
      console.log('🔄 The infinite loop should be fixed');
    } else {
      console.log('❌ PROBLEM: Still no oracle_ids after import');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await pool.end();
  }
}

console.log('🚀 Re-importing deduplicated oracle cards...');
console.log('This will:');
console.log('  1. Clear all existing cards (~95k)'); 
console.log('  2. Import fresh oracle_cards dataset (~35k)');
console.log('  3. Preserve oracle_id values');
console.log('  4. Fix the infinite loop issue');
console.log('');

reimportOracleCards();