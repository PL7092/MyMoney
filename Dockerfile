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

# Copia package.json e node_modules do builder
COPY --from=builder /app/package.json ./ 
COPY --from=builder /app/node_modules ./node_modules

# VALIDAÇÃO 9: Após copiar package.json e node_modules no production
RUN set -e; \
    echo "=== VALIDAÇÃO 9: Após copiar package.json e node_modules no production ==="; \
    echo "Conteúdo de /app:"; \
    ls -la /app/; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não foi copiado para /app no stage production"; \
        exit 1; \
    fi; \
    echo "✓ package.json confirmado em /app no stage production"; \
    echo "Tamanho do arquivo:"; \
    wc -c /app/package.json; \
    echo "Conteúdo do package.json:"; \
    head -10 /app/package.json

# VALIDAÇÃO 10: Antes do npm install (removido, pois não vamos rodar npm install no production)
RUN set -e; \
    echo "=== VALIDAÇÃO 10: Verificação final antes de usar node_modules do builder ==="; \
    if [ ! -f "/app/package.json" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: package.json não existe"; \
        exit 1; \
    fi; \
    if [ ! -d "/app/node_modules" ]; then \
        echo "VERIFICAÇÃO FINAL FALHOU: node_modules não existe"; \
        exit 1; \
    fi; \
    echo "✓ package.json e node_modules presentes"; \
    echo "Diretório atual: $(pwd)"; \
    echo "Conteúdo completo de /app:"; \
    ls -la /app/

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

# =========================
# VALIDAÇÃO FINAL DEFINITIVA
# =========================
RUN set -e; \
    echo "=== VALIDAÇÃO FINAL DEFINITIVA: Conferindo /app e package.json ==="; \
    if [ ! -d "/app" ]; then \
        echo "ERRO CRÍTICO: Diretório /app não existe"; \
        exit 1; \
    fi; \
    if [ ! -f "/app/package.json" ]; then \
        echo "ERRO CRÍTICO: package.json não existe em /app"; \
        exit 1; \
    fi; \
    echo "✓ Diretório /app e package.json confirmados"; \
    echo "Conteúdo de /app:"; \
    ls -la /app/

# Muda para usuário não-root
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

EXPOSE 3001

# Comando de inicialização
CMD ["dumb-init", "node", "server/server.js"]
