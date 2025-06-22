import { Request, Response, NextFunction } from 'express';

// Middleware to optimize responses for Cloudflare caching
export function cloudflareOptimized(req: Request, res: Response, next: NextFunction) {
  const path = req.path;
  
  // Enhanced cache headers for Cloudflare proxy
  if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    // Static assets - cache for 1 year
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'CF-Cache-Tag': 'static-assets'
    });
  } else if (path.startsWith('/api/cards/') && !path.includes('/user/')) {
    // Card data - cache for 1 hour
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'CF-Cache-Tag': 'api-cards',
      'Vary': 'Accept-Encoding'
    });
  } else if (path.startsWith('/api/cards/search')) {
    // Search results - cache for 5 minutes
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'CF-Cache-Tag': 'api-search',
      'Vary': 'Accept-Encoding'
    });
  } else if (path.startsWith('/api/user/')) {
    // User data - never cache
    res.set({
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  } else if (path === '/' || path.startsWith('/app')) {
    // Main app - short cache
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
      'CF-Cache-Tag': 'app-pages'
    });
  }
  
  // Cloudflare-specific optimizations
  res.set({
    'CF-Polish': 'lossy', // Image optimization
    'CF-Mirage': 'on',    // Lazy loading
  });
  
  next();
}

// Purge Cloudflare cache function (requires API token)
export async function purgeCloudflareCache(zoneId: string, apiToken: string, tags?: string[]) {
  if (!zoneId || !apiToken) {
    console.log('Cloudflare credentials not configured for cache purging');
    return;
  }
  
  try {
    const purgeData = tags ? { tags } : { purge_everything: true };
    
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(purgeData)
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ Cloudflare cache purged successfully');
    } else {
      console.log('❌ Cache purge failed:', result.errors);
    }
  } catch (error) {
    console.log('Cache purge error:', error);
  }
}