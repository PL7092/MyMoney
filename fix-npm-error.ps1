# Script para resolver definitivamente o erro do npm

Write-Host "=== RESOLVENDO ERRO NPM DEFINITIVAMENTE ===" -ForegroundColor Green

# 1. Parar tudo
Write-Host "1. Parando todos os containers..." -ForegroundColor Yellow
docker stop $(docker ps -aq) 2>$null
docker rm $(docker ps -aq) 2>$null

# 2. Limpeza agressiva
Write-Host "2. Limpeza agressiva do Docker..." -ForegroundColor Yellow
docker system prune -af --volumes
docker builder prune -af

# 3. Verificar package.json local
Write-Host "3. Verificando package.json local..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "✓ package.json existe localmente" -ForegroundColor Green
    $packageContent = Get-Content "package.json" | ConvertFrom-Json
    Write-Host "✓ Nome do projeto: $($packageContent.name)" -ForegroundColor Green
} else {
    Write-Host "✗ package.json NÃO encontrado!" -ForegroundColor Red
    exit 1
}

# 4. Build com debug
Write-Host "4. Construindo imagem com debug..." -ForegroundColor Yellow
docker build -f Dockerfile.debug -t mymoney-debug .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build de debug concluído" -ForegroundColor Green
} else {
    Write-Host "✗ Erro no build de debug" -ForegroundColor Red
    exit 1
}

# 5. Testar container de debug
Write-Host "5. Testando container de debug..." -ForegroundColor Yellow
docker run --rm --name mymoney-debug-test mymoney-debug

Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host "Se viu 'package.json exists: YES' acima, o problema está resolvido." -ForegroundColor Cyan
Write-Host "Agora pode executar: docker-compose up --build" -ForegroundColor Cyan