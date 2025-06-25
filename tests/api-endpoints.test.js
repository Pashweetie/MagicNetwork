#!/usr/bin/env node
import http from 'http';
import { spawn } from 'child_process';

const BASE_URL = 'http://localhost:5000';
const TEST_USER_ID = `test_user_${Date.now()}`;
let serverProcess = null;

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

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting server...');
    serverProcess = spawn('./start-dev.sh', [], { stdio: 'pipe' });
    
    let output = '';
    serverProcess.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Server running on port 5000')) {
        console.log('✅ Server ready!');
        resolve();
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      output += data.toString();
      if (output.includes('Server running on port 5000')) {
        console.log('✅ Server ready!');
        resolve();
      }
    });
    
    setTimeout(() => reject(new Error('Server timeout')), 10000);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('🛑 Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

async function debugTest() {
  console.log('🔍 Starting API endpoint tests...\n');
  
  try {
    await startServer();

  // Test card search
  console.log('Testing /api/cards/search...');
  try {
    const result = await makeRequest('/api/cards/search?query=sol ring&limit=1');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2).substring(0, 500));
    console.log('');
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test user decks (our auth helper)
  console.log('Testing /api/decks (our new auth helper)...');
  try {
    const result = await makeRequest('/api/decks');
    console.log(`Status: ${result.status}`);
    console.log(`Response:`, JSON.stringify(result.data, null, 2));
    console.log('');
  } catch (error) {
    console.log('Error:', error.message);
  }

  // Test theme suggestions (our auth helper)
  console.log('Testing theme suggestions with a real card...');
  try {
    // First get a real card
    const searchResult = await makeRequest('/api/cards/search?query=sol ring&limit=1');
    if (searchResult.status === 200 && searchResult.data.data && searchResult.data.data.length > 0) {
      const cardId = searchResult.data.data[0].id;
      console.log(`Using card ID: ${cardId}`);
      
      const result = await makeRequest(`/api/cards/${cardId}/theme-suggestions`);
      console.log(`Status: ${result.status}`);
      console.log(`Response:`, JSON.stringify(result.data, null, 2).substring(0, 300));
    } else {
      console.log('Could not get a test card');
    }
    console.log('');
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  } catch (error) {
    console.log('❌ Failed to start server:', error.message);
  } finally {
    stopServer();
    console.log('✅ Tests completed');
  }
}

// Handle cleanup on exit
process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('exit', stopServer);

debugTest();