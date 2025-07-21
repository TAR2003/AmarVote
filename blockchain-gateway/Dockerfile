# Production Dockerfile for AmarVote Blockchain Gateway
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Create necessary directories and make init script executable
RUN mkdir -p /app/wallets /app/crypto-config /app/crypto-local && \
    chmod +x /app/init-crypto.sh

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Run as non-root user for security (but start as root to copy files)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Start as root to copy crypto materials, then switch to nodejs user
USER root

# Use init script as entrypoint
ENTRYPOINT ["/app/init-crypto.sh"]
