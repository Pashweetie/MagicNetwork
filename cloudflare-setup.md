# Cloudflare Tunnel Setup for MTG App

## Quick Setup (No Custom Domain Required)

### 1. Install Cloudflared
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 2. Authenticate with Cloudflare
```bash
cloudflared tunnel login
```
This opens a browser window to log into your Cloudflare account and authorize the tunnel.

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