# Script para testar o que está a acontecer no container

Write-Host "=== TESTE DO CONTAINER ===" -ForegroundColor Green

# 1. Build da imagem
Write-Host "1. Construindo imagem..." -ForegroundColor Yellow
docker build -t mymoney-test .

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Erro no build" -ForegroundColor Red
    exit 1
}

# 2. Executar container e verificar conteúdo
Write-Host "2. Verificando conteúdo do container..." -ForegroundColor Yellow
docker run --rm mymoney-test sh -c "echo '=== CONTEÚDO DE /app ===' && ls -la /app/ && echo '=== PACKAGE.JSON EXISTS? ===' && test -f /app/package.json && echo 'SIM' || echo 'NÃO' && echo '=== COMANDO QUE VAI EXECUTAR ===' && echo 'node server/server.js'"

Write-Host "3. Testando execução normal..." -ForegroundColor Yellow
docker run --rm --name mymoney-test-run -p 3001:3001 mymoney-test

Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green