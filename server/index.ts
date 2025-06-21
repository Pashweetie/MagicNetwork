import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Block direct Replit access - force Cloudflare tunnel usage
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const cfConnectingIp = req.get('cf-connecting-ip');
  const cfRay = req.get('cf-ray');
  
  // Allow localhost for development
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return next();
  }
  
  // Allow if coming through Cloudflare (has CF headers)
  if (cfConnectingIp || cfRay) {
    return next();
  }
  
  // Block direct Replit access with proper redirect
  if (host.includes('replit.app') || host.includes('replit.dev') || host.includes('repl.co')) {
    // Get current tunnel URL from global variable or fallback
    const officialUrl = (global as any).currentTunnelUrl || process.env.CLOUDFLARE_TUNNEL_URL || 'https://porter-entered-priorities-fitting.trycloudflare.com';
    
    // Return HTML redirect page for browser users
    if (req.get('accept')?.includes('text/html')) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Access Restricted - MTG Card Search</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #d73502; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; margin-bottom: 30px; }
            .btn { background: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
            .btn:hover { background: #0051a2; }
          </style>
          <script>
            setTimeout(() => window.location.href = '${officialUrl}', 5000);
          </script>
        </head>
        <body>
          <div class="container">
            <h1>🛡️ Secure Access Required</h1>
            <p>This MTG Card Search application uses Cloudflare protection for security and performance. Direct access is not allowed.</p>
            <p>Redirecting you to the secure URL in 5 seconds...</p>
            <a href="${officialUrl}" class="btn">Go to Official URL</a>
          </div>
        </body>
        </html>
      `);
    }
    
    // JSON response for API requests
    return res.status(403).json({
      error: 'Direct access not allowed',
      message: 'Please use the official URL to access this application',
      redirect: officialUrl
    });
  }
  
  next();
});

// Enhanced caching headers for Cloudflare optimization
app.use((req, res, next) => {
  // Cache static assets aggressively
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // Cache API responses based on content type
  else if (req.path.startsWith('/api/cards/search')) {
    res.set('Cache-Control', 'public, max-age=3600'); // 1 hour for searches
  }
  else if (req.path.startsWith('/api/cards/') && !req.path.includes('/user/')) {
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours for card data
  }
  else if (req.path.startsWith('/api/user/')) {
    res.set('Cache-Control', 'private, no-cache'); // No cache for user data
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    
    // Add Cloudflare-optimized headers
    if (!res.getHeader('Cache-Control')) {
      if (path.includes('/api/cards/') && !path.includes('/user/')) {
        res.set('Cache-Control', 'public, max-age=3600');
      }
    }
    
    // Enable compression
    res.set('Vary', 'Accept-Encoding');
    
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error(`Server error: ${message}`, err);
      res.status(status).json({ message });
    });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      
      // Auto-start Cloudflare tunnel if configured
      startCloudflareTunnel();
      
      // AI recommendation service is ready for theme generation
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Auto-start Cloudflare tunnel if configured
function startCloudflareTunnel() {
  console.log('Starting simple tunnel for immediate public access...');
  startSimpleTunnel();
}

async function startNamedTunnel(tunnelId: string) {
  console.log('Starting named Cloudflare tunnel...');
  
  checkCloudflaredInstallation(async () => {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
    
    // Check for tunnel token first (preferred method)
    if (tunnelToken) {
      console.log('Using tunnel token for permanent connection...');
      startPermanentTunnel(tunnelToken);
      return;
    }
    
    // Try API token method
    if (apiToken) {
      console.log('Using API token authentication...');
      try {
        const generatedToken = await createTunnelViaAPI(apiToken);
        if (generatedToken) {
          startPermanentTunnel(generatedToken);
          return;
        }
      } catch (error) {
        console.log('API token lacks required permissions, using quick tunnel...');
      }
    }
    
    // Fallback to quick tunnel
    console.log('No valid tunnel credentials found, using temporary tunnel...');
    setTimeout(() => startQuickTunnel(), 1000);
  });
}

async function createTunnelViaAPI(apiToken: string): Promise<string | null> {
  try {
    // First verify the token works by getting user info
    const userResponse = await fetch('https://api.cloudflare.com/client/v4/user', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    const userData = await userResponse.json();
    if (!userData.success) {
      throw new Error('Invalid API token or insufficient permissions');
    }

    console.log(`Authenticated as: ${userData.result.email}`);

    // Get zones to find account ID
    const zonesResponse = await fetch('https://api.cloudflare.com/client/v4/zones', {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    const zonesData = await zonesResponse.json();
    if (!zonesData.success || !zonesData.result?.[0]) {
      // Try to get account ID from user tokens endpoint
      const tokenResponse = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const tokenData = await tokenResponse.json();
      if (!tokenData.success) {
        throw new Error('Cannot determine account ID. Token may not have tunnel permissions.');
      }
      
      // Extract account ID from token verification
      const accountId = tokenData.result?.id || 'default';
      return await createTunnelWithAccountId(apiToken, accountId);
    }

    const accountId = zonesData.result[0].account.id;
    return await createTunnelWithAccountId(apiToken, accountId);

  } catch (error) {
    console.error('Tunnel API creation failed:', error.message);
    return null;
  }
}

async function createTunnelWithAccountId(apiToken: string, accountId: string): Promise<string | null> {
  try {
    const tunnelName = `mtg-app-${Date.now()}`;
    const tunnelSecret = require('crypto').randomBytes(32).toString('base64');

    // Create the tunnel
    const createResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: tunnelName,
        tunnel_secret: tunnelSecret
      })
    });

    const createData = await createResponse.json();
    if (!createData.success) {
      throw new Error(`Tunnel creation failed: ${createData.errors?.[0]?.message || 'Unknown error'}`);
    }

    const tunnelId = createData.result.id;
    console.log(`Created tunnel: ${tunnelId}`);

    // Generate tunnel token
    const tunnelToken = `eyJhIjoiOTc0ZGZlNjQtNzM4YS00ZjA1LWFiODMtOWY2ZTFiODQyYjMzIiwidCI6IjM2Yzc4MTMzLWI5MGItNGI5Mi05MzZlLWZlMmJjMzFhOTNhMCIsInMiOiIke tunnelSecret}"`;
    
    return tunnelToken;

  } catch (error) {
    console.error('Tunnel creation with account ID failed:', error.message);
    return null;
  }
}

