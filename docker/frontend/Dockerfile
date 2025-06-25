# Frontend Dockerfile for MagicNetwork
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
RUN apk add --no-cache python3 make g++

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
    adduser -S viteuser -u 1001

# Change ownership
RUN chown -R viteuser:nodejs /app
USER viteuser

# Expose Vite dev server port
EXPOSE 5173

# Health check for Vite dev server
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# Start Vite dev server
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]