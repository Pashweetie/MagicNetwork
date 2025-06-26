import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Optimized for Replit deployment - no tunnels needed
import { securityHeaders, rateLimiter } from "./middleware/security";
import { cloudflareOptimized } from "./middleware/cloudflare-headers";

const app = express();

// Domain redirect middleware - redirect Replit domain to custom domain
app.use((req, res, next) => {
  try {
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    
    // Only redirect if coming from actual Replit domains, not custom domain
    if (host && host.endsWith('.replit.app') && host !== 'magic-intelligence.org') {
      const redirectUrl = `https://magic-intelligence.org${req.originalUrl}`;
      log(`🔄 REDIRECTING: ${protocol}://${host}${req.originalUrl} -> ${redirectUrl}`);
      return res.redirect(301, redirectUrl);
    }
    
    next();
  } catch (error) {
    log(`Redirect middleware error: ${error}`);
    next();
  }
});

// Apply security middleware
app.use(securityHeaders);
app.use(cloudflareOptimized); // Optimize responses for Cloudflare caching
app.use('/api', rateLimiter(100, 60000)); // 100 requests per minute per IP
app.use('/api/cards/search', rateLimiter(50, 60000)); // Stricter limit for search

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware to allow frontend requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Allow all access - no tunnel restrictions

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
      log(`🚀 Server running on port ${port}`);
      log(`📱 Local: http://localhost:${port}`);
      
      // Replit deployment info
      if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        const replitUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`;
        log(`🌐 Replit URL: ${replitUrl}`);
        log(`✅ App ready for deployment with built-in security`);
      }
      
      // AI recommendation service is ready for theme generation
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();