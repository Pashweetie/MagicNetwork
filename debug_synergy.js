#!/usr/bin/env node

// Debug synergy algorithm for specific card
async function debugSynergy() {
  const cardId = '2a83882c-3e03-4e85-aaac-97fa1d08a772'; // Aarakocra Sneak
  
  try {
    console.log('=== DEBUGGING SYNERGY ALGORITHM ===');
    
    // Get the card details first
    const cardResponse = await fetch(`http://localhost:5000/api/cards/${cardId}`);
    const card = await cardResponse.json();
    console.log('Source card:', card.name);
    console.log('Oracle text:', card.oracle_text);
    console.log('Type line:', card.type_line);
    console.log('Colors:', card.colors);
    console.log('Color identity:', card.color_identity);
    
    // Test synergy without filters
    console.log('\n=== SYNERGY WITHOUT FILTERS ===');
    const synergyResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/recommendations?type=synergy&limit=10`);
    const synergyData = await synergyResponse.json();
    console.log('Results:', synergyData.length);
    
    if (synergyData.length > 0) {
      synergyData.slice(0, 3).forEach(rec => {
        console.log(`• ${rec.card.name} (Score: ${rec.score}) - ${rec.reason}`);
      });
    }
    
    // Test with white filter
    console.log('\n=== SYNERGY WITH WHITE FILTER ===');
    const whiteFilterResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/recommendations?type=synergy&limit=10&filters=${encodeURIComponent(JSON.stringify({colors: ['W']}))}`);
    const whiteFilterData = await whiteFilterResponse.json();
    console.log('Results:', whiteFilterData.length);
    
    if (whiteFilterData.length > 0) {
      whiteFilterData.slice(0, 3).forEach(rec => {
        console.log(`• ${rec.card.name} (${rec.card.colors?.join('') || '∅'}) (Score: ${rec.score}) - ${rec.reason}`);
      });
    }
    
    // Compare with functional similarity
    console.log('\n=== FUNCTIONAL SIMILARITY FOR COMPARISON ===');
    const similarResponse = await fetch(`http://localhost:5000/api/cards/${cardId}/recommendations?type=functional_similarity&limit=5`);
    const similarData = await similarResponse.json();
    console.log('Results:', similarData.length);
    
    if (similarData.length > 0) {
      similarData.slice(0, 3).forEach(rec => {
        console.log(`• ${rec.card.name} (Score: ${rec.score}) - ${rec.reason}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSynergy();