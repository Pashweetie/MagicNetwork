#!/usr/bin/env node

async function quickTest() {
  console.log('=== QUICK RECOMMENDATION TEST ===');
  
  const tests = [
    { id: '2a83882c-3e03-4e85-aaac-97fa1d08a772', name: 'Aarakocra Sneak', type: 'synergy' },
    { id: '2a83882c-3e03-4e85-aaac-97fa1d08a772', name: 'Aarakocra Sneak', type: 'functional_similarity' },
    { id: '1eddb834-ea01-44e2-afca-bd9a4ebbdb94', name: 'Abominable Treefolk', type: 'synergy' },
    { id: '23b587f3-5eac-45a7-a048-dd73d2a2b74f', name: 'Abandoned Sarcophagus', type: 'synergy' },
  ];
  
  for (const test of tests) {
    try {
      const response = await fetch(`http://localhost:5000/api/cards/${test.id}/recommendations?type=${test.type}&limit=3`);
      const data = await response.json();
      console.log(`${test.name} (${test.type}): ${data.length} results`);
      
      if (data.length > 0) {
        data.slice(0, 2).forEach(rec => {
          console.log(`  • ${rec.card.name} (${rec.score}) - ${rec.reason}`);
        });
      }
    } catch (error) {
      console.log(`${test.name} (${test.type}): ERROR - ${error.message}`);
    }
  }
  
  // Test color filtering
  console.log('\n=== COLOR FILTERING TEST ===');
  const response = await fetch(`http://localhost:5000/api/cards/2a83882c-3e03-4e85-aaac-97fa1d08a772/recommendations?type=functional_similarity&limit=5&filters=${encodeURIComponent(JSON.stringify({colors: ['U']}))}`);
  const data = await response.json();
  console.log(`Blue filter test: ${data.length} results`);
  
  data.forEach(rec => {
    const colors = rec.card.colors?.join('') || '∅';
    const identity = rec.card.color_identity?.join('') || '∅';
    console.log(`  • ${rec.card.name} (Colors: ${colors}, Identity: ${identity})`);
  });
}

quickTest();