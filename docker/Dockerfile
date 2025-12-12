# Multi-stage build for Solace Queue Browser Web
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies for proxy server
COPY package*.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built frontend
COPY --from=builder /app/dist ./dist

# Copy proxy server
COPY docker/proxy-server.js ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start proxy server (which also serves static files)
CMD ["node", "proxy-server.js"]
