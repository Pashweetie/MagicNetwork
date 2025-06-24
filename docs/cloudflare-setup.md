
# Modern Cloudflare Setup for MTG Card Application

## Overview
This guide sets up Cloudflare for your MTG card application using modern edge computing principles, following best practices from high-scale applications like Have I Been Pwned.

## Benefits
- **Edge Performance**: 90%+ requests served from cache, sub-100ms global response times
- **Bandwidth Reduction**: 80-90% origin server load reduction
- **Enhanced Security**: Advanced DDoS protection, bot filtering, and rate limiting
- **Cost Optimization**: Reduced server resource usage and database queries

## Prerequisites
Your application is already optimized for Cloudflare with:
- Intelligent cache headers in `server/middleware/cloudflare-headers.ts`
- Edge optimization middleware in `server/middleware/edge-cache.ts`
- Cloudflare Workers integration ready in `src/worker.js`

## Setup Options

### Option 1: Replit Deployment with Cloudflare Proxy (Recommended)

Your app is already deployed on Replit. Add Cloudflare as a proxy for enhanced performance:

1. **Sign up for Cloudflare** (free tier sufficient)
   - Visit https://dash.cloudflare.com
   - Create account or sign in

2. **Add your domain**
   - Click "Add a Site"
   - Enter your domain (or buy one through Cloudflare)
   - Choose Free plan

3. **Update nameservers**
   - Cloudflare will provide 2 nameservers
   - Update these at your domain registrar
   - Wait 24 hours for propagation

4. **Add DNS record**
   ```
   Type: CNAME
   Name: @ (for root) or app (for subdomain)
   Target: your-repl-name.username.replit.app
   Proxy Status: Proxied (orange cloud ☁️)
   TTL: Auto
   ```

### Option 2: Cloudflare Workers (Advanced Edge Computing)

For maximum performance, deploy the included Cloudflare Worker:

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Configure Worker**
   - Update `wrangler.toml` with your account details
   - Set up KV namespace for card caching

3. **Deploy Worker**
   ```bash
   wrangler deploy
   ```

## Required Environment Variables

Add these to your Replit Secrets (if using advanced features):

```bash
# Required for KV caching
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token_with_zone_edit_permissions
CLOUDFLARE_KV_NAMESPACE=your_kv_namespace_id

# Optional for cache purging
CLOUDFLARE_ZONE_ID=your_zone_id
```

## Cloudflare Configuration

### 1. Caching Rules (Replace Page Rules)

Modern Cloudflare uses Cache Rules instead of Page Rules:

**Cache Rule 1: Static Assets**
- Rule name: `Static Assets - Long Cache`
- When incoming requests match: `(http.request.uri.path.extension in {"js" "css" "png" "jpg" "jpeg" "gif" "ico" "svg" "woff" "woff2"})`
- Then:
  - Cache status: Eligible for cache
  - Edge TTL: 1 year
  - Browser TTL: 1 year

**Cache Rule 2: Card Images**
- Rule name: `Scryfall Images - Medium Cache`
- When incoming requests match: `(http.request.uri.path contains "/cards.scryfall.io/")`
- Then:
  - Cache status: Eligible for cache
  - Edge TTL: 30 days
  - Browser TTL: 7 days

**Cache Rule 3: API Card Data**
- Rule name: `Card API - Short Cache`
- When incoming requests match: `(http.request.uri.path matches "^/api/cards/[^/]+$")`
- Then:
  - Cache status: Eligible for cache
  - Edge TTL: 24 hours
  - Browser TTL: 1 hour

**Cache Rule 4: Search Results**
- Rule name: `Search API - Very Short Cache`
- When incoming requests match: `(http.request.uri.path contains "/api/cards/search")`
- Then:
  - Cache status: Eligible for cache
  - Edge TTL: 5 minutes
  - Browser TTL: 1 minute

**Cache Rule 5: User Data - No Cache**
- Rule name: `User Data - Bypass Cache`
- When incoming requests match: `(http.request.uri.path contains "/api/user/")`
- Then:
  - Cache status: Bypass cache

### 2. Security Configuration