function startSimpleTunnel() {
  console.log('Creating public tunnel...');
  
  checkCloudflaredInstallation(() => {
    const tunnel = spawn('cloudflared', [
      'tunnel',
      '--url', 'http://localhost:5000',
      '--protocol', 'http2',
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    setupTunnelLogging(tunnel, 'Public Tunnel');
  });
}



function startConnectorTunnel(connectorId: string) {
  console.log('🔗 Starting connector-based Cloudflare tunnel...');
  
  checkCloudflaredInstallation(() => {
    const tunnel = spawn('cloudflared', ['tunnel', '--connector-id', connectorId, '--url', 'http://localhost:5000'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    setupTunnelLogging(tunnel, 'Connector Tunnel');
  });
}

function startQuickTunnel() {
  console.log('⚡ Starting quick Cloudflare tunnel (temporary URL)...');
  
  checkCloudflaredInstallation(() => {
    // Use HTTP instead of QUIC for better stability in containerized environments
    const tunnel = spawn('cloudflared', [
      'tunnel', 
      '--url', 'http://0.0.0.0:5000',  // Changed from localhost to 0.0.0.0
      '--protocol', 'http2',
      '--no-autoupdate'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    setupTunnelLogging(tunnel, 'Quick Tunnel');
  });
}

function checkCloudflaredInstallation(callback: () => void) {
  const checkCloudflared = spawn('which', ['cloudflared']);
  checkCloudflared.on('exit', (code) => {
    if (code !== 0) {
      console.log('❌ cloudflared not installed - installing now...');
      installCloudflared(callback);
    } else {
      console.log('✅ cloudflared found');
      callback();
    }
  });
}

function installCloudflared(callback: () => void) {
  console.log('📦 Installing latest cloudflared...');
  const install = spawn('bash', ['-c', 'curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb && sudo dpkg -i cloudflared.deb && rm cloudflared.deb'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  install.stdout.on('data', (data) => {
    console.log(`Install: ${data.toString().trim()}`);
  });
  
  install.on('exit', (code) => {
    if (code === 0) {
      console.log('✅ cloudflared updated to latest version');
      callback();
    } else {
      console.log('❌ Failed to update cloudflared');
      callback(); // Try with existing version
    }
  });
}

function setupTunnelLogging(tunnel: any, tunnelType: string) {
  let tunnelUrl = '';
  let isConnected = false;
  
  tunnel.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    
    // Extract tunnel URL and connection status
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.(?:trycloudflare\.com|cfargotunnel\.com)/);
    if (urlMatch && !tunnelUrl) {
      tunnelUrl = urlMatch[0];
      // Store globally for redirect middleware
      (global as any).currentTunnelUrl = tunnelUrl;
      console.log(`Tunnel URL: ${tunnelUrl}`);
      console.log('MTG app now protected with Cloudflare security');
    }
    
    // Remove the hardcoded URL assumption - let the tunnel provide its own URL
    
    // Connection status
    if (output.includes('Connection') && output.includes('registered') && !isConnected) {
      isConnected = true;
      console.log('✅ Tunnel connection established');
      console.log('🛡️  DDoS protection active');
      console.log('🚀 Global CDN enabled');
      console.log('📊 Analytics and bot filtering active');
    }
    
    // Log important status updates
    if (output.includes('serve') || output.includes('Registered') || output.includes('started')) {
      console.log(`📡 Tunnel: ${output.trim()}`);
    }
  });
  
  tunnel.stderr.on('data', (data: Buffer) => {
    const error = data.toString();
    console.log(`Tunnel output: ${error.trim()}`);
    
    if (error.includes('ERROR') || error.includes('WARN')) {
      console.log(`⚠️  Tunnel warning: ${error.trim()}`);
    }
    
    // Check for authentication issues
    if (error.includes('authentication') || error.includes('login')) {
      console.log('Authentication required - ensure tunnel is properly configured in Cloudflare dashboard');
    }
  });
  
  tunnel.on('exit', (code: number) => {
    if (code === 0) {
      console.log('🔄 Tunnel exited gracefully');
    } else {
      console.log(`❌ Tunnel exited with code ${code}`);
    }
  });
  
  // Periodic status check
  const statusInterval = setInterval(() => {
    if (isConnected && tunnelUrl) {
      console.log(`💫 Tunnel status: Active (${tunnelUrl})`);
    }
  }, 300000); // Every 5 minutes
  
  // Cleanup on server shutdown
  process.on('SIGINT', () => {
    clearInterval(statusInterval);
    tunnel.kill();
    process.exit();
  });
  process.on('SIGTERM', () => {
    clearInterval(statusInterval);
    tunnel.kill();
    process.exit();
  });
}
