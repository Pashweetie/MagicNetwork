#!/usr/bin/env node

// Database Schema and Data Validation Tests
// Tests database connectivity, schema integrity, and data quality

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = `test_db_${Date.now()}`;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID,
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

class DatabaseValidator {
  constructor() {
    this.results = [];
    this.sampleCard = null;
  }

  async test(name, testFn) {
    try {
      console.log(`🔍 Validating: ${name}...`);
      const result = await testFn();
      if (result) {
        console.log(`✅ PASS: ${name}`);
        this.results.push({ name, status: 'PASS' });
      } else {
        console.log(`❌ FAIL: ${name}`);
        this.results.push({ name, status: 'FAIL' });
      }
    } catch (error) {
      console.log(`💥 ERROR: ${name} - ${error.message}`);
      this.results.push({ name, status: 'ERROR', error: error.message });
    }
    console.log('');
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const total = this.results.length;
    console.log('📊 Database Validation Results:');
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);
  }
}

async function runDatabaseValidation() {
  const validator = new DatabaseValidator();
  
  console.log('🗄️ Starting Database Validation Tests...\n');

  // 1. DATABASE CONNECTIVITY
  console.log('🔌 === DATABASE CONNECTIVITY ===');
  
  await validator.test('Database connection via card search', async () => {
    const result = await makeRequest('/api/cards/search?query=sol ring&limit=1');
    if (result.status === 200 && result.data.data?.length > 0) {
      validator.sampleCard = result.data.data[0];
      return true;
    }
    return false;
  });

  await validator.test('Database contains expected card count', async () => {
    const result = await makeRequest('/api/cards/search?query=*&limit=1');
    return result.status === 200 && result.data.total_cards > 50000; // Should have many cards
  });

  // 2. CARD DATA INTEGRITY
  console.log('🃏 === CARD DATA INTEGRITY ===');
  
  await validator.test('Card has required fields', async () => {
    if (!validator.sampleCard) return false;
    const card = validator.sampleCard;
    return card.id && card.name && card.type_line && typeof card.cmc === 'number';
  });

  await validator.test('Card prices are properly formatted', async () => {
    if (!validator.sampleCard) return false;
    const card = validator.sampleCard;
    if (card.prices) {
      return typeof card.prices === 'object' && 
             (card.prices.usd === null || typeof card.prices.usd === 'string');
    }
    return true; // Prices might not be available
  });

  await validator.test('Card legalities are properly structured', async () => {
    if (!validator.sampleCard) return false;
    const card = validator.sampleCard;
    if (card.legalities) {
      return typeof card.legalities === 'object' &&
             Object.values(card.legalities).every(v => 
               ['legal', 'not_legal', 'banned', 'restricted'].includes(v)
             );
    }
    return true; // Legalities might not be available
  });

  // 3. SEARCH FUNCTIONALITY
  console.log('🔍 === SEARCH FUNCTIONALITY ===');
  
  await validator.test('Color filter works correctly', async () => {
    const result = await makeRequest('/api/cards/search?colors=R&limit=5');
    if (result.status !== 200 || !result.data.data?.length) return false;
    
    // Check that returned cards actually contain red
    return result.data.data.some(card => 
      card.colors?.includes('R') || card.color_identity?.includes('R')
    );
  });

  await validator.test('Type filter works correctly', async () => {
    const result = await makeRequest('/api/cards/search?types=Creature&limit=5');
    if (result.status !== 200 || !result.data.data?.length) return false;
    
    // Check that returned cards are actually creatures
    return result.data.data.every(card => 
      card.type_line?.toLowerCase().includes('creature')
    );
  });

  await validator.test('CMC filter works correctly', async () => {
    const result = await makeRequest('/api/cards/search?minMv=3&maxMv=3&limit=5');
    if (result.status !== 200 || !result.data.data?.length) return false;
    
    // Check that returned cards have CMC of 3
    return result.data.data.every(card => card.cmc === 3);
  });

  await validator.test('Text search works correctly', async () => {
    const result = await makeRequest('/api/cards/search?oracleText=flying&limit=5');
    if (result.status !== 200 || !result.data.data?.length) return false;
    
    // Check that returned cards mention "flying"
    return result.data.data.some(card => 
      card.oracle_text?.toLowerCase().includes('flying')
    );
  });

  // 4. USER DATA INTEGRITY
  console.log('👤 === USER DATA INTEGRITY ===');
  
  await validator.test('User creation works properly', async () => {
    const result = await makeRequest('/api/decks'); // This should create user if not exists
    return result.status === 200 && Array.isArray(result.data);
  });

  await validator.test('User deck operations maintain integrity', async () => {
    // Create a test deck
    const createResult = await makeRequest('/api/decks', {
      method: 'POST',
      body: {
        name: 'DB Validation Test Deck',
        description: 'Test deck for database validation',
        format: 'standard'
      }
    });
    
    if (createResult.status !== 200 || !createResult.data.id) return false;
    
    const deckId = createResult.data.id;
    
    // Verify deck was created properly
    const getResult = await makeRequest(`/api/decks/${deckId}`);
    if (getResult.status !== 200 || getResult.data.name !== 'DB Validation Test Deck') return false;
    
    // Clean up
    await makeRequest(`/api/decks/${deckId}`, { method: 'DELETE' });
    
    return true;
  });

  // 5. THEME SYSTEM DATA
  console.log('🎨 === THEME SYSTEM DATA ===');
  
  await validator.test('Theme suggestions return structured data', async () => {
    if (!validator.sampleCard) return false;
    const result = await makeRequest(`/api/cards/${validator.sampleCard.id}/theme-suggestions`);
    
    if (result.status !== 200) return false;
    
    const { themeGroups } = result.data;
    if (!Array.isArray(themeGroups)) return false;
    
    // Check structure of theme groups
    return themeGroups.every(group => 
      group.theme && group.description && 
      typeof group.confidence === 'number' &&
      Array.isArray(group.cards)
    );
  });

  await validator.test('Theme voting maintains data consistency', async () => {
    if (!validator.sampleCard) return false;
    
    // Get themes first
    const themesResult = await makeRequest(`/api/cards/${validator.sampleCard.id}/theme-suggestions`);
    if (themesResult.status !== 200 || !themesResult.data.themeGroups?.length) return false;
    
    const themeName = themesResult.data.themeGroups[0].theme;
    
    // Vote up
    const voteResult = await makeRequest(`/api/cards/${validator.sampleCard.id}/theme-vote`, {
      method: 'POST',
      body: { themeName, vote: 'up' }
    });
    
    return voteResult.status === 200 && voteResult.data.success;
  });

  // 6. PERFORMANCE VALIDATION
  console.log('⚡ === PERFORMANCE VALIDATION ===');
  
  await validator.test('Database queries complete in reasonable time', async () => {
    const start = Date.now();
    const result = await makeRequest('/api/cards/search?query=creature&limit=20');
    const duration = Date.now() - start;
    
    console.log(`   Query took ${duration}ms`);
    return result.status === 200 && duration < 5000; // 5 second max
  });

  await validator.test('Complex searches perform adequately', async () => {
    const start = Date.now();
    const result = await makeRequest('/api/cards/search?colors=R,G&types=Creature&minMv=2&maxMv=4&limit=10');
    const duration = Date.now() - start;
    
    console.log(`   Complex query took ${duration}ms`);
    return result.status === 200 && duration < 8000; // 8 second max for complex
  });

  // 7. DATA CONSISTENCY CHECKS
  console.log('🔍 === DATA CONSISTENCY ===');
  
  await validator.test('Card IDs are consistent between endpoints', async () => {
    if (!validator.sampleCard) return false;
    
    const cardId = validator.sampleCard.id;
    const directResult = await makeRequest(`/api/cards/${cardId}`);
    
    if (directResult.status !== 200) return false;
    
    return directResult.data.id === cardId && 
           directResult.data.name === validator.sampleCard.name;
  });

  await validator.test('Search pagination is consistent', async () => {
    const page1 = await makeRequest('/api/cards/search?query=creature&page=1&limit=5');
    const page2 = await makeRequest('/api/cards/search?query=creature&page=2&limit=5');
    
    if (page1.status !== 200 || page2.status !== 200) return false;
    if (!page1.data.data?.length || !page2.data.data?.length) return false;
    
    // Check that page 1 and page 2 have different cards
    const page1Ids = page1.data.data.map(c => c.id);
    const page2Ids = page2.data.data.map(c => c.id);
    
    return !page1Ids.some(id => page2Ids.includes(id)); // No overlap
  });

  // Print summary
  console.log('\n' + '='.repeat(50));
  validator.printSummary();
  
  const successRate = Math.round((validator.results.filter(r => r.status === 'PASS').length / validator.results.length) * 100);
  if (successRate >= 95) {
    console.log('\n🎉 Excellent! Database is in great shape.');
  } else if (successRate >= 85) {
    console.log('\n👍 Good! Database is mostly healthy.');
  } else {
    console.log('\n⚠️ Database issues detected. Review failed tests.');
  }
}

// Wait for server
function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const checkServer = () => {
      makeRequest('/api/cards/search?query=test&limit=1')
        .then(() => resolve())
        .catch(() => {
          if (retries > 0) {
            setTimeout(checkServer, 1000);
            retries--;
          } else {
            reject(new Error('Server did not start in time'));
          }
        });
    };
    checkServer();
  });
}

async function main() {
  try {
    console.log('⏳ Waiting for server to be ready...');
    await waitForServer();
    console.log('✅ Server is ready!\n');
    await runDatabaseValidation();
  } catch (error) {
    console.error('💥 Database validation failed:', error.message);
    process.exit(1);
  }
}

main();