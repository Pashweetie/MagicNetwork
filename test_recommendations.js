#!/usr/bin/env node

// Comprehensive recommendation testing script
const testCards = [
  // Different color identities and archetypes
  { id: '2a83882c-3e03-4e85-aaac-97fa1d08a772', name: 'Aarakocra Sneak', colors: ['W'] },
  { id: '1eddb834-ea01-44e2-afca-bd9a4ebbdb94', name: 'Abominable Treefolk', colors: ['G'] },
  { id: '23b587f3-5eac-45a7-a048-dd73d2a2b74f', name: 'Abandoned Sarcophagus', colors: [] },
  { id: 'fbdaa29b-85ff-4a06-b27e-fcdbdfd4a3fe', name: 'Lightning Bolt', colors: ['R'] },
  { id: '7f1cb6d0-c8bb-4c5a-b445-8b56e8cdbb64', name: 'Counterspell', colors: ['U'] },
  { id: 'c88d2428-0c20-43b2-8a99-ab4e6a82c2d7', name: 'Dark Ritual', colors: ['B'] },
];

const testFilters = [
  { description: 'Red only', colors: ['R'] },
  { description: 'Blue only', colors: ['U'] },
  { description: 'Green only', colors: ['G'] },
  { description: 'White only', colors: ['W'] },
  { description: 'Black only', colors: ['B'] },
  { description: 'Red/White', colors: ['R', 'W'] },
  { description: 'Blue/Green', colors: ['U', 'G'] },
  { description: 'Black/Red', colors: ['B', 'R'] },
  { description: 'No colors (artifacts)', colors: [] },
];

async function testRecommendation(cardId, cardName, type, filter) {
  try {
    const filterParam = filter ? `&filters=${encodeURIComponent(JSON.stringify(filter))}` : '';
    const url = `http://localhost:5000/api/cards/${cardId}/recommendations?type=${type}&limit=5${filterParam}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return {
      count: data.length,
      cards: data.map(rec => ({
        name: rec.card?.name || 'Unknown',
        colors: rec.card?.colors || [],
        colorIdentity: rec.card?.color_identity || [],
        score: rec.score,
        reason: rec.reason
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

async function runComprehensiveTest() {
  console.log('🧪 COMPREHENSIVE RECOMMENDATION TESTING\n');
  
  const results = {
    synergy: { success: 0, failed: 0, filtered: 0 },
    similarity: { success: 0, failed: 0, filtered: 0 },
    theme: { success: 0, failed: 0, filtered: 0 }
  };
  
  for (const card of testCards) {
    console.log(`\n📋 Testing: ${card.name} (${card.colors.join('') || 'Colorless'})`);
    console.log('=' .repeat(50));
    
    for (const filter of testFilters) {
      console.log(`\n🎯 Filter: ${filter.description}`);
      
      // Test synergy recommendations
      const synergyResult = await testRecommendation(card.id, card.name, 'synergy', { colors: filter.colors });
      if (synergyResult.error) {
        console.log(`  ❌ Synergy: ERROR - ${synergyResult.error}`);
        results.synergy.failed++;
      } else if (synergyResult.count === 0) {
        console.log(`  ⚠️  Synergy: No results`);
        results.synergy.filtered++;
      } else {
        console.log(`  ✅ Synergy: ${synergyResult.count} results`);
        synergyResult.cards.slice(0, 2).forEach(c => {
          console.log(`     • ${c.name} (${c.colors.join('') || '∅'}) - ${c.reason}`);
        });
        results.synergy.success++;
      }
      
      // Test functional similarity
      const similarResult = await testRecommendation(card.id, card.name, 'functional_similarity', { colors: filter.colors });
      if (similarResult.error) {
        console.log(`  ❌ Similar: ERROR - ${similarResult.error}`);
        results.similarity.failed++;
      } else if (similarResult.count === 0) {
        console.log(`  ⚠️  Similar: No results`);
        results.similarity.filtered++;
      } else {
        console.log(`  ✅ Similar: ${similarResult.count} results`);
        similarResult.cards.slice(0, 2).forEach(c => {
          console.log(`     • ${c.name} (${c.colors.join('') || '∅'}) - ${c.reason}`);
        });
        results.similarity.success++;
      }
      
      // Test theme suggestions
      try {
        const themeResponse = await fetch(`http://localhost:5000/api/cards/${card.id}/theme-suggestions?filters=${encodeURIComponent(JSON.stringify({ colors: filter.colors }))}`);
        if (themeResponse.ok) {
          const themeData = await themeResponse.json();
          if (themeData.length === 0) {
            console.log(`  ⚠️  Themes: No results`);
            results.theme.filtered++;
          } else {
            console.log(`  ✅ Themes: ${themeData.length} theme groups`);
            themeData.slice(0, 1).forEach(theme => {
              console.log(`     • ${theme.theme}: ${theme.cards.length} cards`);
            });
            results.theme.success++;
          }
        } else {
          console.log(`  ❌ Themes: HTTP ${themeResponse.status}`);
          results.theme.failed++;
        }
      } catch (error) {
        console.log(`  ❌ Themes: ERROR - ${error.message}`);
        results.theme.failed++;
      }
    }
  }
  
  console.log('\n\n📊 SUMMARY STATISTICS');
  console.log('=' .repeat(50));
  
  Object.entries(results).forEach(([type, stats]) => {
    const total = stats.success + stats.failed + stats.filtered;
    const successRate = total > 0 ? (stats.success / total * 100).toFixed(1) : '0.0';
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  ✅ Success: ${stats.success}/${total} (${successRate}%)`);
    console.log(`  ❌ Failed:  ${stats.failed}/${total}`);
    console.log(`  ⚠️  Empty:   ${stats.filtered}/${total}`);
  });
  
  // Color identity filtering test
  console.log('\n\n🎨 COLOR IDENTITY FILTERING TEST');
  console.log('=' .repeat(50));
  
  const testCard = testCards[0]; // Use first card
  for (const filter of testFilters.slice(0, 5)) { // Test first 5 filters
    const result = await testRecommendation(testCard.id, testCard.name, 'synergy', { colors: filter.colors });
    if (result.cards) {
      const correctlyFiltered = result.cards.every(card => {
        const cardColors = card.colorIdentity || card.colors || [];
        return filter.colors.length === 0 || 
               filter.colors.some(filterColor => cardColors.includes(filterColor));
      });
      console.log(`${filter.description}: ${correctlyFiltered ? '✅' : '❌'} Filter working`);
      if (!correctlyFiltered) {
        result.cards.forEach(card => {
          console.log(`  • ${card.name}: Colors ${JSON.stringify(card.colors)} vs Filter ${JSON.stringify(filter.colors)}`);
        });
      }
    }
  }
}

// Run the test
runComprehensiveTest().catch(console.error);