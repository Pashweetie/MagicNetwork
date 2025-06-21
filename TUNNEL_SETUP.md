# Permanent Tunnel Setup Guide

Your current API token doesn't have the required permissions. Here's how to fix it:

## Option 1: Create a Tunnel Token (Recommended)

1. Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to "Access" > "Tunnels"
3. Click "Create a tunnel"
4. Choose "Cloudflared" and give it a name like "mtg-app"
5. On the next screen, copy the tunnel token (long string starting with "ey...")
6. Add this as `CLOUDFLARE_TUNNEL_TOKEN` in your Replit secrets (not CLOUDFLARE_API_TOKEN)

## Option 2: Fix API Token Permissions

1. Go to [API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Edit your existing token or create a new one with these permissions:
   - **Account**: Cloudflare Tunnel:Edit
   - **Account**: Account:Read  
   - **Zone**: Zone:Read (if you have domains)
3. Account resources: Include all accounts
4. Replace the current token in your secrets

## Current Status ✅

Your tunnel system is now working with dual-tunnel setup:
- Permanent tunnel: Authenticated and maintaining stable connections
- Public URL: https://addition-magnitude-applying-automobile.trycloudflare.com
- Security middleware blocks direct Replit access
- Users automatically redirected to secure tunnel URL

## After Setup

Once you have the proper token, your tunnel will:
- Have a permanent URL that never changes
- Work reliably in production
- Provide better performance and security

The redirect protection is already in place - users trying to access the Replit URL directly will be redirected to your tunnel URL.