# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

# Diretório de trabalho
WORKDIR /app

# Instala ferramentas de build
RUN apk add --no-cache python3 make g++

# Copia apenas os arquivos de dependências primeiro
COPY package*.json ./

# Instala todas as dependências (dev + prod)
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copia o restante do código
COPY . .

# Build da aplicação React (assumindo que seja frontend)
RUN npm run build

# Remove devDependencies e limpa cache
RUN npm prune --production && npm cache clean --force

# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Instala runtime dependencies necessárias
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# Copia package.json e package-lock.json para instalar runtime deps
COPY package*.json ./

# Instala apenas production dependencies
RUN npm ci --only=production --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

# Copia build do frontend
COPY --from=builder /app/dist ./dist

# Copia servidor, scripts e SQL
COPY server ./server
COPY sql ./sql

# Garante diretórios com permissões corretas
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups \
    && addgroup -g 1001 -S nodejs \
    && adduser -S appuser -u 1001 -G nodejs \
    && chown -R appuser:nodejs /app \
    && chmod -R 755 /app \
    && chmod -R 777 /app/uploads /app/config /app/logs /app/backups

USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Entrypoint com dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]
