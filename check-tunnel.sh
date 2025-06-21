#!/bin/bash

# Check if the tunnel has any configured public hostnames
echo "Checking tunnel configuration..."

# Try to get tunnel info
curl -s -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  "https://api.cloudflare.com/client/v4/accounts/ac4ae31286a0fb4bd57fa90039f8a644/cfd_tunnel/82f1b399-c427-45f1-8669-8da9f1fbfca1" \
  | jq '.result.config.ingress // "no-config"' 2>/dev/null || echo "No tunnel config found"

echo ""
echo "The tunnel token authenticates successfully but needs public hostname configuration."
echo "To fix this, you need to:"
echo "1. Go to https://one.dash.cloudflare.com/"
echo "2. Navigate to Access > Tunnels"
echo "3. Find tunnel: 82f1b399-c427-45f1-8669-8da9f1fbfca1"
echo "4. Add a public hostname (e.g., mtg-app.your-domain.com)"