#!/usr/bin/env node

// End-to-end test script for Magic Network application
import https from 'https';
import http from 'http';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = `test_user_${Date.now()}`;

// Helper function to make HTTP requests
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

// Test cases
async function runTests() {
  console.log('🧪 Starting End-to-End Tests...\n');
  console.log(`👤 Using test user ID: ${TEST_USER_ID}\n`);

  const tests = [
    {
      name: '🏠 Homepage loads',
      test: async () => {
        const result = await makeRequest('/');
        return result.status === 200 && result.data.includes('<!DOCTYPE html>');
      }
    },
    {
      name: '🔍 Card search API works',
      test: async () => {
        const result = await makeRequest('/api/cards/search?query=lightning bolt');
        return result.status === 200 && result.data.data && Array.isArray(result.data.data);
      }
    },
    {
      name: '🎯 Single card API works',
      test: async () => {
        // First get a card from search
        const searchResult = await makeRequest('/api/cards/search?query=sol ring&limit=1');
        if (searchResult.status !== 200 || !searchResult.data.data || !searchResult.data.data.length) return false;
        
        const cardId = searchResult.data.data[0].id;
        const result = await makeRequest(`/api/cards/${cardId}`);
        return result.status === 200 && result.data.id === cardId;
      }
    },
    {
      name: '👤 User authentication works (with our new auth helper)',
      test: async () => {
        // Test user decks endpoint which uses our new auth helper
        const result = await makeRequest('/api/decks');
        return result.status === 200 && Array.isArray(result.data);
      }
    },
    {
      name: '🎨 Theme suggestions API works (with new auth helper)', 
      test: async () => {
        // Get a real card first
        const searchResult = await makeRequest('/api/cards/search?query=sol ring&limit=1');
        if (searchResult.status !== 200 || !searchResult.data.data || !searchResult.data.data.length) return false;
        
        const cardId = searchResult.data.data[0].id;
        const result = await makeRequest(`/api/cards/${cardId}/theme-suggestions`);
        return result.status === 200;
      }
    },
    {
      name: '🗳️ Theme voting works (with new auth helper)',
      test: async () => {
        // Get a real card first
        const searchResult = await makeRequest('/api/cards/search?query=sol ring&limit=1');
        if (searchResult.status !== 200 || !searchResult.data.data || !searchResult.data.data.length) return false;
        
        const cardId = searchResult.data.data[0].id;
        const result = await makeRequest(`/api/cards/${cardId}/theme-vote`, {
          method: 'POST',
          body: {
            themeName: 'Copying',
            vote: 'up'
          }
        });
        return result.status === 200;
      }
    },
    {
      name: '📊 User decks API works',
      test: async () => {
        const result = await makeRequest('/api/decks');
        return result.status === 200 && Array.isArray(result.data);
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`Running: ${test.name}...`);
      const success = await test.test();
      if (success) {
        console.log(`✅ PASS: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${test.name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${test.name} - ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log('📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! The application is working end-to-end.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
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
    await runTests();
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
    process.exit(1);
  }
}

main();