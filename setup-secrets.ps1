# Setup Docker Secrets
# Este script cria os arquivos de secrets necessários para o Docker Compose

Write-Host "🔐 Configurando Docker Secrets..." -ForegroundColor Cyan

# Criar diretório secrets se não existir
if (!(Test-Path "secrets")) {
    New-Item -ItemType Directory -Path "secrets" -Force
    Write-Host "✅ Diretório secrets/ criado" -ForegroundColor Green
}

# Função para gerar password seguro
function Generate-SecurePassword {
    param([int]$Length = 32)
    
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    $password = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $password
}

# Função para criar secret file
function Create-SecretFile {
    param(
        [string]$FileName,
        [string]$Description,
        [string]$DefaultValue = $null
    )
    
    $filePath = "secrets\$FileName"
    
    if (Test-Path $filePath) {
        Write-Host "⚠️  $FileName já existe. Deseja sobrescrever? (y/N): " -NoNewline -ForegroundColor Yellow
        $response = Read-Host
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "⏭️  Pulando $FileName" -ForegroundColor Gray
            return
        }
    }
    
    if ($DefaultValue) {
        $value = $DefaultValue
        Write-Host "🔑 Gerando $Description automaticamente..." -ForegroundColor Blue
    } else {
        Write-Host "🔑 Digite $Description (deixe vazio para gerar automaticamente): " -NoNewline -ForegroundColor Blue
        $value = Read-Host
        if ([string]::IsNullOrWhiteSpace($value)) {
            $value = Generate-SecurePassword
            Write-Host "🎲 Valor gerado automaticamente" -ForegroundColor Green
        }
    }
    
    $value | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
    Write-Host "✅ $FileName criado" -ForegroundColor Green
}

Write-Host ""
Write-Host "Configurando secrets individuais..." -ForegroundColor Cyan
Write-Host ""

# Criar cada secret
Create-SecretFile "db_password.txt" "a senha do banco de dados"
Create-SecretFile "db_root_password.txt" "a senha root do banco de dados"
Create-SecretFile "jwt_secret.txt" "o JWT secret" (Generate-SecurePassword 64)
Create-SecretFile "jwt_refresh_secret.txt" "o JWT refresh secret" (Generate-SecurePassword 64)
Create-SecretFile "redis_password.txt" "a senha do Redis"

Write-Host ""
Write-Host "🎉 Configuração de secrets concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Verifique os arquivos em secrets/" -ForegroundColor White
Write-Host "2. Execute: docker-compose up -d" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  IMPORTANTE: Os arquivos em secrets/ não são commitados no Git por segurança!" -ForegroundColor Red