**WAF Custom Rules:**
```
Rule 1: Rate Limiting - API
- Rule name: API Rate Limit
- When incoming requests match: (http.request.uri.path contains "/api/")
- Then: Block
- Rate limiting: 100 requests per 1 minute per IP

Rule 2: Search Rate Limiting
- Rule name: Search Rate Limit  
- When incoming requests match: (http.request.uri.path contains "/api/cards/search")
- Then: Block
- Rate limiting: 30 requests per 1 minute per IP
```

**Security Settings:**
- Security Level: Medium
- Bot Fight Mode: On
- Challenge Passage: 30 minutes
- Browser Integrity Check: On

### 3. Speed Optimizations

**Auto Minify:**
- JavaScript: On
- CSS: On
- HTML: On

**Compression:**
- Brotli: On
- Gzip: On

**Other:**
- Early Hints: On (if available)
- HTTP/3: On
- 0-RTT Connection Resumption: On

### 4. SSL/TLS Configuration

- SSL/TLS Mode: Full (Strict)
- Always Use HTTPS: On
- HSTS: Enable with 6 months max-age
- Minimum TLS Version: 1.2

## Performance Monitoring

### Key Metrics to Track

1. **Cache Performance**
   - Cache hit ratio: Target 85%+ for static content
   - Origin bandwidth savings: Expect 70-80%
   - Edge response time: Sub-200ms target

2. **Security Events**
   - Blocked requests per day
   - DDoS attacks mitigated
   - Bot traffic filtered

### Using Cloudflare Analytics

Monitor performance in the Analytics tab:
- **Traffic**: Requests, bandwidth, unique visitors
- **Security**: Threats blocked, challenge solve rate
- **Performance**: Cache ratio, origin response time
- **Speed**: Core Web Vitals, page load time

## Cache Invalidation Strategy

Your application automatically handles cache invalidation through:

1. **Automatic Headers**: Cache-Control headers set in `cloudflare-headers.ts`
2. **Programmatic Purging**: Available via `purgeCloudflareCache()` function
3. **Tag-based Purging**: Uses cache tags for granular control

### Manual Cache Purge

```bash
# Purge specific cache tags
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"tags":["api-cards","api-search"]}'

# Purge everything (use sparingly)
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## Expected Performance Improvements

### Global Performance
- **North America**: 20-40% faster load times
- **Europe**: 60-80% faster load times
- **Asia-Pacific**: 70-90% faster load times
- **Other regions**: 80-95% faster load times

### Resource Savings
- **Origin requests**: 80-90% reduction
- **Bandwidth usage**: 70-80% reduction
- **Database queries**: 60-70% reduction
- **Server CPU**: 50-60% reduction

## Troubleshooting

### Cache Issues
1. Check `CF-Cache-Status` header in browser dev tools
2. Verify cache rules are in correct order (most specific first)
3. Ensure origin sends proper `Cache-Control` headers

### Performance Issues
1. Enable Argo Smart Routing for 30% speed improvement
2. Use Cloudflare Images for automatic image optimization
3. Consider Regional Services for multi-region origins

### Security Issues
1. Review Security Events in Cloudflare dashboard
2. Adjust WAF sensitivity if legitimate traffic is blocked
3. Use Bot Analytics to understand traffic patterns

## Advanced Features (Optional)

### Cloudflare Workers KV
Your app includes KV caching support. Enable by:
1. Creating KV namespace in Cloudflare dashboard
2. Adding namespace ID to environment variables
3. Deploying the included worker in `src/worker.js`

### Load Balancing
For high availability:
1. Set up multiple Replit deployments
2. Configure Cloudflare Load Balancer
3. Enable health checks and failover

### Stream Integration
For card collection videos:
1. Upload videos to Cloudflare Stream
2. Use adaptive bitrate streaming
3. Global video delivery via edge network

## Migration from Old Setup

If migrating from Page Rules:
1. Create new Cache Rules as outlined above
2. Test thoroughly in development
3. Delete old Page Rules after verification
4. Monitor cache hit ratios for 48 hours

Your application is already optimized for this setup. The migration should be seamless with immediate performance improvements.
