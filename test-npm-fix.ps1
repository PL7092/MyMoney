#!/usr/bin/env pwsh

Write-Host "=== Testing NPM Synchronization Fixes ===" -ForegroundColor Green

# Stop any running containers
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose down 2>$null

# Remove old images to force rebuild
Write-Host "Removing old images..." -ForegroundColor Yellow
docker rmi mymoney-app 2>$null

# Build with no cache to test fixes
Write-Host "Building Docker image with npm fixes..." -ForegroundColor Yellow
$buildResult = docker-compose build --no-cache app 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker build successful! NPM issues resolved." -ForegroundColor Green
    
    # Test container startup
    Write-Host "Testing container startup..." -ForegroundColor Yellow
    docker-compose up -d app
    
    Start-Sleep -Seconds 5
    
    # Check if container is running
    $containerStatus = docker-compose ps app --format "table {{.Status}}"
    Write-Host "Container status: $containerStatus" -ForegroundColor Cyan
    
    # Show logs
    Write-Host "Container logs:" -ForegroundColor Cyan
    docker-compose logs app --tail 10
    
} else {
    Write-Host "❌ Docker build failed. Check output above for errors." -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
}

Write-Host "=== Test Complete ===" -ForegroundColor Green