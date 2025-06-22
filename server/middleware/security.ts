import { Request, Response, NextFunction } from 'express';

// Enhanced security middleware for production deployment
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  
  next();
}

// Simple rate limiting for API routes
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip + (req.user?.id || 'anonymous');
    const now = Date.now();
    
    const clientData = requestCounts.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      requestCounts.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000) 
      });
    }
    
    clientData.count++;
    next();
  };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts) {
    if (now > data.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 300000); // Cleanup every 5 minutes