#!/usr/bin/env node

// Comprehensive Frontend-Backend Filter Communication Test
// Tests all reported broken scenarios plus edge cases
import http from 'http';

const BASE_URL = 'http://localhost:5000';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'x-user-id': 'test_comprehensive_filters' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

class FilterTestRunner {
  constructor() {
    this.results = [];
    this.totalTests = 0;
    this.passedTests = 0;
  }

  async runTest(name, testFn) {
    this.totalTests++;
    try {
      console.log(`\n🧪 ${name}...`);
      const result = await testFn();
      if (result.passed) {
        console.log(`✅ PASS: ${result.message}`);
        this.passedTests++;
        this.results.push({ name, status: 'PASS', message: result.message });
      } else {
        console.log(`❌ FAIL: ${result.message}`);
        this.results.push({ name, status: 'FAIL', message: result.message });
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
      this.results.push({ name, status: 'ERROR', message: error.message });
    }
  }

  printSummary() {
    const failed = this.totalTests - this.passedTests;
    console.log('\n' + '='.repeat(60));
    console.log('📊 COMPREHENSIVE FILTER TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${this.passedTests}/${this.totalTests}`);
    console.log(`❌ Failed: ${failed}/${this.totalTests}`);
    console.log(`📈 Success Rate: ${Math.round((this.passedTests / this.totalTests) * 100)}%`);

    if (failed > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results.filter(r => r.status !== 'PASS').forEach(r => {
        console.log(`  - ${r.name}: ${r.status} (${r.message})`);
      });
    }

    if (this.passedTests === this.totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Frontend-Backend communication is working!');
    } else {
      console.log('\n⚠️ Some tests failed. Frontend-Backend communication needs fixes.');
    }
  }
}

async function runComprehensiveFilterTests() {
  const runner = new FilterTestRunner();
  
  console.log('🚀 COMPREHENSIVE FILTER COMMUNICATION TEST');
  console.log('Testing with Jorn, God of Winter as Commander (U/B/G identity)');
  console.log('Testing all reported broken scenarios + edge cases\n');

  // First, set Jorn, God of Winter as commander to simulate real frontend behavior
  console.log('🔧 Setting up test environment with Jorn, God of Winter as commander...');
  
  // Find Jorn, God of Winter specifically
  const jornSearch = await makeRequest('/api/cards/search?query=Jorn%20God%20of%20Winter&limit=5');
  if (jornSearch.status !== 200 || !jornSearch.data.data) {
    console.log('❌ Could not find Jorn, God of Winter');
    return;
  }
  
  const jornCard = jornSearch.data.data.find(card => 
    card.name.includes('Jorn') && card.name.includes('God of Winter')
  );
  
  if (!jornCard) {
    console.log('❌ Could not find Jorn, God of Winter in search results');
    console.log('Available cards:', jornSearch.data.data.map(c => c.name));
    return;
  }
  
  console.log(`✅ Found Jorn: ${jornCard.name} (ID: ${jornCard.id})`);
  console.log(`   Color Identity: [${jornCard.color_identity.join(',')}]`);
  
  // Store Jorn's color identity for validation
  const jornColors = jornCard.color_identity; // Should be ['U', 'B', 'G']

  // === COLOR FILTER TESTS WITH COMMANDER IDENTITY ===
  await runner.runTest('Single Color Filter (Black) - With Jorn Commander', async () => {
    const filters = JSON.stringify({ 
      colors: ['B'],
      colorIdentity: jornColors // This should restrict to Jorn's U/B/G identity
    });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const nonBlackCards = cards.filter(card => !card.color_identity.includes('B'));
    const outsideJornIdentity = cards.filter(card => 
      !card.color_identity.every(color => jornColors.includes(color))
    );
    
    return {
      passed: nonBlackCards.length === 0 && outsideJornIdentity.length === 0,
      message: `${cards.length} cards, ${nonBlackCards.length} without Black, ${outsideJornIdentity.length} outside Jorn identity`
    };
  });

  await runner.runTest('Multiple Color Filter (Red + Green)', async () => {
    const filters = JSON.stringify({ colors: ['R', 'G'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.color_identity.includes('R') && card.color_identity.includes('G')
    );
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} have both R+G`
    };
  });

  await runner.runTest('Colorless Filter', async () => {
    const filters = JSON.stringify({ colors: [] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const colorlessCards = cards.filter(card => card.color_identity.length === 0);
    
    return {
      passed: colorlessCards.length === cards.length,
      message: `${cards.length} cards, ${colorlessCards.length} colorless`
    };
  });

  // === TYPE FILTER TESTS (AND LOGIC) ===
  await runner.runTest('Type Filter - Instant AND Creature (Adventure cards)', async () => {
    const filters = JSON.stringify({ types: ['instant', 'creature'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => {
      const typeLine = card.type_line.toLowerCase();
      return typeLine.includes('instant') && typeLine.includes('creature');
    });
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} have both Instant+Creature`
    };
  });

  await runner.runTest('Type Filter - Artifact AND Creature', async () => {
    const filters = JSON.stringify({ types: ['artifact', 'creature'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => {
      const typeLine = card.type_line.toLowerCase();
      return typeLine.includes('artifact') && typeLine.includes('creature');
    });
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} have both Artifact+Creature`
    };
  });

  await runner.runTest('Single Type Filter - Planeswalker', async () => {
    const filters = JSON.stringify({ types: ['planeswalker'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.type_line.toLowerCase().includes('planeswalker')
    );
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} planeswalkers`
    };
  });

  // === RARITY FILTER TESTS ===
  await runner.runTest('Rarity Filter - Mythic', async () => {
    const filters = JSON.stringify({ rarities: ['mythic'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const mythicCards = cards.filter(card => card.rarity === 'mythic');
    
    return {
      passed: mythicCards.length === cards.length,
      message: `${cards.length} cards, ${mythicCards.length} mythic rarity`
    };
  });

  await runner.runTest('Multiple Rarity Filter - Rare + Mythic', async () => {
    const filters = JSON.stringify({ rarities: ['rare', 'mythic'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.rarity === 'rare' || card.rarity === 'mythic'
    );
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} rare/mythic`
    };
  });

  // === MANA VALUE FILTER TESTS ===
  await runner.runTest('Mana Value Range - 3 to 5', async () => {
    const filters = JSON.stringify({ minMv: 3, maxMv: 5 });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => card.cmc >= 3 && card.cmc <= 5);
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} CMC 3-5`
    };
  });

  await runner.runTest('Minimum Mana Value - 7+', async () => {
    const filters = JSON.stringify({ minMv: 7 });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => card.cmc >= 7);
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} CMC 7+`
    };
  });

  // === COMBINED FILTER TESTS (Most Complex) ===
  await runner.runTest('Combined: Black + Creature + CMC 3-4', async () => {
    const filters = JSON.stringify({ 
      colors: ['B'], 
      types: ['creature'], 
      minMv: 3, 
      maxMv: 4 
    });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.color_identity.includes('B') &&
      card.type_line.toLowerCase().includes('creature') &&
      card.cmc >= 3 && card.cmc <= 4
    );
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} match all criteria`
    };
  });

  await runner.runTest('Combined: Red+Green + Instant + Rare', async () => {
    const filters = JSON.stringify({ 
      colors: ['R', 'G'], 
      types: ['instant'], 
      rarities: ['rare'] 
    });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.color_identity.includes('R') &&
      card.color_identity.includes('G') &&
      card.type_line.toLowerCase().includes('instant') &&
      card.rarity === 'rare'
    );
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} match all criteria`
    };
  });

  // === COMMANDER IDENTITY TESTS ===
  await runner.runTest('Color Identity Filter - Boros (R,W)', async () => {
    const filters = JSON.stringify({ colorIdentity: ['R', 'W'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => {
      const cardColors = card.color_identity;
      return cardColors.every(color => ['R', 'W'].includes(color)) &&
             cardColors.length <= 2;
    });
    
    return {
      passed: validCards.length === cards.length,
      message: `${cards.length} cards, ${validCards.length} within Boros identity`
    };
  });

  // === EDGE CASES ===
  await runner.runTest('Empty Filter Object', async () => {
    const filters = JSON.stringify({});
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    return {
      passed: result.status === 200 && result.data.data && result.data.data.length > 0,
      message: `${result.status === 200 ? 'Success' : 'Failed'} - returns all cards`
    };
  });

  await runner.runTest('Invalid Color Code', async () => {
    const filters = JSON.stringify({ colors: ['X', 'Y'] });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    return {
      passed: result.status === 200 && result.data.data && result.data.data.length === 0,
      message: `${result.status === 200 ? 'Success' : 'Failed'} - returns no cards for invalid colors`
    };
  });

  await runner.runTest('Very Specific Query - No Results Expected', async () => {
    const filters = JSON.stringify({ 
      colors: ['W', 'U', 'B', 'R', 'G'], 
      types: ['planeswalker', 'artifact'], 
      minMv: 15,
      rarities: ['common'] 
    });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=5`);
    
    return {
      passed: result.status === 200 && result.data.data && result.data.data.length === 0,
      message: `${result.status === 200 ? 'Success' : 'Failed'} - no results for impossible criteria`
    };
  });

  // === TEXT SEARCH TESTS ===
  await runner.runTest('Oracle Text Search - "Flying"', async () => {
    const filters = JSON.stringify({ oracleText: 'Flying' });
    const result = await makeRequest(`/api/cards/search?filters=${encodeURIComponent(filters)}&limit=10`);
    
    if (result.status !== 200 || !result.data.data) {
      return { passed: false, message: `API error: ${result.status}` };
    }
    
    const cards = result.data.data;
    const validCards = cards.filter(card => 
      card.oracle_text && card.oracle_text.toLowerCase().includes('flying')
    );
    
    return {
      passed: validCards.length > 0,
      message: `${cards.length} cards, ${validCards.length} contain "Flying"`
    };
  });

  runner.printSummary();
}

// Run the comprehensive test suite
runComprehensiveFilterTests().catch(console.error);