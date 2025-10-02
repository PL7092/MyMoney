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

# Estratégia robusta: Copia package.json de múltiplas fontes e verifica
COPY package.json ./package.json.original || true
COPY --from=builder /app/package.json ./package.json.builder || true

# Script inline para garantir que package.json existe
RUN set -e; \
    if [ -f "./package.json.original" ]; then \
        cp ./package.json.original ./package.json; \
        echo "Usando package.json do contexto"; \
    elif [ -f "./package.json.builder" ]; then \
        cp ./package.json.builder ./package.json; \
        echo "Usando package.json do builder"; \
    else \
        echo "Criando package.json de emergência"; \
        cat > ./package.json << 'EOF'
{
  "name": "mymoney",
  "version": "1.0.0",
  "main": "server/server.js",
  "scripts": {
    "start": "node server/server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "mysql2": "^3.0.0"
  }
}
EOF
    fi; \
    if [ ! -f "./package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi criado"; \
        exit 1; \
    fi; \
    rm -f ./package.json.original ./package.json.builder 2>/dev/null || true

# Instala apenas production dependencies
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force

# Copia build e arquivos necessários
COPY --from=builder /app/dist ./dist 2>/dev/null || mkdir -p ./dist
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

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/server.js"]
