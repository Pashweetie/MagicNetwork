#!/bin/bash

# Start MTG App with Cloudflare Tunnel
# This script starts both the Node.js server and Cloudflare tunnel

echo "🚀 Starting MTG Card Search App with Cloudflare Tunnel"

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared not found. Installing..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
    echo "✅ cloudflared installed"
fi

# Start the Node.js server in background
echo "🔄 Starting Node.js server..."
npm run dev &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Check if tunnel config exists
if [ ! -f "cloudflare-tunnel.yml" ]; then
    echo "❌ cloudflare-tunnel.yml not found"
    echo "📖 Please follow setup instructions in cloudflare-setup.md"
    kill $SERVER_PID
    exit 1
fi

# Start Cloudflare tunnel
echo "🌐 Starting Cloudflare tunnel..."
cloudflared tunnel --config cloudflare-tunnel.yml run

# Cleanup when script exits
trap "kill $SERVER_PID" EXIT