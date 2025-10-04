# =========================
# Stage 1: Dependencies
# =========================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools in single layer with cache cleanup
RUN apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/*

# Copy package files first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund --only=production && \
    npm cache clean --force

# =========================
# Stage 2: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools with cache cleanup
RUN apk add --no-cache python3 make g++ && \
    rm -rf /var/cache/apk/*

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy configuration files first (changes less frequently)
COPY vite.config.ts tsconfig*.json components.json tailwind.config.ts postcss.config.js ./

# Copy source code (separate layer for better caching)
COPY src ./src
COPY public ./public
COPY index.html ./

# Build application with optimizations
RUN npm run build && \
    npm cache clean --force

# =========================
# Stage 3: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies and setup user in single layer
RUN apk add --no-cache wget curl dumb-init mariadb-client gzip && \
    rm -rf /var/cache/apk/* && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    mkdir -p /app/uploads /app/config /app/logs /app/backups

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server
COPY sql ./sql

# Set permissions in single layer
RUN chown -R appuser:nodejs /app && \
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
