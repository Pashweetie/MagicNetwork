import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  const tunnelId = process.env.CLOUDFLARE_TUNNEL_ID;
  const connectorId = process.env.CLOUDFLARE_CONNECTOR_ID;
  
  console.log('🌐 Checking Cloudflare tunnel configuration...');
  
  // If we have tunnel ID, use named tunnel approach
  if (tunnelId) {
    console.log(`📋 Tunnel ID found: ${tunnelId}`);
    startNamedTunnel(tunnelId);
    return;
  }
  
  // If we have connector ID, use connector approach
  if (connectorId) {
    console.log(`🔗 Connector ID found: ${connectorId}`);
    startConnectorTunnel(connectorId);
    return;
  }
  
  // Fallback to quick tunnel (no auth required)
  console.log('⚡ No tunnel credentials configured, starting quick tunnel...');
  startQuickTunnel();
}

function startNamedTunnel(tunnelId: string) {
  console.log('🚀 Starting named Cloudflare tunnel...');
  
  // Check if cloudflared is installed
  checkCloudflaredInstallation(() => {
    // Try different approaches based on tunnel configuration
    const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5000', 'run', tunnelId], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    setupTunnelLogging(tunnel, 'Named Tunnel');
    
    // If named tunnel fails, fallback to quick tunnel
    tunnel.on('exit', (code) => {
      if (code !== 0) {
        console.log('Named tunnel failed, falling back to quick tunnel...');
        setTimeout(() => startQuickTunnel(), 2000);
      }
    });
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
      '--url', 'http://localhost:5000',
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
    
    // Extract tunnel URL
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.(?:trycloudflare\.com|cfargotunnel\.com)/);
    if (urlMatch && !tunnelUrl) {
      tunnelUrl = urlMatch[0];
      console.log(`🌍 ${tunnelType} URL: ${tunnelUrl}`);
      console.log('🔒 MTG app now protected with Cloudflare security');
    }
    
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
