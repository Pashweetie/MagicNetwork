import { Request, Response, NextFunction } from 'express';

/**
 * Edge caching middleware for MTG card application
 * Implements intelligent caching strategies based on content type and user patterns
 */

export interface CacheConfig {
  maxAge: number;
  staleWhileRevalidate?: number;
  publicCache?: boolean;
  varyHeaders?: string[];
  tags?: string[];
}

// Cache configurations for different content types
export const CACHE_CONFIGS = {
  // Card images - cache heavily since they rarely change
  CARD_IMAGES: {
    maxAge: 86400 * 30, // 30 days
    staleWhileRevalidate: 86400 * 7, // 7 days
    publicCache: true,
    tags: ['card-images']
  },

  // Card search results - cache with shorter TTL due to frequent updates
  CARD_SEARCH: {
    maxAge: 3600, // 1 hour
    staleWhileRevalidate: 1800, // 30 minutes
    publicCache: true,
    varyHeaders: ['Accept', 'Authorization'],
    tags: ['card-search']
  },

  // Card themes - relatively static data
  CARD_THEMES: {
    maxAge: 86400, // 24 hours
    staleWhileRevalidate: 3600, // 1 hour
    publicCache: true,
    tags: ['card-themes']
  },

  // Individual card data - cache heavily
  CARD_DATA: {
    maxAge: 86400 * 7, // 7 days
    staleWhileRevalidate: 86400, // 1 day
    publicCache: true,
    tags: ['card-data']
  },

  // User-specific deck data - private cache only
  USER_DECKS: {
    maxAge: 300, // 5 minutes
    publicCache: false,
    tags: ['user-decks']
  },

  // Static assets - cache very aggressively
  STATIC_ASSETS: {
    maxAge: 86400 * 365, // 1 year
    publicCache: true,
    tags: ['static']
  }
} as const;

/**
 * Apply edge caching headers based on configuration
 */
export function edgeCache(config: CacheConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Build Cache-Control header
    const cacheDirectives: string[] = [];
    
    if (config.publicCache === false) {
      cacheDirectives.push('private');
    } else {
      cacheDirectives.push('public');
    }
    
    cacheDirectives.push(`max-age=${config.maxAge}`);
    
    if (config.staleWhileRevalidate) {
      cacheDirectives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }
    
    res.set('Cache-Control', cacheDirectives.join(', '));
    
    // Add Vary header for content negotiation
    if (config.varyHeaders) {
      res.set('Vary', config.varyHeaders.join(', '));
    }
    
    // Add cache tags for Cloudflare purging
    if (config.tags) {
      res.set('Cache-Tag', config.tags.join(', '));
    }
    
    // Add ETag for better cache validation
    const originalSend = res.send;
    res.send = function(body: any) {
      if (body && typeof body === 'string') {
        const etag = `"${Buffer.from(body).toString('base64').slice(0, 16)}"`;
        res.set('ETag', etag);
        
        // Check If-None-Match header
        if (req.headers['if-none-match'] === etag) {
          res.status(304).end();
          return res;
        }
      }
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Smart cache invalidation based on content changes
 */
export function invalidateCache(tags: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store invalidation tags in response for potential webhook processing
    res.locals.invalidateTags = tags;
    next();
  };
}

/**
 * Conditional caching based on request patterns
 */
export function conditionalCache(condition: (req: Request) => CacheConfig | null) {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = condition(req);
    if (config) {
      return edgeCache(config)(req, res, next);
    }
    next();
  };
}

/**
 * Cache warming middleware for frequently accessed content
 */
export function cacheWarmer(routes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add cache warming headers for Cloudflare
    res.set('X-Cache-Warm', routes.join(','));
    next();
  };
}

/**
 * Determine cache strategy based on route patterns
 */
export function getRouteBasedCache(path: string): CacheConfig | null {
  // Card search endpoints
  if (path.startsWith('/api/cards/search')) {
    return CACHE_CONFIGS.CARD_SEARCH;
  }
  
  // Individual card data
  if (path.match(/^\/api\/cards\/[a-f0-9-]+$/)) {
    return CACHE_CONFIGS.CARD_DATA;
  }
  
  // Card themes
  if (path.includes('/themes') || path.includes('/bulk-themes')) {
    return CACHE_CONFIGS.CARD_THEMES;
  }
  
  // User-specific deck data
  if (path.startsWith('/api/user/deck')) {
    return CACHE_CONFIGS.USER_DECKS;
  }
  
  // Static assets
  if (path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    return CACHE_CONFIGS.STATIC_ASSETS;
  }
  
  return null;
}

/**
 * Express middleware to apply intelligent caching
 */
export function intelligentCache() {
  return (req: Request, res: Response, next: NextFunction) => {
    const config = getRouteBasedCache(req.path);
    if (config) {
      return edgeCache(config)(req, res, next);
    }
    next();
  };
}