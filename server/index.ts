import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";



const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
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
  // Auto-start tunnel if configuration exists and is valid
  console.log('Checking Cloudflare tunnel configuration...');

  // Check if tunnel is configured
  if (!existsSync('./cloudflare-tunnel.yml')) {
    console.log('Cloudflare tunnel not configured - see cloudflare-setup.md for setup instructions');
    return;
  }

  // Check if cloudflared is installed
  const checkCloudflared = spawn('which', ['cloudflared']);
  checkCloudflared.on('exit', (code) => {
    if (code !== 0) {
      console.log('cloudflared not installed - see cloudflare-setup.md for installation');
      return;
    }

    // Check if we have the tunnel token (more reliable than config file method)
    console.log('Using token-based tunnel authentication...');

    // Start the tunnel using token method (more reliable for Replit)
    console.log('Starting Cloudflare tunnel...');
    const tunnelToken = 'eyJhIjoiYWM0YWUzMTI4NmEwZmI0YmQ1N2ZhOTAwMzlmOGE2NDQiLCJ0IjoiODJmMWIzOTktYzQyNy00NWYxLTg2NjktOGRhOWYxZmJmY2ExIiwicyI6Ik9Ea3dPR1U0TmprdFpqVXlNeTAwTkRrMExXSmhNell0T1dGaE4yWmxaREV4TnpBeCJ9';
    const tunnel = spawn('cloudflared', ['tunnel', '--token', tunnelToken, 'run'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    tunnel.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('https://')) {
        const url = output.match(/https:\/\/[^\s]+/)?.[0];
        console.log(`🌐 Cloudflare tunnel active: ${url}`);
      } else if (output.includes('INF')) {
        console.log(`[Tunnel] ${output.trim()}`);
      }
    });

    tunnel.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('ERR') && !error.includes('Failed to create new quic connection')) {
        console.log(`[Tunnel Error] ${error.trim()}`);
      }
    });

    tunnel.on('exit', (code) => {
      if (code !== 0) {
        console.log(`Cloudflare tunnel exited with code ${code}`);
      }
    });

    // Cleanup tunnel on server shutdown
    process.on('SIGINT', () => {
      console.log('Stopping Cloudflare tunnel...');
      tunnel.kill();
      process.exit();
    });

    process.on('SIGTERM', () => {
      tunnel.kill();
      process.exit();
    });
  });
}
