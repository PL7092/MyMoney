# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source code and build
COPY . .
RUN npm run build

# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# Copy package.json and node_modules from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy build and necessary files
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY sql ./sql

# Create directories and set permissions
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/uploads /app/config /app/logs /app/backups

# Switch to non-root user
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Start command
CMD ["dumb-init", "node", "server/server.js"]
