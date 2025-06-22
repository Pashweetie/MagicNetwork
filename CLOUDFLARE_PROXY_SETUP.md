# Cloudflare Proxy Setup for Replit App

This guide shows how to add Cloudflare protection to your Replit app without tunnels.

## Benefits of This Approach
- No unreliable tunnel connections
- Free tier includes DDoS protection, bot filtering, rate limiting
- Global CDN for faster loading
- Analytics and security monitoring
- Works with your existing `.replit.app` domain

## Setup Steps

### 1. Deploy Your App on Replit
Your app is already configured for Replit deployment:
- Uses port 5000 (required by Replit)
- Binds to 0.0.0.0 (required for external access)
- Includes production build configuration

To deploy:
1. Ensure your app is working locally
2. Click "Deploy" in Replit interface
3. Your app will be available at: `https://your-repl-name.username.replit.app`

### 2. Add Cloudflare Proxy (Optional but Recommended)

#### Method A: Free Cloudflare Account
1. Sign up at https://cloudflare.com (free tier)
2. Add a site: Use a domain you own or buy one
3. Change nameservers to Cloudflare's
4. Add CNAME record pointing to your Replit domain:
   ```
   Type: CNAME
   Name: @ (or www)
   Target: your-repl-name.username.replit.app
   Proxy: Enabled (orange cloud)
   ```

#### Method B: Use Replit Domain with Cloudflare Workers (Advanced)
1. Create Cloudflare Worker
2. Route worker to your domain
3. Proxy requests to Replit domain

### 3. Configure Cloudflare Settings

#### Security Settings
- **SSL/TLS**: Full (strict)
- **Always Use HTTPS**: On
- **HSTS**: Enable
- **Bot Fight Mode**: On (free)

#### Performance Settings
- **Auto Minify**: CSS, JS, HTML
- **Brotli**: On
- **Rocket Loader**: On (test first)

#### Caching Rules
```
Static Assets (1 year):
- File extensions: js, css, png, jpg, jpeg, gif, ico, svg, woff, woff2
- Cache Level: Cache Everything

API Responses (5 minutes):
- URL pattern: /api/cards/*
- Cache Level: Cache Everything
- Edge Cache TTL: 5 minutes

User Data (No cache):
- URL pattern: /api/user/*
- Cache Level: Bypass
```

#### Rate Limiting (Free Tier: 10,000 requests/month)
```
API Protection:
- URL pattern: /api/*
- Rate: 100 requests per minute per IP
- Action: Block

Search API:
- URL pattern: /api/cards/search*
- Rate: 50 requests per minute per IP
- Action: Challenge then block
```

## Current App Security Features

Your app already includes:
- Express rate limiting for API routes
- Security headers (XSS protection, CSRF prevention)
- Authentication on sensitive endpoints
- Input validation with Zod schemas
- PostgreSQL injection protection via Drizzle ORM

## Monitoring

### Cloudflare Analytics (Free)
- Traffic overview
- Security events
- Bot detection
- Performance metrics

### Application Logs
Your app logs are available in Replit's console:
- API request timing
- Database query performance
- Error tracking
- Cache hit rates

## Cost Breakdown

- **Replit Hosting**: Free tier available, paid plans for production
- **Custom Domain**: ~$10-15/year (optional)
- **Cloudflare**: Free tier sufficient for most apps

## Migration from Tunnels

✅ **Completed Changes:**
- Removed unreliable tunnel dependencies
- Cleaned up tunnel-related code
- Optimized for Replit deployment
- Added basic security headers

## Next Steps

1. Test your app thoroughly in development
2. Deploy to Replit
3. Optionally add Cloudflare proxy
4. Monitor performance and security

Your MTG app is now ready for reliable deployment without tunnel complexity!