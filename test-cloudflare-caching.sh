#!/bin/bash

echo "Testing Cloudflare Cache Behavior..."
echo

# Test static asset caching
echo "1. Testing static asset headers:"
curl -I http://localhost:5000/assets/example.js 2>/dev/null | grep -i "cache-control"

# Test API endpoint caching
echo "2. Testing card search API headers:"
curl -I "http://localhost:5000/api/cards/search?q=dragon" 2>/dev/null | grep -i "cache-control"

# Test card data API headers  
echo "3. Testing card data API headers:"
curl -I "http://localhost:5000/api/cards/e882c9f9-bf30-46b6-bedc-3be5fa3d8586" 2>/dev/null | grep -i "cache-control"

# Test user data (should not cache)
echo "4. Testing user data headers (should not cache):"
curl -I "http://localhost:5000/api/user/deck" 2>/dev/null | grep -i "cache-control"

echo
echo "Cache headers configured for Cloudflare optimization:"
echo "- Static assets: 1 year cache"
echo "- Card searches: 1 hour cache" 
echo "- Card data: 24 hour cache"
echo "- User data: Private, no cache"