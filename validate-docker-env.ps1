# Docker Environment Validation Script
param([switch]$Verbose = $false)

Write-Host "Docker Environment Validation" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$ErrorCount = 0
$WarningCount = 0
$ValidationResults = @()

function Write-ValidationResult {
    param([string]$Test, [string]$Status, [string]$Message, [string]$Severity = "Info")
    
    $Result = @{
        Test = $Test; Status = $Status; Message = $Message; Severity = $Severity; Timestamp = Get-Date
    }
    $script:ValidationResults += $Result
    
    $Icon = switch ($Status) {
        "PASS" { "[PASS]" }; "FAIL" { "[FAIL]" }; "WARN" { "[WARN]" }; default { "[INFO]" }
    }
    
    $Color = switch ($Status) {
        "PASS" { "Green" }; "FAIL" { "Red" }; "WARN" { "Yellow" }; default { "White" }
    }
    
    Write-Host "$Icon $Test`: $Message" -ForegroundColor $Color
    
    if ($Status -eq "FAIL") { $script:ErrorCount++ }
    if ($Status -eq "WARN") { $script:WarningCount++ }
}

# Test 1: File Structure
Write-Host "`nFile Structure Validation" -ForegroundColor Yellow

$RequiredFiles = @("docker-compose.yml", "Dockerfile", ".env", "package.json", "sql/init.sql", "sql/my.cnf")

foreach ($File in $RequiredFiles) {
    if (Test-Path $File) {
        Write-ValidationResult "File Check" "PASS" "$File exists"
    } else {
        Write-ValidationResult "File Check" "FAIL" "$File is missing" "Error"
    }
}

# Test 2: Environment Variables
Write-Host "`nEnvironment Variables Validation" -ForegroundColor Yellow

