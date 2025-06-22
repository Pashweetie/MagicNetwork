#!/usr/bin/env node

/**
 * User Isolation Test Script
 * Tests that users from different sessions get isolated decks
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

class UserSession {
  constructor(name) {
    this.name = name;
    this.cookies = new Map();
    this.userId = null;
  }

  async makeRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add cookies if we have any
    if (this.cookies.size > 0) {
      const cookieString = Array.from(this.cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join('; ');
      headers['Cookie'] = cookieString;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    // Store any new cookies
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const cookies = setCookieHeader.split(',');
      cookies.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name && value) {
          this.cookies.set(name.trim(), value.trim());
        }
      });
    }

    return response;
  }

  async getDeck() {
    const response = await this.makeRequest('/api/user/deck');
    return response.json();
  }

  async saveDeck(deckData) {
    const response = await this.makeRequest('/api/user/deck', {
      method: 'PUT',
      body: JSON.stringify(deckData)
    });
    return response.json();
  }
}

async function testUserIsolation() {
  console.log('🧪 Starting User Isolation Test\n');

  // Create three simulated users
  const users = [
    new UserSession('Alice'),
    new UserSession('Bob'), 
    new UserSession('Charlie')
  ];

  const testDecks = [
    {
      name: "Alice's Deck",
      format: "Commander",
      commanderId: "950ecba7-90b1-42bc-a5f4-ab8d9e9607ee",
      cards: [
        { cardId: "950ecba7-90b1-42bc-a5f4-ab8d9e9607ee", quantity: 1 },
        { cardId: "f480df6d-e227-4ccb-ad6d-a4ad48a360ad", quantity: 1 }
      ]
    },
    {
      name: "Bob's Deck",
      format: "Standard",
      commanderId: null,
      cards: [
        { cardId: "c60fbc33-6198-4661-967e-cc94f2788e4a", quantity: 4 },
        { cardId: "a2ae592f-caf6-445a-970b-f8101998e657", quantity: 2 }
      ]
    },
    {
      name: "Charlie's Deck",
      format: "Modern",
      commanderId: "1eddb834-ea01-44e2-afca-bd9a4ebbdb94",
      cards: [
        { cardId: "1eddb834-ea01-44e2-afca-bd9a4ebbdb94", quantity: 1 },
        { cardId: "c6a52be0-79c2-4aa1-b909-2cc0fbbdf1f7", quantity: 3 }
      ]
    }
  ];

  console.log('📝 Step 1: Getting initial deck state for each user');
  const initialDecks = [];
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const deck = await user.getDeck();
    initialDecks.push(deck);
    console.log(`   ${user.name}: ${deck.deck ? 'Has existing deck' : 'No deck found'}`);
  }

  console.log('\n💾 Step 2: Each user saves their own deck');
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const deckData = testDecks[i];
    const savedDeck = await user.saveDeck(deckData);
    console.log(`   ${user.name}: Saved "${deckData.name}" (${deckData.cards.length} cards)`);
  }

  console.log('\n🔍 Step 3: Verifying each user can only see their own deck');
  let testsPassed = 0;
  let totalTests = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const expectedDeck = testDecks[i];
    const actualDeck = await user.getDeck();
    
    totalTests++;
    
    if (actualDeck.deck && actualDeck.deck.name === expectedDeck.name) {
      console.log(`   ✅ ${user.name}: Correctly sees "${actualDeck.deck.name}"`);
      testsPassed++;
    } else {
      console.log(`   ❌ ${user.name}: Expected "${expectedDeck.name}", got "${actualDeck.deck?.name || 'null'}"`);
    }

    // Test card isolation
    totalTests++;
    if (actualDeck.entries && actualDeck.entries.length === expectedDeck.cards.length) {
      console.log(`   ✅ ${user.name}: Has correct number of cards (${actualDeck.entries.length})`);
      testsPassed++;
    } else {
      console.log(`   ❌ ${user.name}: Expected ${expectedDeck.cards.length} cards, got ${actualDeck.entries?.length || 0}`);
    }
  }

  console.log('\n🧹 Step 4: Cross-contamination check');
  // Verify users don't see each other's decks
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const userDeck = await user.getDeck();
    
    for (let j = 0; j < users.length; j++) {
      if (i === j) continue; // Skip self
      
      const otherUserExpectedDeck = testDecks[j];
      totalTests++;
      
      if (userDeck.deck && userDeck.deck.name === otherUserExpectedDeck.name) {
        console.log(`   ❌ ${user.name}: CONTAMINATION! Seeing ${users[j].name}'s deck`);
      } else {
        console.log(`   ✅ ${user.name}: Correctly isolated from ${users[j].name}'s deck`);
        testsPassed++;
      }
    }
  }

  console.log('\n📊 Test Results:');
  console.log(`   Passed: ${testsPassed}/${totalTests} tests`);
  console.log(`   Success Rate: ${((testsPassed/totalTests) * 100).toFixed(1)}%`);
  
  if (testsPassed === totalTests) {
    console.log('   🎉 ALL TESTS PASSED - User isolation is working correctly!');
    return true;
  } else {
    console.log('   ⚠️  SOME TESTS FAILED - User isolation needs attention');
    return false;
  }
}

async function main() {
  try {
    const success = await testUserIsolation();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    process.exit(1);
  }
}

main();