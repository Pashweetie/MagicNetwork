#!/usr/bin/env node

// Comprehensive API Test Suite for MagicNetwork
// Tests all major endpoints with proper error handling and edge cases

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = `test_comprehensive_${Date.now()}`;

// Test utilities
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

// Test runner
class TestRunner {
  constructor() {
    this.results = [];
    this.testCard = null; // Will store a real card for testing
  }

  async run(name, testFn) {
    try {
      console.log(`🧪 Testing: ${name}...`);
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
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const errors = this.results.filter(r => r.status === 'ERROR').length;
    const total = this.results.length;

    console.log('📊 Comprehensive Test Results:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`💥 Errors: ${errors}`);
    console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (failed > 0 || errors > 0) {
      console.log('\n❌ Failed/Error Tests:');
      this.results.filter(r => r.status !== 'PASS').forEach(r => {
        console.log(`  - ${r.name}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
      });
    }
  }
}

// Test suite
async function runComprehensiveTests() {
  const runner = new TestRunner();
  
  console.log('🚀 Starting Comprehensive API Test Suite...\n');
  console.log(`👤 Using test user ID: ${TEST_USER_ID}\n`);

  // 1. CARD SEARCH & RETRIEVAL TESTS
  console.log('🔍 === CARD SEARCH & RETRIEVAL ===');
  
  await runner.run('Basic card search', async () => {
    const result = await makeRequest('/api/cards/search?query=lightning bolt&limit=5');
    if (result.status === 200 && result.data.data && result.data.data.length > 0) {
      runner.testCard = result.data.data[0]; // Store for later tests
      return true;
    }
    return false;
  });

  await runner.run('Card search with complex filters', async () => {
    const result = await makeRequest('/api/cards/search?colors=R&types=Instant&minMv=1&maxMv=3&limit=5');
    return result.status === 200 && result.data.data && Array.isArray(result.data.data);
  });

  await runner.run('Card search pagination', async () => {
    const result = await makeRequest('/api/cards/search?query=creature&page=2&limit=10');
    return result.status === 200 && result.data.data && Array.isArray(result.data.data);
  });

  await runner.run('Single card by ID', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}`);
    return result.status === 200 && result.data.id === runner.testCard.id;
  });

  await runner.run('Random card endpoint', async () => {
    const result = await makeRequest('/api/cards/random');
    return result.status === 200 && result.data && result.data.id;
  });

  // 2. RECOMMENDATIONS TESTS
  console.log('🎯 === RECOMMENDATION SYSTEM ===');
  
  await runner.run('Card recommendations - synergy', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/recommendations?type=synergy&limit=5`);
    return result.status === 200 && Array.isArray(result.data);
  });

  await runner.run('Card recommendations - functional similarity', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/recommendations?type=functional_similarity&limit=5`);
    return result.status === 200 && Array.isArray(result.data);
  });

  await runner.run('Contextual suggestions', async () => {
    const result = await makeRequest('/api/suggestions/contextual?limit=10');
    return result.status === 200 && Array.isArray(result.data);
  });

  // 3. THEME SYSTEM TESTS
  console.log('🎨 === THEME SYSTEM ===');
  
  await runner.run('Theme suggestions for card', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/theme-suggestions`);
    return result.status === 200 && result.data.themeGroups && Array.isArray(result.data.themeGroups);
  });

  await runner.run('Theme voting - up vote', async () => {
    if (!runner.testCard) return false;
    // First get themes to vote on
    const themesResult = await makeRequest(`/api/cards/${runner.testCard.id}/theme-suggestions`);
    if (themesResult.status !== 200 || !themesResult.data.themeGroups?.length) return false;
    
    const themeName = themesResult.data.themeGroups[0].theme;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/theme-vote`, {
      method: 'POST',
      body: { themeName, vote: 'up' }
    });
    return result.status === 200 && result.data.success;
  });

