# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# VERIFICAÇÃO OBRIGATÓRIA: Confirma que /app foi criado
RUN set -e; \
    if [ ! -d "/app" ]; then \
        echo "ERRO CRÍTICO: Diretório /app não foi criado"; \
        exit 1; \
    fi; \
    echo "✓ Diretório /app confirmado"

# Instala ferramentas de build
RUN apk add --no-cache python3 make g++

# Copia package.json e VERIFICA OBRIGATORIAMENTE
COPY package.json ./
RUN set -e; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi copiado para /app"; \
        ls -la /app/; \
        exit 1; \
    fi; \
    echo "✓ package.json confirmado em /app"; \
    cat /app/package.json | head -5

# Instala dependências
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copia código e faz build
COPY . .
RUN npm run build

# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# VERIFICAÇÃO OBRIGATÓRIA: Confirma que /app foi criado
RUN set -e; \
    if [ ! -d "/app" ]; then \
        echo "ERRO CRÍTICO: Diretório /app não foi criado no stage production"; \
        exit 1; \
    fi; \
    echo "✓ Diretório /app confirmado no stage production"

# Instala runtime dependencies
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# Copia package.json e VERIFICA OBRIGATORIAMENTE
COPY package.json ./
RUN set -e; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi copiado para /app no stage production"; \
        echo "Conteúdo de /app:"; \
        ls -la /app/; \
        echo "Tentando criar package.json de emergência..."; \
        echo '{"name":"mymoney","version":"1.0.0","main":"server/server.js","scripts":{"start":"node server/server.js"},"dependencies":{"express":"^4.18.0","cors":"^2.8.5","dotenv":"^16.0.0","mysql2":"^3.0.0"}}' > /app/package.json; \
        if [ ! -f "/app/package.json" ]; then \
            echo "FALHA TOTAL: Não foi possível criar package.json"; \
            exit 1; \
        fi; \
        echo "✓ package.json de emergência criado"; \
    else \
        echo "✓ package.json confirmado em /app no stage production"; \
    fi; \
    echo "Conteúdo do package.json:"; \
    cat /app/package.json | head -10

# VERIFICAÇÃO FINAL ANTES DO NPM INSTALL
RUN set -e; \
    if [ ! -f "/app/package.json" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: package.json não existe"; \
        exit 1; \
    fi; \
    if [ ! -s "/app/package.json" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: package.json está vazio"; \
        exit 1; \
    fi; \
    echo "✓ Verificação final aprovada - package.json existe e não está vazio"

# Instala apenas production dependencies
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
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
