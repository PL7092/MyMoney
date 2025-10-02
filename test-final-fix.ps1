# Script para testar a correção final do problema npm

Write-Host "=== TESTE DA CORREÇÃO FINAL ===" -ForegroundColor Green

# 1. Parar containers existentes
Write-Host "1. Parando containers existentes..." -ForegroundColor Yellow
docker-compose down 2>$null

# 2. Limpar imagens antigas
Write-Host "2. Removendo imagem antiga..." -ForegroundColor Yellow
docker rmi mymoney-app 2>$null

# 3. Build nova imagem
Write-Host "3. Construindo nova imagem..." -ForegroundColor Yellow
docker-compose build --no-cache

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build concluído com sucesso" -ForegroundColor Green
} else {
    Write-Host "✗ Erro no build" -ForegroundColor Red
    exit 1
}

# 4. Iniciar aplicação
Write-Host "4. Iniciando aplicação..." -ForegroundColor Yellow
docker-compose up -d

# 5. Aguardar e verificar logs
Write-Host "5. Aguardando inicialização (10 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "6. Verificando logs..." -ForegroundColor Yellow
docker-compose logs --tail=20 mymoney-app

Write-Host "=== TESTE CONCLUÍDO ===" -ForegroundColor Green
Write-Host "Se não vir mais erros de npm, o problema foi resolvido!" -ForegroundColor Cyan