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
  // Only start tunnel if token is provided via environment variable
  const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN;
  if (!tunnelToken) {
    console.log('Cloudflare tunnel: CLOUDFLARE_TUNNEL_TOKEN not configured');
    return;
  }

  // Check if cloudflared is installed
  const checkCloudflared = spawn('which', ['cloudflared']);
  checkCloudflared.on('exit', (code) => {
    if (code !== 0) {
      console.log('Cloudflare tunnel: cloudflared not installed');
      return;
    }

    console.log('Starting Cloudflare tunnel for MTG app...');
    
    const tunnel = spawn('cloudflared', ['tunnel', 'run', '--token', tunnelToken, '--url', 'http://localhost:5000'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    tunnel.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('trycloudflare.com')) {
        const url = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/)?.[0];
        if (url) {
          console.log(`Cloudflare tunnel active: ${url}`);
          console.log('MTG app now protected with enterprise-level security and caching');
        }
      }
      if (output.includes('Connection') && output.includes('registered')) {
        console.log('Tunnel connection established - DDoS protection and global CDN active');
      }
    });

    // Cleanup on server shutdown
    process.on('SIGINT', () => {
      tunnel.kill();
      process.exit();
    });
    process.on('SIGTERM', () => {
      tunnel.kill();
      process.exit();
    });
  });
}
