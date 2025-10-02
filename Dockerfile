# =========================
# Stage 1: Builder
# =========================
FROM node:20-alpine AS builder

WORKDIR /app

# VALIDAÇÃO 1: Confirma que /app foi criado
RUN set -e; \
    echo "=== VALIDAÇÃO 1: Verificando diretório /app ==="; \
    if [ ! -d "/app" ]; then \
        echo "ERRO CRÍTICO: Diretório /app não foi criado"; \
        exit 1; \
    fi; \
    echo "✓ Diretório /app confirmado"; \
    ls -la /app/ || echo "Diretório /app vazio"

# Instala ferramentas de build
RUN apk add --no-cache python3 make g++

# VALIDAÇÃO 2: Antes de copiar package.json
RUN set -e; \
    echo "=== VALIDAÇÃO 2: Antes de copiar package.json ==="; \
    echo "Conteúdo atual de /app:"; \
    ls -la /app/ || echo "Diretório /app vazio"

# Copia package.json
COPY package.json ./

# VALIDAÇÃO 3: Após copiar package.json
RUN set -e; \
    echo "=== VALIDAÇÃO 3: Após copiar package.json ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi copiado para /app"; \
        exit 1; \
    fi; \
    echo "✓ package.json confirmado em /app"; \
    echo "Tamanho do arquivo:"; \
    wc -c /app/package.json; \
    echo "Primeiras 5 linhas:"; \
    head -5 /app/package.json

# Instala dependências
RUN npm install --legacy-peer-deps --no-audit --no-fund

# VALIDAÇÃO 4: Após npm install
RUN set -e; \
    echo "=== VALIDAÇÃO 4: Após npm install ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu após npm install"; \
        exit 1; \
    fi; \
    echo "✓ package.json ainda existe após npm install"

# Copia código e faz build
COPY . .

# VALIDAÇÃO 5: Após copiar código
RUN set -e; \
    echo "=== VALIDAÇÃO 5: Após copiar código ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu após copiar código"; \
        exit 1; \
    fi; \
    echo "✓ package.json ainda existe após copiar código"

RUN npm run build

# VALIDAÇÃO 6: Após npm run build
RUN set -e; \
    echo "=== VALIDAÇÃO 6: Após npm run build ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu após npm run build"; \
        exit 1; \
    fi; \
    echo "✓ package.json ainda existe após npm run build"

# =========================
# Stage 2: Production
# =========================
FROM node:20-alpine AS production

WORKDIR /app

# VALIDAÇÃO 7: Início do stage production
RUN set -e; \
    echo "=== VALIDAÇÃO 7: Início do stage production ==="; \
    if [ ! -d "/app" ]; then \
        echo "ERRO CRÍTICO: Diretório /app não foi criado no stage production"; \
        exit 1; \
    fi; \
    echo "✓ Diretório /app confirmado no stage production"; \
    echo "Conteúdo inicial de /app:"; \
    ls -la /app/ || echo "Diretório /app vazio"

# Instala runtime dependencies
RUN apk add --no-cache \
    wget \
    curl \
    dumb-init \
    mariadb-client \
    gzip \
    && rm -rf /var/cache/apk/*

# VALIDAÇÃO 8: Após instalar dependências do sistema
RUN set -e; \
    echo "=== VALIDAÇÃO 8: Após instalar dependências do sistema ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/ || echo "Diretório /app vazio"; \
    echo "✓ /app ainda existe após instalar dependências do sistema"

# Copia package.json
COPY package.json ./

# VALIDAÇÃO 9: Após copiar package.json no production
RUN set -e; \
    echo "=== VALIDAÇÃO 9: Após copiar package.json no production ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi copiado para /app no stage production"; \
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
    echo "Tamanho do arquivo:"; \
    wc -c /app/package.json; \
    echo "Conteúdo do package.json:"; \
    head -10 /app/package.json

# VALIDAÇÃO 10: Antes do npm install
RUN set -e; \
    echo "=== VALIDAÇÃO 10: Antes do npm install ==="; \
    if [ ! -f "/app/package.json" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: package.json não existe"; \
        exit 1; \
    fi; \
    if [ ! -s "/app/package.json" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: package.json está vazio"; \
        exit 1; \
    fi; \
    echo "✓ Verificação final aprovada - package.json existe e não está vazio"; \
    echo "Diretório atual: $(pwd)"; \
    echo "Conteúdo completo de /app:"; \
    ls -la /app/

# Instala apenas production dependencies
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund && \
    npm cache clean --force

# VALIDAÇÃO 11: Após npm install no production
RUN set -e; \
    echo "=== VALIDAÇÃO 11: Após npm install no production ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu após npm install no production"; \
        exit 1; \
    fi; \
    echo "✓ package.json ainda existe após npm install no production"

# Copia build e arquivos necessários
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY sql ./sql

# VALIDAÇÃO 12: Após copiar arquivos finais
RUN set -e; \
    echo "=== VALIDAÇÃO 12: Após copiar arquivos finais ==="; \
    echo "Conteúdo final de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu após copiar arquivos finais"; \
        exit 1; \
    fi; \
    echo "✓ package.json ainda existe após copiar arquivos finais"

# Configura permissões
RUN mkdir -p /app/uploads /app/config /app/logs /app/backups && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app && \
    chmod -R 755 /app && \
    chmod -R 777 /app/uploads /app/config /app/logs /app/backups

# VALIDAÇÃO FINAL: Antes de mudar para usuário não-root
RUN set -e; \
    echo "=== VALIDAÇÃO FINAL: Antes de mudar para usuário não-root ==="; \
    echo "Conteúdo final de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO: package.json desapareceu antes de mudar usuário"; \
        exit 1; \
    fi; \
    echo "✓ package.json confirmado antes de mudar usuário"

USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Comando de inicialização
CMD ["dumb-init", "node", "server/server.js"]
