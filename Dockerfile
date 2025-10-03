# =========================
# Stage 1: Dependencies
# =========================
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools (cached layer)
RUN apk add --no-cache python3 make g++

# Copy package files first for better caching
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund --only=production && \
    npm cache clean --force

# =========================
# Stage 2: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source code (separate layer for better caching)
COPY src ./src
COPY public ./public
COPY index.html vite.config.ts tsconfig*.json components.json tailwind.config.ts postcss.config.js ./

# Build application
RUN npm run build

# =========================
# Stage 3: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies in single layer
RUN apk add --no-cache wget curl dumb-init mariadb-client gzip && \
    rm -rf /var/cache/apk/* && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Copy build artifacts
COPY --from=builder /app/dist ./dist

# Copy server files
COPY server ./server
COPY sql ./sql

# Create directories and set permissions in single layer
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups && \
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
