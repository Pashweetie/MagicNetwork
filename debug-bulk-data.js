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
  console.log('⚠️  No .env file found');
}

const SCRYFALL_BULK_API = "https://api.scryfall.com/bulk-data";

async function debugBulkData() {
  try {
    console.log('🔍 Fetching Scryfall bulk data info...');
    
    const bulkResponse = await fetch(SCRYFALL_BULK_API);
    const bulkData = await bulkResponse.json();
    
    console.log('\n📋 Available bulk data types:');
    bulkData.data.forEach(item => {
      console.log(`  - ${item.type}: ${item.name} (${Math.round((item.compressed_size || 0) / 1024 / 1024)}MB)`);
    });
    
    // Simulate the same logic as our import
    let cardsData = bulkData.data.find(item => item.type === 'oracle_cards');
    if (!cardsData) {
      cardsData = bulkData.data.find(item => item.type === 'default_cards');
    }
    
    console.log(`\n🎯 Our code would select: ${cardsData.type}`);
    console.log(`📥 Download URL: ${cardsData.download_uri}`);
    
    // Test a few cards from this data source
    console.log('\n🧪 Testing first few cards from selected data source...');
    const response = await fetch(cardsData.download_uri);
    const text = await response.text();
    
    // Parse first few cards
    const jsonData = JSON.parse(text);
    console.log(`📊 Total cards in bulk data: ${jsonData.length}`);
    
    // Check first 3 cards for oracle_id
    console.log('\n🎴 Sample cards from bulk data:');
    for (let i = 0; i < Math.min(3, jsonData.length); i++) {
      const card = jsonData[i];
      console.log(`  ${i + 1}. ${card.name} (${card.set})`);
      console.log(`     ID: ${card.id}`);
      console.log(`     Oracle ID: ${card.oracle_id || 'NULL'}`);
      console.log(`     Layout: ${card.layout}`);
      console.log(`     Digital: ${card.digital}`);
      console.log('');
    }
    
    // Count cards with/without oracle_id in bulk data
    const withOracleId = jsonData.filter(card => card.oracle_id).length;
    const totalCards = jsonData.length;
    console.log(`📈 Oracle ID coverage in bulk data: ${withOracleId}/${totalCards} (${((withOracleId / totalCards) * 100).toFixed(1)}%)`);
    
    if (withOracleId === 0) {
      console.log('❌ PROBLEM: Bulk data source has no oracle_id values!');
    } else if (withOracleId < totalCards) {
      console.log('⚠️  Some cards in bulk data are missing oracle_id');
    } else {
      console.log('✅ All cards in bulk data have oracle_id - import process issue');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugBulkData();