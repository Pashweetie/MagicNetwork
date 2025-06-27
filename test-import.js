import { cardDatabaseService } from './server/services/card-database-service.js';

async function testImport() {
  console.log('🧪 Testing oracle_id import...');
  
  try {
    // Get current card count
    const beforeCount = await cardDatabaseService.getCardCount();
    console.log(`📊 Current cards in database: ${beforeCount}`);
    
    // Download fresh data (this will only add new cards, not replace existing)
    console.log('\n🔄 Starting fresh download...');
    await cardDatabaseService.downloadAllCards();
    
    const afterCount = await cardDatabaseService.getCardCount();
    console.log(`📊 Cards after download: ${afterCount}`);
    console.log(`➕ New cards added: ${afterCount - beforeCount}`);
    
  } catch (error) {
    console.error('❌ Test import failed:', error);
  }
}

testImport();