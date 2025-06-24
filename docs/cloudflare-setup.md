# Cloudflare Edge Caching Setup for MTG Card Application

## Overview
This guide explains how to implement edge caching for your MTG card application using Cloudflare's global network.

## Benefits
- **Performance**: 50-90% faster load times globally
- **Bandwidth**: Reduce origin server load by 70-80%
- **User Experience**: Sub-second card searches and image loading
- **Cost Savings**: Lower database query costs and server resources

## Required Environment Variables

Add these to your Replit Secrets:

```bash
CLOUDFLARE_ZONE_ID=your_zone_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_KV_NAMESPACE=your_kv_namespace_id_here
```

## Step 1: Domain Setup

1. **Add your domain to Cloudflare**
   - Sign up at cloudflare.com
   - Add your domain (you can use a subdomain like `mtgcards.yourdomain.com`)
   - Update nameservers to Cloudflare's

2. **SSL/TLS Configuration**
   - Set SSL/TLS mode to "Full (strict)"
   - Enable "Always Use HTTPS"

## Step 2: Create KV Namespace

```bash
# Using Cloudflare CLI (optional)
wrangler kv:namespace create "CARD_CACHE"
wrangler kv:namespace create "CARD_CACHE" --preview
```

Or via dashboard:
1. Go to Workers & Pages > KV
2. Create namespace named "CARD_CACHE"
3. Copy the namespace ID to your environment variables

## Step 3: Deploy Worker (Optional)

1. **Create Worker**:
   - Copy `cloudflare-worker.js` to Cloudflare Workers dashboard
   - Set route pattern: `*yourdomain.com/api/cards/*`

2. **Bind KV Namespace**:
   - In Worker settings, bind KV namespace as "CARD_CACHE"

## Step 4: Configure Page Rules

Set these rules in Cloudflare Dashboard > Rules > Page Rules:

### Rule 1: Static Assets
- **Pattern**: `*yourdomain.com/*.{css,js,png,jpg,jpeg,gif,ico,svg,woff,woff2}`
- **Settings**: 
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year

### Rule 2: Card Images  
- **Pattern**: `*cards.scryfall.io/*`
- **Settings**:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Polish: Lossy

### Rule 3: API Responses
- **Pattern**: `*yourdomain.com/api/cards/search*`
- **Settings**:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 hour
  - Browser Cache TTL: 5 minutes

### Rule 4: User Data (No Cache)
- **Pattern**: `*yourdomain.com/api/user/*`
- **Settings**:
  - Cache Level: Bypass

## Step 5: Enable Cloudflare Features

### Speed Optimizations
- **Auto Minify**: Enable CSS, JS, HTML
- **Brotli Compression**: Enable
- **Rocket Loader**: Enable
- **Mirage**: Enable (lazy loading)

### Security
- **Security Level**: Medium
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: Enable

## Step 6: Test Cache Performance

Use these tools to verify caching:

```bash
# Check cache headers
curl -I https://yourdomain.com/api/cards/search?q=lightning

# Expected headers:
# CF-Cache-Status: HIT/MISS
# CF-RAY: [datacenter-id]
# Cache-Control: public, max-age=3600
```

## Cache Invalidation

The application automatically purges cache when:
- Card data is updated
- User imports new deck
- Themes are regenerated

Manual purge via API:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
  -H "Authorization: Bearer {api_token}" \
  -H "Content-Type: application/json" \
  --data '{"tags":["card-search","card-themes"]}'
```

## Performance Monitoring

Monitor cache performance in Cloudflare Analytics:
- **Cache Hit Ratio**: Target 85%+ for static content
- **Bandwidth Savings**: Expect 70-80% reduction
- **Response Time**: Sub-200ms for cached content

## Regional Performance

Expected improvements by region:
- **North America**: 20-40% faster
- **Europe**: 60-80% faster  
- **Asia-Pacific**: 70-90% faster
- **Other regions**: 80-95% faster

## Troubleshooting

### Cache Not Working
1. Check CF-Cache-Status header
2. Verify page rules order (more specific first)
3. Check cache-control headers from origin

### Stale Content
1. Use cache tags for granular purging
2. Implement stale-while-revalidate
3. Set appropriate TTLs for different content types

### Geographic Issues
1. Enable Argo Smart Routing
2. Use regional origins if needed
3. Monitor Core Web Vitals by region