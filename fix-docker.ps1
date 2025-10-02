# Script para corrigir o problema do package.json no Docker

Write-Host "=== Corrigindo problema do package.json no Docker ===" -ForegroundColor Green

# 1. Parar containers existentes
Write-Host "1. Parando containers existentes..." -ForegroundColor Yellow
docker-compose down
docker rm -f MyMoney 2>$null

# 2. Remover imagens antigas e limpar cache
Write-Host "2. Removendo imagens antigas e limpando cache..." -ForegroundColor Yellow
docker rmi mymoney_app 2>$null
docker rmi mymoney-app 2>$null
docker system prune -f
docker builder prune -f

# 3. Verificar se package.json existe no projeto
Write-Host "3. Verificando package.json..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "✓ package.json encontrado no projeto" -ForegroundColor Green
} else {
    Write-Host "✗ package.json NÃO encontrado no projeto!" -ForegroundColor Red
    exit 1
}

# 4. Reconstruir imagem sem cache
Write-Host "4. Reconstruindo imagem sem cache..." -ForegroundColor Yellow
docker-compose build --no-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build concluído com sucesso" -ForegroundColor Green
} else {
    Write-Host "✗ Erro no build" -ForegroundColor Red
    exit 1
}

# 5. Iniciar container
Write-Host "5. Iniciando container..." -ForegroundColor Yellow
docker-compose up -d

# 6. Verificar logs
Write-Host "6. Verificando logs (primeiros 10 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
docker logs MyMoney --tail 20

Write-Host "=== Script concluído ===" -ForegroundColor Green
Write-Host "Verifique os logs acima para confirmar se o erro foi resolvido." -ForegroundColor Cyan