// Quick test to verify tunnel URL
const https = require('https');

const tunnelUrl = 'https://82f1b399-c427-45f1-8669-8da9f1fbfca1.cfargotunnel.com';

https.get(tunnelUrl, (res) => {
  console.log(`Tunnel Status: ${res.statusCode}`);
  console.log(`Tunnel URL is accessible: ${tunnelUrl}`);
  process.exit(0);
}).on('error', (err) => {
  console.log(`Tunnel not accessible: ${err.message}`);
  process.exit(1);
});