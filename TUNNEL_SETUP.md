# Cloudflare Tunnel Setup Guide

## Current Status
Your MTG app automatically starts a Cloudflare tunnel on server boot. Currently using quick tunnel (temporary URL).

## Setting Up Permanent Tunnel

### Step 1: Get Your Tunnel Credentials
Go to [Cloudflare Zero Trust Dashboard](https://dash.teams.cloudflare.com):
1. Navigate to Access > Tunnels
2. Find your tunnel and note:
   - **Tunnel ID**: Found in the tunnel details
   - **Connector ID**: Found in the connector section (if using connectors)

### Step 2: Add to Replit Secrets
In your Replit project:
1. Click the "Secrets" tab in the left sidebar
2. Add one of these secrets:

**Option A: For Named Tunnels**
- Key: `CLOUDFLARE_TUNNEL_ID`
- Value: Your tunnel ID (e.g., `82f1b399-c427-45f1-8669-8da9f1fbfca1`)

**Option B: For Connector-Based Tunnels**
- Key: `CLOUDFLARE_CONNECTOR_ID`  
- Value: Your connector ID

### Step 3: Restart the Application
The tunnel will automatically use your credentials on next server restart.

## Tunnel Status Logs
Watch the console for these status messages:
- `🌐 Checking Cloudflare tunnel configuration...`
- `📋 Tunnel ID found:` or `🔗 Connector ID found:`
- `🌍 Tunnel URL: https://your-domain.com`
- `✅ Tunnel connection established`
- `🛡️ DDoS protection active`

## No Configuration Needed
If no secrets are set, the system automatically falls back to quick tunnel with a temporary URL.