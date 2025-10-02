# =====================================================
# MYMONEY - SCRIPT DE DEPLOY PARA PRODUÇÃO
# =====================================================
# 
# Este script automatiza o deploy da aplicação MyMoney
# em ambiente de produção usando Docker Compose
#
# Uso: .\deploy-production.ps1 [opções]
# 
# Opções:
#   -Environment: dev, staging, production (padrão: production)
#   -SkipBackup: Pula o backup antes do deploy
#   -SkipHealthCheck: Pula a verificação de saúde
#   -Force: Força o deploy mesmo com avisos
#   -Help: Mostra esta ajuda
#
# =====================================================

param(
    [string]$Environment = "production",
    [switch]$SkipBackup = $false,
    [switch]$SkipHealthCheck = $false,
    [switch]$Force = $false,
    [switch]$Help = $false
)

# Configurações
$ScriptVersion = "1.0.0"
$ProjectName = "MyMoney"
$LogFile = "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# Cores para output
$ColorSuccess = "Green"
$ColorWarning = "Yellow"
$ColorError = "Red"
$ColorInfo = "Cyan"

# =====================================================
# FUNÇÕES AUXILIARES
# =====================================================

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO",
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    
    Write-Host $logMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $logMessage
}

function Write-Success {
    param([string]$Message)
    Write-Log $Message "SUCCESS" $ColorSuccess
}

function Write-Warning {
    param([string]$Message)
    Write-Log $Message "WARNING" $ColorWarning
}

function Write-Error {
    param([string]$Message)
    Write-Log $Message "ERROR" $ColorError
}

function Write-Info {
    param([string]$Message)
    Write-Log $Message "INFO" $ColorInfo
}

function Show-Help {
    Write-Host @"

$ProjectName - Script de Deploy para Produção v$ScriptVersion

USO:
    .\deploy-production.ps1 [opções]

OPÇÕES:
    -Environment <env>     Ambiente de deploy (dev, staging, production)
    -SkipBackup           Pula o backup antes do deploy
    -SkipHealthCheck      Pula a verificação de saúde pós-deploy
    -Force                Força o deploy mesmo com avisos
    -Help                 Mostra esta ajuda

EXEMPLOS:
    .\deploy-production.ps1
    .\deploy-production.ps1 -Environment staging
    .\deploy-production.ps1 -SkipBackup -Force

PRÉ-REQUISITOS:
    - Docker e Docker Compose instalados
    - Arquivo .env configurado
    - Permissões adequadas para execução

"@ -ForegroundColor $ColorInfo
}

function Test-Prerequisites {
    Write-Info "Verificando pré-requisitos..."
    
    # Verificar Docker
    try {
        $dockerVersion = docker --version
        Write-Success "Docker encontrado: $dockerVersion"
    }
    catch {
        Write-Error "Docker não encontrado. Instale o Docker antes de continuar."
        return $false
    }
    
    # Verificar Docker Compose
    try {
        $composeVersion = docker compose version
        Write-Success "Docker Compose encontrado: $composeVersion"
    }
    catch {
        Write-Error "Docker Compose não encontrado. Instale o Docker Compose antes de continuar."
        return $false
    }
    
    # Verificar arquivos necessários
    $requiredFiles = @(
        "docker-compose.yml",
        "Dockerfile",
        "package.json"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            Write-Error "Arquivo obrigatório não encontrado: $file"
            return $false
        }
    }
    Write-Success "Todos os arquivos obrigatórios encontrados"
    
    # Verificar arquivo .env
    if (-not (Test-Path ".env")) {
        if (Test-Path ".env.production") {
            Write-Warning "Arquivo .env não encontrado. Copiando .env.production..."
            Copy-Item ".env.production" ".env"
            Write-Info "IMPORTANTE: Revise e configure o arquivo .env antes de continuar!"
            
            if (-not $Force) {
                $response = Read-Host "Deseja continuar? (y/N)"
                if ($response -ne "y" -and $response -ne "Y") {
                    Write-Info "Deploy cancelado pelo usuário."
                    return $false
                }
            }
        }
        else {
            Write-Error "Arquivo .env não encontrado. Configure as variáveis de ambiente antes de continuar."
            return $false
        }
    }
    Write-Success "Arquivo .env encontrado"
    
    return $true
}

