# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# Instala ferramentas de build
RUN apk add --no-cache python3 make g++

# Copia package.json e instala dependências
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copia código e faz build
COPY . .
RUN npm run build

# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# Instala runtime dependencies
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# Copia package.json diretamente do contexto
COPY package.json ./

# Verifica se package.json existe e instala dependências
RUN set -e; \
    if [ ! -f "./package.json" ]; then \
        echo "ERRO: package.json não encontrado no contexto"; \
        echo "Criando package.json de emergência"; \
        echo '{"name":"mymoney","version":"1.0.0","main":"server/server.js","scripts":{"start":"node server/server.js"},"dependencies":{"express":"^4.18.0","cors":"^2.8.5","dotenv":"^16.0.0","mysql2":"^3.0.0"}}' > ./package.json; \
    fi; \
    echo "package.json encontrado, instalando dependências..."; \
    npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force

# Copia build e arquivos necessários
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY sql ./sql

# Configura permissões
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/uploads /app/config /app/logs /app/backups

USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Comando de inicialização
CMD ["dumb-init", "node", "server/server.js"]
