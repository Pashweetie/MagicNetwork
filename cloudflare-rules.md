# Cloudflare Configuration Rules

## Security Rules (Configure in Dashboard > Security)

### Rate Limiting Rules
```
Rule 1: API Protection
- If URI Path contains "/api/"
- Rate: 100 requests per minute per IP
- Action: Block for 10 minutes

Rule 2: Search Protection  
- If URI Path is "/api/cards/search"
- Rate: 30 requests per minute per IP
- Action: Challenge (CAPTCHA)

Rule 3: Deck Operations
- If URI Path contains "/api/user/deck"
- Rate: 20 requests per minute per IP
- Action: Block for 5 minutes
```

### Firewall Rules
```
Rule 1: Block Bad Bots
- If Known Bots is "Bad Bot"
- Action: Block

Rule 2: Geographic Restrictions (Optional)
- If Country is in "High Risk List"
- Action: Challenge

Rule 3: Threat Score
- If Threat Score > 50
- Action: Challenge
```

## Caching Rules (Configure in Dashboard > Caching)

### Page Rules
```
Rule 1: Static Assets
- URL: *yourmtgapp.com/assets/*
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
- Browser Cache TTL: 1 week

Rule 2: Card Images
- URL: *cards.scryfall.io/*
- Cache Level: Cache Everything  
- Edge Cache TTL: 1 week
- Browser Cache TTL: 1 day

Rule 3: API Responses
- URL: *yourmtgapp.com/api/cards/*
- Cache Level: Cache Everything
- Edge Cache TTL: 5 minutes
- Browser Cache TTL: 1 minute

Rule 4: User-Specific APIs (No Cache)
- URL: *yourmtgapp.com/api/user/*
- Cache Level: Bypass
```

### Cache Rules (New Interface)
```
Rule 1: Card Search Cache
- If URI Path starts with "/api/cards/search"
- Cache Status: Eligible for cache
- Edge TTL: 300 seconds (5 minutes)

Rule 2: User Data Bypass
- If URI Path starts with "/api/user/"  
- Cache Status: Bypass cache

Rule 3: Static Assets Cache
- If File Extension is in "jpg png webp css js"
- Cache Status: Eligible for cache
- Edge TTL: 86400 seconds (1 day)
```

## Performance Rules

### Speed Optimizations
```
Auto Minify: Enable CSS, HTML, JavaScript
Brotli Compression: Enable
Rocket Loader: Enable (JavaScript optimization)
Mirage: Enable (Image optimization)
Polish: Enable (Image compression)
```

### HTTP/3 & TLS
```
HTTP/3: Enable
TLS 1.3: Enable
0-RTT Connection Resumption: Enable
Minimum TLS Version: 1.2
```

## Bot Management (Pro Plan)

### Bot Score Rules
```
Rule 1: Super Bot Detection
- If Bot Score < 30
- Action: Allow

Rule 2: Likely Bot
- If Bot Score 30-70
- Action: Challenge

Rule 3: Definite Bot  
- If Bot Score > 70
- Action: Block
```

## Transform Rules (Optional)

### HTTP Response Headers
```
Rule 1: Security Headers
- Add Header: X-Frame-Options: DENY
- Add Header: X-Content-Type-Options: nosniff
- Add Header: Referrer-Policy: strict-origin-when-cross-origin

Rule 2: CORS Headers (if needed)
- Add Header: Access-Control-Allow-Origin: *
- Add Header: Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

## DNS Settings

### For Custom Domain
```
A Record: yourmtgapp.com -> TUNNEL (Proxied)
CNAME: www -> yourmtgapp.com (Proxied)
CNAME: api -> yourmtgapp.com (Proxied)
```

### SSL/TLS Settings
```
SSL Mode: Full (Strict)
Edge Certificates: Universal SSL
Always Use HTTPS: Enable
HSTS: Enable with 6 months max age
```

## Analytics & Monitoring

### Web Analytics
```
Enable Cloudflare Web Analytics
Track: Page views, unique visitors, bounce rate
Filter: Remove bot traffic from analytics
```

### Security Events
```
Monitor: Rate limiting triggers
Monitor: Firewall blocks
Monitor: Challenge completions
Alert: Email notifications for high threat activity
```