function Backup-Application {
    if ($SkipBackup) {
        Write-Warning "Backup pulado conforme solicitado"
        return $true
    }
    
    Write-Info "Iniciando backup da aplicação..."
    
    $backupDir = "backups"
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupPath = "$backupDir/backup-$timestamp"
    
    # Criar diretório de backup
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    New-Item -ItemType Directory -Path $backupPath | Out-Null
    
    try {
        # Backup da base de dados (se container estiver rodando)
        $mariadbContainer = docker ps --filter "name=mariadb" --format "{{.Names}}" | Select-Object -First 1
        if ($mariadbContainer) {
            Write-Info "Fazendo backup da base de dados..."
            $dbBackupFile = "$backupPath/database-$timestamp.sql"
            
            # Obter senha do .env
            $envContent = Get-Content ".env" | Where-Object { $_ -match "DB_ROOT_PASSWORD=" }
            if ($envContent) {
                $dbPassword = ($envContent -split "=")[1]
                docker exec $mariadbContainer mysqldump -u root -p$dbPassword --single-transaction --routines --triggers mymoney_prod > $dbBackupFile
                Write-Success "Backup da base de dados criado: $dbBackupFile"
            }
            else {
                Write-Warning "Não foi possível obter a senha da base de dados do arquivo .env"
            }
        }
        else {
            Write-Warning "Container MariaDB não está rodando. Backup da base de dados pulado."
        }
        
        # Backup dos uploads (se existir)
        if (Test-Path "data/uploads") {
            Write-Info "Fazendo backup dos uploads..."
            Compress-Archive -Path "data/uploads" -DestinationPath "$backupPath/uploads-$timestamp.zip"
            Write-Success "Backup dos uploads criado"
        }
        
        # Backup das configurações
        Write-Info "Fazendo backup das configurações..."
        Copy-Item ".env" "$backupPath/env-$timestamp.backup"
        Copy-Item "docker-compose.yml" "$backupPath/docker-compose-$timestamp.yml"
        
        Write-Success "Backup completo criado em: $backupPath"
        return $true
    }
    catch {
        Write-Error "Erro durante o backup: $($_.Exception.Message)"
        return $false
    }
}

function Deploy-Application {
    Write-Info "Iniciando deploy da aplicação..."
    
    try {
        # Parar containers existentes
        Write-Info "Parando containers existentes..."
        docker compose down
        
        # Limpar recursos não utilizados
        Write-Info "Limpando recursos Docker não utilizados..."
        docker system prune -f
        
        # Pull das imagens mais recentes
        Write-Info "Baixando imagens mais recentes..."
        docker compose pull
        
        # Build da aplicação
        Write-Info "Construindo aplicação..."
        docker compose build --no-cache
        
        # Iniciar serviços
        Write-Info "Iniciando serviços..."
        docker compose up -d
        
        Write-Success "Deploy concluído com sucesso!"
        return $true
    }
    catch {
        Write-Error "Erro durante o deploy: $($_.Exception.Message)"
        return $false
    }
}

function Test-ApplicationHealth {
    if ($SkipHealthCheck) {
        Write-Warning "Verificação de saúde pulada conforme solicitado"
        return $true
    }
    
    Write-Info "Verificando saúde da aplicação..."
    
    # Aguardar containers iniciarem
    Write-Info "Aguardando containers iniciarem..."
    Start-Sleep -Seconds 30
    
    # Verificar status dos containers
    $containers = docker compose ps --format "{{.Service}} {{.State}}"
    foreach ($container in $containers) {
        $parts = $container -split " "
        $service = $parts[0]
        $state = $parts[1]
        
        if ($state -eq "running") {
            Write-Success "Container $service está rodando"
        }
        else {
            Write-Error "Container $service não está rodando (estado: $state)"
            return $false
        }
    }
    
    # Verificar health check da aplicação
    $maxAttempts = 10
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        try {
            Write-Info "Tentativa $attempt/$maxAttempts - Verificando endpoint de saúde..."
            $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 10
            
            if ($response.StatusCode -eq 200) {
                Write-Success "Aplicação está respondendo corretamente!"
                
                # Verificar health check detalhado
                try {
                    $detailedResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/health/detailed" -TimeoutSec 10
                    $healthData = $detailedResponse.Content | ConvertFrom-Json
                    
                    Write-Info "Status detalhado da aplicação:"
                    Write-Info "  - Base de dados: $($healthData.database.status)"
                    Write-Info "  - Cache Redis: $($healthData.redis.status)"
                    Write-Info "  - Memória: $($healthData.system.memory.used)/$($healthData.system.memory.total)"
                    
                    return $true
                }
                catch {
                    Write-Warning "Não foi possível obter status detalhado, mas aplicação está respondendo"
                    return $true
                }
            }
        }
        catch {
            Write-Warning "Tentativa $attempt falhou: $($_.Exception.Message)"
        }
        
        if ($attempt -lt $maxAttempts) {
            Write-Info "Aguardando 10 segundos antes da próxima tentativa..."
            Start-Sleep -Seconds 10
        }
        
        $attempt++
    }
    
    Write-Error "Aplicação não está respondendo após $maxAttempts tentativas"
    return $false
}

