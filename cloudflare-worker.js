/**
 * Cloudflare Worker for MTG Card Application
 * Handles edge computing for card searches and image optimization
 */

// KV namespace for caching (configured in Cloudflare dashboard)
// declare const CARD_CACHE: KVNamespace;

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const cache = caches.default
  
  // Handle card search requests
  if (url.pathname.startsWith('/api/cards/search')) {
    return handleCardSearch(request, cache)
  }
  
  // Handle card image requests with optimization
  if (url.pathname.includes('cards.scryfall.io')) {
    return handleCardImage(request, cache)
  }
  
  // Pass through other requests to origin
  return fetch(request)
}

async function handleCardSearch(request, cache) {
  // Create cache key from URL and query parameters
  const cacheKey = new Request(request.url, request)
  
  // Check cache first
  let response = await cache.match(cacheKey)
  if (response) {
    // Add cache hit header
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...response.headers,
        'X-Cache-Status': 'HIT',
        'X-Cache-Source': 'CF-Worker'
      }
    })
    return response
  }
  
  // Fetch from origin
  response = await fetch(request)
  
  // Cache successful responses for 1 hour
  if (response.ok) {
    const responseToCache = response.clone()
    responseToCache.headers.set('Cache-Control', 'max-age=3600')
    await cache.put(cacheKey, responseToCache)
  }
  
  // Add cache miss header
  const headers = new Headers(response.headers)
  headers.set('X-Cache-Status', 'MISS')
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

async function handleCardImage(request, cache) {
  const cacheKey = new Request(request.url)
  
  // Check cache first
  let response = await cache.match(cacheKey)
  if (response) {
    return response
  }
  
  // Fetch and optimize image
  response = await fetch(request, {
    cf: {
      // Cloudflare image optimization
      polish: 'lossy',
      image: {
        fit: 'scale-down',
        width: 488,
        quality: 85,
        format: 'webp'
      }
    }
  })
  
  // Cache images for 30 days
  if (response.ok) {
    const responseToCache = response.clone()
    responseToCache.headers.set('Cache-Control', 'max-age=2592000')
    await cache.put(cacheKey, responseToCache)
  }
  
  return response
}

// Handle geographic routing for better performance
function getRegionalOrigin(country) {
  const regions = {
    'US': 'us-east.mtgapp.com',
    'EU': 'eu-west.mtgapp.com', 
    'AP': 'ap-south.mtgapp.com'
  }
  
  if (['US', 'CA', 'MX'].includes(country)) return regions.US
  if (['GB', 'DE', 'FR', 'IT', 'ES', 'NL'].includes(country)) return regions.EU
  if (['JP', 'KR', 'SG', 'AU', 'IN'].includes(country)) return regions.AP
  
  return 'mtgapp.com' // Default origin
}