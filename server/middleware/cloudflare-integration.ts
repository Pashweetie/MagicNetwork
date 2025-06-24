import { Request, Response, NextFunction } from 'express';

/**
 * Cloudflare-specific integration middleware
 * Handles Workers, KV storage, and R2 bucket interactions
 */

export interface CloudflareConfig {
  zoneId?: string;
  apiToken?: string;
  kvNamespace?: string;
  r2Bucket?: string;
  workerUrl?: string;
}

/**
 * Cloudflare Workers integration for edge computing
 */
export function cloudflareWorkers(config: CloudflareConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add headers for Cloudflare Workers
    res.set('CF-Cache-Status', 'DYNAMIC');
    res.set('CF-RAY', req.headers['cf-ray'] as string || 'unknown');
    
    // Add worker routing headers for card searches
    if (req.path.startsWith('/api/cards/search')) {
      res.set('X-Worker-Route', 'card-search');
    }
    
    // Add geographic headers for performance optimization
    const country = req.headers['cf-ipcountry'] as string;
    if (country) {
      res.set('X-User-Country', country);
    }
    
    next();
  };
}

/**
 * Cloudflare KV storage for caching frequently accessed data
 */
export class CloudflareKV {
  private kvNamespace: string;
  private apiToken: string;
  private accountId: string;

  constructor(kvNamespace: string, apiToken: string, accountId: string) {
    this.kvNamespace = kvNamespace;
    this.apiToken = apiToken;
    this.accountId = accountId;
  }

  async get(key: string): Promise<any> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespace}/values/${key}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('CloudflareKV get error:', error);
      return null;
    }
  }

  async put(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const body: any = { value: JSON.stringify(value) };
      if (ttl) {
        body.expiration_ttl = ttl;
      }

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespace}/values/${key}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('CloudflareKV put error:', error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.kvNamespace}/values/${key}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
          },
        }
      );
      
      return response.ok;
    } catch (error) {
      console.error('CloudflareKV delete error:', error);
      return false;
    }
  }
}

/**
 * Card search caching using Cloudflare KV
 */
export function cardSearchCache(kv: CloudflareKV) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !req.path.startsWith('/api/cards/search')) {
      return next();
    }

    // Create cache key from query parameters
    const cacheKey = `search:${Buffer.from(JSON.stringify(req.query)).toString('base64')}`;
    
    try {
      // Try to get from KV cache first
      const cached = await kv.get(cacheKey);
      if (cached) {
        res.set('X-Cache-Status', 'HIT');
        res.set('X-Cache-Source', 'CF-KV');
        return res.json(cached);
      }
      
      // Store original res.json to intercept response
      const originalJson = res.json;
      res.json = function(body: any) {
        // Cache successful responses
        if (res.statusCode === 200 && body) {
          kv.put(cacheKey, body, 3600).catch(err => 
            console.warn('Failed to cache search result:', err)
          );
        }
        res.set('X-Cache-Status', 'MISS');
        return originalJson.call(this, body);
      };
      
    } catch (error) {
      console.error('Search cache error:', error);
    }
    
    next();
  };
}

/**
 * Purge cache when card data is updated
 */
export async function purgeCardCache(
  zoneId: string, 
  apiToken: string, 
  cardId?: string
): Promise<boolean> {
  try {
    const tags = cardId ? [`card-${cardId}`, 'card-search'] : ['card-search', 'card-themes'];
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tags: tags
        }),
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('Cache purge error:', error);
    return false;
  }
}

/**
 * Middleware to add cache purging hooks
 */
export function cachePurgeHooks(config: CloudflareConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add purge method to response object
    res.locals.purgeCache = async (tags: string[]) => {
      if (config.zoneId && config.apiToken) {
        return await purgeCardCache(config.zoneId, config.apiToken);
      }
      return false;
    };
    
    next();
  };
}

/**
 * Geographic optimization for card searches
 */
export function geoOptimization() {
  return (req: Request, res: Response, next: NextFunction) => {
    const country = req.headers['cf-ipcountry'] as string;
    const datacenter = req.headers['cf-ray'] as string;
    
    if (country) {
      // Add geographic context for potential regional card preferences
      res.locals.userCountry = country;
      res.locals.datacenter = datacenter;
      
      // Set appropriate cache headers based on region
      if (['US', 'CA', 'GB', 'DE', 'FR', 'JP'].includes(country)) {
        // Higher cache TTL for major markets
        res.set('X-Regional-Cache', 'extended');
      }
    }
    
    next();
  };
}