function Show-DeploymentSummary {
    Write-Info "=== RESUMO DO DEPLOY ==="
    
    # Status dos containers
    Write-Info "Status dos containers:"
    docker compose ps
    
    # URLs de acesso
    Write-Info ""
    Write-Info "URLs de acesso:"
    Write-Info "  - Aplicação: http://localhost:3000"
    Write-Info "  - Health Check: http://localhost:3000/health"
    Write-Info "  - API Health: http://localhost:3000/api/health/detailed"
    
    # Logs
    Write-Info ""
    Write-Info "Para visualizar logs:"
    Write-Info "  docker compose logs -f"
    Write-Info "  docker compose logs -f mymoney-app"
    
    # Comandos úteis
    Write-Info ""
    Write-Info "Comandos úteis:"
    Write-Info "  - Parar: docker compose down"
    Write-Info "  - Reiniciar: docker compose restart"
    Write-Info "  - Logs: docker compose logs -f"
    Write-Info "  - Status: docker compose ps"
    
    Write-Info ""
    Write-Success "Deploy concluído! Log salvo em: $LogFile"
}

function Rollback-Deployment {
    Write-Warning "Iniciando rollback do deploy..."
    
    try {
        # Parar containers atuais
        docker compose down
        
        # Verificar se existe backup recente
        $backupDir = "backups"
        if (Test-Path $backupDir) {
            $latestBackup = Get-ChildItem $backupDir | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            
            if ($latestBackup) {
                Write-Info "Backup mais recente encontrado: $($latestBackup.Name)"
                
                # Restaurar configurações
                $envBackup = Get-ChildItem "$($latestBackup.FullName)" -Filter "env-*.backup" | Select-Object -First 1
                if ($envBackup) {
                    Copy-Item $envBackup.FullName ".env"
                    Write-Success "Configurações restauradas"
                }
                
                # Restaurar docker-compose
                $composeBackup = Get-ChildItem "$($latestBackup.FullName)" -Filter "docker-compose-*.yml" | Select-Object -First 1
                if ($composeBackup) {
                    Copy-Item $composeBackup.FullName "docker-compose.yml"
                    Write-Success "Docker Compose restaurado"
                }
            }
        }
        
        # Reiniciar com configuração anterior
        docker compose up -d
        
        Write-Success "Rollback concluído"
    }
    catch {
        Write-Error "Erro durante rollback: $($_.Exception.Message)"
    }
}

# =====================================================
# SCRIPT PRINCIPAL
# =====================================================

function Main {
    # Mostrar ajuda se solicitado
    if ($Help) {
        Show-Help
        return
    }
    
    # Header
    Write-Host @"

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║                    $ProjectName - Deploy Script                    ║
║                        Versão $ScriptVersion                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

"@ -ForegroundColor $ColorInfo
    
    Write-Info "Iniciando deploy para ambiente: $Environment"
    Write-Info "Log será salvo em: $LogFile"
    Write-Info ""
    
    # Verificar pré-requisitos
    if (-not (Test-Prerequisites)) {
        Write-Error "Pré-requisitos não atendidos. Deploy cancelado."
        exit 1
    }
    
    # Fazer backup
    if (-not (Backup-Application)) {
        Write-Error "Falha no backup. Deploy cancelado."
        exit 1
    }
    
    # Deploy da aplicação
    if (-not (Deploy-Application)) {
        Write-Error "Falha no deploy."
        
        if (-not $Force) {
            $response = Read-Host "Deseja tentar rollback? (y/N)"
            if ($response -eq "y" -or $response -eq "Y") {
                Rollback-Deployment
            }
        }
        
        exit 1
    }
    
    # Verificar saúde da aplicação
    if (-not (Test-ApplicationHealth)) {
        Write-Error "Aplicação não passou na verificação de saúde."
        
        if (-not $Force) {
            $response = Read-Host "Deseja tentar rollback? (y/N)"
            if ($response -eq "y" -or $response -eq "Y") {
                Rollback-Deployment
            }
        }
        
        exit 1
    }
    
    # Mostrar resumo
    Show-DeploymentSummary
    
    Write-Success "Deploy concluído com sucesso!"
}

# Executar script principal
try {
    Main
}
catch {
    Write-Error "Erro inesperado: $($_.Exception.Message)"
    Write-Error "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}