if (Test-Path ".env") {
    $EnvContent = Get-Content ".env" -Raw
    $RequiredEnvVars = @("NODE_ENV", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET")
    
    foreach ($Var in $RequiredEnvVars) {
        if ($EnvContent -match "^$Var=.+") {
            Write-ValidationResult "Env Variable" "PASS" "$Var is defined"
        } else {
            Write-ValidationResult "Env Variable" "FAIL" "$Var is missing or empty" "Error"
        }
    }
    
    if ($EnvContent -match "password.*=.*123|password.*=.*admin|secret.*=.*test") {
        Write-ValidationResult "Security" "WARN" "Weak passwords detected in .env" "Warning"
    }
} else {
    Write-ValidationResult "Env File" "FAIL" ".env file not found" "Error"
}

# Test 3: Docker Compose
Write-Host "`nDocker Compose Validation" -ForegroundColor Yellow

if (Test-Path "docker-compose.yml") {
    $DockerComposeContent = Get-Content "docker-compose.yml" -Raw
    
    $RequiredServices = @("mariadb", "redis", "app")
    foreach ($Service in $RequiredServices) {
        if ($DockerComposeContent -match "$Service`:") {
            Write-ValidationResult "Docker Service" "PASS" "$Service service defined"
        } else {
            Write-ValidationResult "Docker Service" "FAIL" "$Service service missing" "Error"
        }
    }
    
    if ($DockerComposeContent -match "mariadb:10\.11") {
        Write-ValidationResult "MariaDB Version" "PASS" "MariaDB 10.11 specified"
    } else {
        Write-ValidationResult "MariaDB Version" "WARN" "MariaDB version may not be optimal" "Warning"
    }
    
    if ($DockerComposeContent -match "healthcheck:") {
        Write-ValidationResult "Health Checks" "PASS" "Health checks configured"
    } else {
        Write-ValidationResult "Health Checks" "WARN" "No health checks found" "Warning"
    }
    
    if ($DockerComposeContent -match "volumes:") {
        Write-ValidationResult "Data Persistence" "PASS" "Volumes configured"
    } else {
        Write-ValidationResult "Data Persistence" "FAIL" "No volumes configured" "Error"
    }
} else {
    Write-ValidationResult "Docker Compose" "FAIL" "docker-compose.yml not found" "Error"
}

# Test 4: Dockerfile
Write-Host "`nDockerfile Validation" -ForegroundColor Yellow

if (Test-Path "Dockerfile") {
    $DockerfileContent = Get-Content "Dockerfile" -Raw
    
    if ($DockerfileContent -match "FROM.*AS.*") {
        Write-ValidationResult "Build Strategy" "PASS" "Multi-stage build configured"
    } else {
        Write-ValidationResult "Build Strategy" "WARN" "Single-stage build" "Warning"
    }
    
    if ($DockerfileContent -match "USER.*[^root]") {
        Write-ValidationResult "Security" "PASS" "Non-root user configured"
    } else {
        Write-ValidationResult "Security" "WARN" "Running as root user" "Warning"
    }
    
    if ($DockerfileContent -match "HEALTHCHECK") {
        Write-ValidationResult "Container Health" "PASS" "Health check defined"
    } else {
        Write-ValidationResult "Container Health" "WARN" "No health check in Dockerfile" "Warning"
    }
} else {
    Write-ValidationResult "Dockerfile" "FAIL" "Dockerfile not found" "Error"
}

# Test 5: Package.json
Write-Host "`nPackage Dependencies Validation" -ForegroundColor Yellow

if (Test-Path "package.json") {
    try {
        $PackageJson = Get-Content "package.json" | ConvertFrom-Json
        
        $RequiredDeps = @("express", "mysql2", "redis", "bcryptjs", "jsonwebtoken")
        foreach ($Dep in $RequiredDeps) {
            if ($PackageJson.dependencies.$Dep -or $PackageJson.devDependencies.$Dep) {
                Write-ValidationResult "Dependency" "PASS" "$Dep is included"
            } else {
                Write-ValidationResult "Dependency" "WARN" "$Dep not found" "Warning"
            }
        }
        
        if ($PackageJson.scripts.start) {
            Write-ValidationResult "NPM Script" "PASS" "start script defined"
        } else {
            Write-ValidationResult "NPM Script" "WARN" "start script missing" "Warning"
        }
    } catch {
        Write-ValidationResult "Package JSON" "FAIL" "Invalid package.json format" "Error"
    }
} else {
    Write-ValidationResult "Package JSON" "FAIL" "package.json not found" "Error"
}

# Test 6: SQL Files
Write-Host "`nSQL Files Validation" -ForegroundColor Yellow

if (Test-Path "sql/init.sql") {
    $SqlContent = Get-Content "sql/init.sql" -Raw
    
    if ($SqlContent -match "ENGINE=InnoDB") {
        Write-ValidationResult "SQL Engine" "PASS" "InnoDB engine specified"
    } else {
        Write-ValidationResult "SQL Engine" "WARN" "InnoDB engine not specified" "Warning"
    }
    
    if ($SqlContent -match "utf8mb4") {
        Write-ValidationResult "SQL Charset" "PASS" "UTF8MB4 charset configured"
    } else {
        Write-ValidationResult "SQL Charset" "WARN" "UTF8MB4 charset not specified" "Warning"
    }
    
    if ($SqlContent -match "FOREIGN KEY") {
        Write-ValidationResult "Data Integrity" "PASS" "Foreign key constraints defined"
    } else {
        Write-ValidationResult "Data Integrity" "WARN" "No foreign key constraints" "Warning"
    }
} else {
    Write-ValidationResult "SQL Init" "FAIL" "sql/init.sql not found" "Error"
}

# Summary
Write-Host "`nValidation Summary" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

$TotalTests = $ValidationResults.Count
$PassedTests = ($ValidationResults | Where-Object { $_.Status -eq "PASS" }).Count

Write-Host "Total Tests: $TotalTests" -ForegroundColor White
Write-Host "Passed: $PassedTests" -ForegroundColor Green
Write-Host "Failed: $ErrorCount" -ForegroundColor Red
Write-Host "Warnings: $WarningCount" -ForegroundColor Yellow

$SuccessRate = [math]::Round(($PassedTests / $TotalTests) * 100, 2)
Write-Host "Success Rate: $SuccessRate%" -ForegroundColor $(if ($SuccessRate -ge 80) { "Green" } else { "Yellow" })

# Save report
$ReportPath = "docker-validation-report.json"
$ValidationResults | ConvertTo-Json -Depth 3 | Out-File $ReportPath -Encoding UTF8
Write-Host "`nDetailed report saved to: $ReportPath" -ForegroundColor Cyan

if ($ErrorCount -eq 0) {
    Write-Host "`nDocker environment validation PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nDocker environment validation FAILED!" -ForegroundColor Red
    exit 1
}