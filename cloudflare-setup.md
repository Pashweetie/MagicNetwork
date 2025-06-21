# Cloudflare Tunnel Setup for MTG App

## Current Status
Your MTG app is fully functional without Cloudflare tunnel:
- 95,000+ cards accessible via search
- Deck building with persistent storage
- 362MB+ optimized image caching
- Automatic user authentication

## Method 1: API Token (Recommended for Replit)

### 1. Create API Token
1. Visit https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token" → "Custom token"
3. Set permissions:
   - **Account**: Cloudflare Tunnel:Edit
   - **Zone**: Zone:Read
   - **Zone**: DNS:Edit
4. Copy the generated token

### 2. Alternative: Use Existing Tunnel
Since you already have a working tunnel (ID: [YOUR_TUNNEL_ID]), you can:

```bash
# Check existing tunnels with your API token
export CLOUDFLARE_API_TOKEN=4v6CWooEyqISzuRS7jifKvhB2D7fZ-O-7ilTJvc4
curl -X GET "https://api.cloudflare.com/client/v4/accounts/ac4ae31286a0fb4bd57fa90039f8a644/cfd_tunnel" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

### 3. Direct API Method (Bypass Certificate Issue)
```bash
# Create tunnel via API instead of CLI
curl -X POST "https://api.cloudflare.com/client/v4/accounts/ac4ae31286a0fb4bd57fa90039f8a644/cfd_tunnel" \
  -H "Authorization: Bearer 4v6CWooEyqISzuRS7jifKvhB2D7fZ-O-7ilTJvc4" \
  -H "Content-Type: application/json" \
  --data '{"name":"mtg-app-api"}'
```

### 3. Verify Dashboard Connection
After tunnel creation:
1. Visit https://dash.teams.cloudflare.com
2. Navigate to "Access" > "Tunnels"  
3. Confirm your tunnel appears in the list
4. Note the public URL assigned

### 4. Enable Auto-Start (Optional)
To automatically start tunnel with your server:
```bash
# Edit server/index.ts and uncomment tunnel startup code
# Then restart your application
```

## Method 2: Browser Login (if browser works)
```bash
cloudflared tunnel login
```

### 3. Create a Tunnel
```bash
cloudflared tunnel create mtg-app
```
Save the tunnel ID that gets generated.

### 4. Update Configuration
Edit `cloudflare-tunnel.yml` and replace:
- `YOUR_TUNNEL_ID_HERE` with your actual tunnel ID
- `YOUR_TUNNEL_SUBDOMAIN.trycloudflare.com` with your desired subdomain

### 5. Run the Tunnel
```bash
cloudflared tunnel --config cloudflare-tunnel.yml run
```

Your app will be accessible at: `https://your-subdomain.trycloudflare.com`

## Cloudflare Features Enabled

### Security
- DDoS protection (automatic)
- Bot filtering (configurable in dashboard)
- Rate limiting (configure in Security > Rate Limiting)

### Performance  
- Global CDN for static assets
- Image optimization for card images
- Brotli compression

### Caching Rules (Configure in Dashboard)
```
Cache Everything for:
- /assets/* (1 month)
- *.jpg, *.png, *.webp (1 week)
- /api/cards/* (5 minutes)

Bypass Cache for:
- /api/user/* (user-specific data)
- /api/*/vote (dynamic actions)
```

## Custom Domain Setup (Future)

### 1. Purchase Domain
Get a domain from any registrar (Namecheap, GoDaddy, etc.)

### 2. Add Domain to Cloudflare
1. Add site in Cloudflare dashboard
2. Change nameservers at your registrar to Cloudflare's
3. Wait for DNS propagation (up to 24 hours)

### 3. Update Tunnel Configuration
In `cloudflare-tunnel.yml`, change:
```yaml
ingress:
  - hostname: yourmtgapp.com
    service: http://localhost:5000
  - hostname: "*.yourmtgapp.com"  # Optional: for subdomains
    service: http://localhost:5000
```

### 4. Configure DNS Records
In Cloudflare DNS tab:
- A record: `yourmtgapp.com` -> `TUNNEL` (orange cloud enabled)
- CNAME: `www` -> `yourmtgapp.com` (orange cloud enabled)

### 5. Update Replit Configuration
If using custom domain, configure in Replit:
1. Go to your Repl settings
2. Add custom domain: `yourmtgapp.com`
3. Verify domain ownership

## Monitoring & Analytics
- View traffic in Cloudflare Analytics dashboard
- Monitor tunnel status: `cloudflared tunnel info mtg-app`
- Real-time logs: `cloudflared tunnel --config cloudflare-tunnel.yml run --loglevel debug`

## Cost
- Cloudflare Tunnel: **Free**
- Custom domain: ~$10-15/year
- Cloudflare Pro (optional): $20/month for advanced features