#!/usr/bin/env pwsh

Write-Host "=== Teste de Construção da Aplicação ===" -ForegroundColor Green

# Para containers existentes
Write-Host "1. Parando containers..." -ForegroundColor Yellow
docker-compose down 2>$null

# Remove imagens antigas
Write-Host "2. Removendo imagens antigas..." -ForegroundColor Yellow
docker rmi mymoney-app:latest 2>$null

# Constrói a aplicação
Write-Host "3. Construindo aplicação..." -ForegroundColor Yellow
docker-compose build app

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Construção bem-sucedida!" -ForegroundColor Green
    
    # Testa se a aplicação inicia
    Write-Host "4. Testando inicialização..." -ForegroundColor Yellow
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Aplicação iniciada com sucesso!" -ForegroundColor Green
        
        # Aguarda alguns segundos e verifica logs
        Start-Sleep -Seconds 10
        Write-Host "5. Verificando logs..." -ForegroundColor Yellow
        docker-compose logs app
    } else {
        Write-Host "❌ Erro ao iniciar aplicação!" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Erro na construção!" -ForegroundColor Red
}

Write-Host "=== Teste Concluído ===" -ForegroundColor Green