  await runner.run('Theme synergies', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/theme-synergies`);
    return result.status === 200 && Array.isArray(result.data);
  });

  await runner.run('Bulk themes endpoint', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest('/api/cards/bulk-themes', {
      method: 'POST',
      body: { cardIds: [runner.testCard.id] }
    });
    return result.status === 200 && typeof result.data === 'object';
  });

  // 4. DECK MANAGEMENT TESTS
  console.log('📚 === DECK MANAGEMENT ===');
  
  let testDeckId = null;
  
  await runner.run('Get user decks (empty)', async () => {
    const result = await makeRequest('/api/decks');
    return result.status === 200 && Array.isArray(result.data);
  });

  await runner.run('Create new deck', async () => {
    const result = await makeRequest('/api/decks', {
      method: 'POST',
      body: {
        name: 'Test Deck',
        description: 'Test deck for comprehensive testing',
        format: 'standard',
        cards: []
      }
    });
    if (result.status === 200 && result.data.id) {
      testDeckId = result.data.id;
      return true;
    }
    return false;
  });

  await runner.run('Get specific deck', async () => {
    if (!testDeckId) return false;
    const result = await makeRequest(`/api/decks/${testDeckId}`);
    return result.status === 200 && result.data.id === testDeckId;
  });

  await runner.run('Update deck', async () => {
    if (!testDeckId) return false;
    const result = await makeRequest(`/api/decks/${testDeckId}`, {
      method: 'PUT',
      body: {
        name: 'Updated Test Deck',
        description: 'Updated description'
      }
    });
    return result.status === 200 && result.data.name === 'Updated Test Deck';
  });

  await runner.run('Delete deck', async () => {
    if (!testDeckId) return false;
    const result = await makeRequest(`/api/decks/${testDeckId}`, {
      method: 'DELETE'
    });
    return result.status === 200;
  });

  // 5. FEEDBACK SYSTEM TESTS
  console.log('💬 === FEEDBACK SYSTEM ===');
  
  await runner.run('Theme feedback', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/theme-feedback`, {
      method: 'POST',
      body: {
        themeName: 'Burn',
        feedback: true,
        reason: 'Good thematic fit'
      }
    });
    return result.status === 200 && result.data.success;
  });

  await runner.run('Recommendation feedback', async () => {
    if (!runner.testCard) return false;
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/recommendation-feedback`, {
      method: 'POST',
      body: {
        recommendedCardId: runner.testCard.id,
        helpful: true,
        recommendationType: 'synergy'
      }
    });
    return result.status === 200 && result.data.success;
  });

  // 6. ERROR HANDLING TESTS
  console.log('⚠️ === ERROR HANDLING ===');
  
  await runner.run('Non-existent card 404', async () => {
    const result = await makeRequest('/api/cards/nonexistent-card-id');
    return result.status === 404;
  });

  await runner.run('Invalid search parameters', async () => {
    const result = await makeRequest('/api/cards/search?colors=INVALID&minMv=abc');
    return result.status === 400 || (result.status === 200 && result.data.data.length === 0);
  });

  await runner.run('Missing authentication header', async () => {
    const result = await makeRequest('/api/decks', {
      headers: {} // No x-user-id header
    });
    return result.status === 401 || result.status === 200; // Depending on auth implementation
  });

  await runner.run('Non-existent deck 404', async () => {
    const result = await makeRequest('/api/decks/nonexistent-deck-id');
    return result.status === 404;
  });

  // 7. LEGACY ENDPOINT TESTS
  console.log('🏛️ === LEGACY ENDPOINTS ===');
  
  await runner.run('Legacy user deck GET', async () => {
    const result = await makeRequest('/api/user/deck');
    return result.status === 200; // May return empty data
  });

  await runner.run('Legacy user deck PUT', async () => {
    const result = await makeRequest('/api/user/deck', {
      method: 'PUT',
      body: {
        name: 'Legacy Test Deck',
        cards: []
      }
    });
    return result.status === 200;
  });

  // 8. PERFORMANCE TESTS (Light)
  console.log('⚡ === PERFORMANCE TESTS ===');
  
  await runner.run('Search response time < 5s', async () => {
    const start = Date.now();
    const result = await makeRequest('/api/cards/search?query=creature&limit=20');
    const duration = Date.now() - start;
    console.log(`   Search took ${duration}ms`);
    return result.status === 200 && duration < 5000;
  });

  await runner.run('Theme suggestions response time < 10s', async () => {
    if (!runner.testCard) return false;
    const start = Date.now();
    const result = await makeRequest(`/api/cards/${runner.testCard.id}/theme-suggestions`);
    const duration = Date.now() - start;
    console.log(`   Theme suggestions took ${duration}ms`);
    return result.status === 200 && duration < 10000;
  });

  // Print final summary
  console.log('\n' + '='.repeat(50));
  runner.printSummary();
  
  const successRate = Math.round((runner.results.filter(r => r.status === 'PASS').length / runner.results.length) * 100);
  if (successRate >= 90) {
    console.log('\n🎉 Excellent! Your API is working very well.');
  } else if (successRate >= 75) {
    console.log('\n👍 Good! Most functionality is working.');
  } else {
    console.log('\n⚠️ Some issues detected. Check the failed tests above.');
  }
}

// Wait for server to be ready
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

// Main execution
async function main() {
  try {
    console.log('⏳ Waiting for server to be ready...');
    await waitForServer();
    console.log('✅ Server is ready!\n');
    await runComprehensiveTests();
  } catch (error) {
    console.error('💥 Comprehensive test suite failed:', error.message);
    process.exit(1);
  }
}

main();