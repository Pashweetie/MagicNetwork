/**
 * Cloudflare Worker for MTG Card Application Edge Caching
 * Optimizes card searches, image delivery, and API responses globally
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // Handle card search with KV caching
    if (url.pathname.startsWith('/api/cards/search')) {
      return handleCardSearch(request, env.CARD_CACHE)
    }
    
    // Handle Scryfall image optimization
    if (url.hostname === 'cards.scryfall.io') {
      return handleCardImage(request)
    }
    
    // Pass through all other requests
    return fetch(request)
  }
}

async function handleCardSearch(request, kvStore) {
  // Create deterministic cache key from search parameters
  const url = new URL(request.url)
  const searchParams = new URLSearchParams(url.search)
  searchParams.sort() // Ensure consistent key ordering
  const cacheKey = `search:${searchParams.toString()}`
  
  // Check KV cache first
  try {
    const cached = await kvStore.get(cacheKey, 'json')
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache-Status': 'HIT',
          'X-Cache-Source': 'CF-KV'
        }
      })
    }
  } catch (error) {
    console.error('KV cache read error:', error)
  }
  
  // Fetch from origin
  const response = await fetch(request)
  
  if (response.ok) {
    try {
      const data = await response.json()
      
      // Cache successful responses for 1 hour
      await kvStore.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 })
      
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'X-Cache-Status': 'MISS'
        }
      })
    } catch (error) {
      console.error('KV cache write error:', error)
    }
  }
  
  return response
}

async function handleCardImage(request) {
  const cache = caches.default
  const cacheKey = new Request(request.url)
  
  // Check edge cache
  let response = await cache.match(cacheKey)
  if (response) {
    return response
  }
  
  // Fetch with image optimization
  response = await fetch(request, {
    cf: {
      polish: 'lossy',
      image: {
        fit: 'scale-down',
        width: 488,
        quality: 85,
        format: 'auto'
      }
    }
  })
  
  // Cache images for 30 days
  if (response.ok) {
    const responseToCache = response.clone()
    responseToCache.headers.set('Cache-Control', 'public, max-age=2592000')
    await cache.put(cacheKey, responseToCache)
  }
  
  return response
}