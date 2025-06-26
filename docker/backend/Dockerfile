# Backend Dockerfile for MagicNetwork
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Install dependencies with retry logic
RUN npm config set registry https://registry.npmjs.org/ && \
    npm install --no-audit --no-fund --prefer-offline || \
    (sleep 5 && npm install --no-audit --no-fund) || \
    (sleep 10 && npm install --no-audit --no-fund --registry https://registry.yarnpkg.com)

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S magicuser -u 1001

# Change ownership of app directory
RUN chown -R magicuser:nodejs /app
USER magicuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:5000/api/cards/search?query=test&limit=1 || exit 1

# Start command
CMD ["npm", "run", "dev"]