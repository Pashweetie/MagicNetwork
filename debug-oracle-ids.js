import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { cards } from './shared/schema.js';
import { sql, isNotNull, isNull } from 'drizzle-orm';

async function debugOracleIds() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  try {
    console.log('🔍 Checking oracle_id distribution in database...\n');

    // Count total cards
    const totalResult = await db.select({ count: sql`count(*)` }).from(cards);
    const totalCards = totalResult[0]?.count || 0;
    console.log(`📊 Total cards in database: ${totalCards}`);

    // Count cards with non-null oracle_id
    const nonNullResult = await db.select({ count: sql`count(*)` }).from(cards).where(isNotNull(cards.oracleId));
    const nonNullCount = nonNullResult[0]?.count || 0;
    console.log(`✅ Cards with oracle_id: ${nonNullCount}`);

    // Count cards with null oracle_id
    const nullResult = await db.select({ count: sql`count(*)` }).from(cards).where(isNull(cards.oracleId));
    const nullCount = nullResult[0]?.count || 0;
    console.log(`❌ Cards with NULL oracle_id: ${nullCount}`);

    // Get some examples of cards with oracle_id
    console.log('\n🎯 Sample cards WITH oracle_id:');
    const withOracleId = await db.select({
      id: cards.id,
      name: cards.name,
      oracleId: cards.oracleId,
      setCode: cards.setCode
    }).from(cards).where(isNotNull(cards.oracleId)).limit(3);

    withOracleId.forEach(card => {
      console.log(`  ${card.name} (${card.setCode}) - oracle_id: ${card.oracleId}`);
    });

    // Get some examples of cards without oracle_id
    console.log('\n❌ Sample cards WITHOUT oracle_id:');
    const withoutOracleId = await db.select({
      id: cards.id,
      name: cards.name,
      oracleId: cards.oracleId,
      setCode: cards.setCode,
      layout: cards.layout,
      digital: cards.digital
    }).from(cards).where(isNull(cards.oracleId)).limit(5);

    withoutOracleId.forEach(card => {
      console.log(`  ${card.name} (${card.setCode}) - layout: ${card.layout}, digital: ${card.digital}`);
    });

    console.log(`\n📈 Oracle ID Coverage: ${((nonNullCount / totalCards) * 100).toFixed(1)}%`);
    
    if (nullCount > 0) {
      console.log('\n⚠️  PROBLEM: Cards without oracle_id will break deduplication logic!');
      console.log('   This is likely causing the infinite loop issue.');
    }

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await client.end();
  }
}

debugOracleIds().catch(console.error);