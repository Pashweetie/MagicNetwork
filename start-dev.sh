#!/bin/bash
# Local development server startup script 
# In Replit, use 'npm run dev' instead - this is for local development only

# Load .env file if it exists
if [ -f .env ]; then
  echo "📁 Loading environment variables from .env file"
  export $(grep -v '^#' .env | xargs)
fi

# Try to use DATABASE_URL
if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "your_database_url_here" ]; then
  echo "✅ Using DATABASE_URL from environment"
  exec env NODE_ENV=development \
    DATABASE_URL="$DATABASE_URL" \
    SESSION_SECRET="$SESSION_SECRET" \
    OPENAI_API_KEY="$OPENAI_API_KEY" \
    GOOGLE_API_KEY="$GOOGLE_API_KEY" \
    DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
    npx tsx server/index.ts
else
  echo "❌ DATABASE_URL environment variable not set or using placeholder value"
  echo "This script is for local development only."
  echo "In Replit, use 'npm run dev' and set DATABASE_URL in Secrets."
  echo ""
  echo "To fix this locally:"
  if [ ! -f .env ]; then
    echo "1. Copy example.env to .env: cp example.env .env"
    echo "2. Edit .env file and replace placeholder values with your actual credentials"
  else
    echo "1. Edit the .env file and replace placeholder values with your actual credentials"
  fi
  echo "2. Run: ./start-dev.sh"
  exit 1
fi