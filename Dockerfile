# Multi-stage build for production deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install ALL deps (including devDependencies) for build
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source code
COPY . .

# Build the React application
RUN npm run build

# Remove dev dependencies and clean cache
RUN npm prune --production && npm cache clean --force


# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies including MariaDB client for backups
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# Copy package.json to install runtime dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

# Copy build output from builder stage
COPY --from=builder /app/dist ./dist

# Copy server files and ensure package.json is preserved
COPY server ./server
COPY sql ./sql

# Ensure package.json is available (copy again to be safe)
COPY package*.json ./

# Ensure folders exist with proper permissions
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Set proper ownership
RUN chown -R appuser:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/uploads /app/config /app/logs /app/backups

USER appuser

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]
