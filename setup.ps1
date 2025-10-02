# MyMoney Application Setup Script
# Este script configura automaticamente a aplicacao MyMoney

param(
    [switch]$Verbose,
    [switch]$SkipNodeCheck,
    [switch]$Force
)

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Test-NodeJS {
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
            if ($majorVersion -ge 14) {
                Write-Success "Node.js version: $nodeVersion (Compatible)"
                return $true
            } else {
                Write-Error "Node.js version: $nodeVersion (Requires v14+)"
                return $false
            }
        }
    } catch {
        Write-Error "Node.js not found or not accessible"
        return $false
    }
    return $false
}

function Test-NPM {
    try {
        $npmVersion = & npm --version 2>$null
        if ($npmVersion) {
            Write-Success "NPM version: $npmVersion"
            return $true
        }
    } catch {
        Write-Error "NPM not found or not accessible"
        return $false
    }
    return $false
}

function Test-FileStructure {
    $requiredFiles = @(
        "package.json",
        "server\server.js",
        "server\app.js",
        "server\db-commonjs.js",
        "server\services\LoggerService.js",
        "server\services\CacheService.js",
        "server\services\HealthCheckService.js",
        "server\services\DatabaseInitService.js",
        ".env.example"
    )
    
    $missingFiles = @()
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            $missingFiles += $file
        }
    }
    
    if ($missingFiles.Count -eq 0) {
        Write-Success "All required files found"
        return $true
    } else {
        Write-Error "Missing files: $($missingFiles -join ', ')"
        return $false
    }
}

function Test-EnvironmentFile {
    if (Test-Path ".env") {
        Write-Success ".env file found"
        return $true
    } elseif (Test-Path ".env.example") {
        Write-Warning ".env not found, but .env.example exists"
        Write-Info "Creating .env from .env.example..."
        
        try {
            Copy-Item ".env.example" ".env"
            Write-Success ".env file created from template"
            return $true
        } catch {
            Write-Error "Failed to create .env file: $($_.Exception.Message)"
            return $false
        }
    } else {
        Write-Error "Neither .env nor .env.example found"
        return $false
    }
}

function Install-Dependencies {
    Write-Info "Installing dependencies..."
    
    try {
        $process = Start-Process -FilePath "npm" -ArgumentList "install" -Wait -PassThru -NoNewWindow
        if ($process.ExitCode -eq 0) {
            Write-Success "Dependencies installed successfully"
            return $true
        } else {
            Write-Error "Failed to install dependencies (Exit code: $($process.ExitCode))"
            return $false
        }
    } catch {
        Write-Error "Failed to run npm install: $($_.Exception.Message)"
        return $false
    }
}

function Test-NodeModules {
    if (Test-Path "node_modules") {
        $stats = Get-ChildItem "node_modules" | Measure-Object
        Write-Success "node_modules directory found ($($stats.Count) packages)"
        return $true
    } else {
        Write-Warning "node_modules not found"
        return $false
    }
}

function Test-Port {
    param([int]$Port = 3000)
    
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        Write-Success "Port $Port is available"
        return $true
    } catch {
        Write-Warning "Port $Port is already in use"
        return $false
    }
}

function Show-Summary {
    param(
        [hashtable]$Results,
        [datetime]$StartTime
    )
    
    $duration = (Get-Date) - $StartTime
    $passed = ($Results.Values | Where-Object { $_ -eq $true }).Count
    $failed = ($Results.Values | Where-Object { $_ -eq $false }).Count
    $total = $Results.Count
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "SETUP RESULTS SUMMARY" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    
    Write-Host "Total Tests: $total"
    Write-Host "Passed: $passed" -ForegroundColor $(if ($passed -gt 0) { "Green" } else { "White" })
    Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "White" })
    Write-Host "Duration: $([math]::Round($duration.TotalSeconds, 2))s"
    
    if ($Verbose) {
        Write-Host ""
        Write-Host "Detailed Results:" -ForegroundColor Yellow
        foreach ($result in $Results.GetEnumerator()) {
            $status = if ($result.Value) { "[PASS]" } else { "[FAIL]" }
            $color = if ($result.Value) { "Green" } else { "Red" }
            Write-Host "  $status $($result.Key)" -ForegroundColor $color
        }
    }
    
    Write-Host ""
    Write-Host "Recommendations:" -ForegroundColor Yellow
    
    if ($failed -eq 0) {
        Write-Success "All checks passed! Your application is ready to run."
        Write-Info "You can start the server with: npm run server:dev"
        Write-Info "Or test the application with: npm test"
    } else {
        Write-Warning "Some checks failed. Please address the issues above."
        
        if (-not $Results["Node.js"]) {
            Write-Info "-> Install Node.js v14+ from https://nodejs.org/"
        }
        if (-not $Results["Dependencies"]) {
            Write-Info "-> Run: npm install"
        }
        if (-not $Results["Environment"]) {
            Write-Info "-> Configure your .env file with database settings"
        }
        if (-not $Results["Port"]) {
            Write-Info "-> Change PORT in .env or stop the service using port 3000"
        }
    }
}

# Main execution
Write-Host "MyMoney Application Setup" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date
$results = @{}

# Test Node.js
if (-not $SkipNodeCheck) {
    Write-Info "Checking Node.js installation..."
    $results["Node.js"] = Test-NodeJS
    
    Write-Info "Checking NPM installation..."
    $results["NPM"] = Test-NPM
} else {
    Write-Warning "Skipping Node.js check (--SkipNodeCheck specified)"
    $results["Node.js"] = $true
    $results["NPM"] = $true
}

# Test file structure
Write-Info "Checking file structure..."
$results["File Structure"] = Test-FileStructure

# Test environment file
Write-Info "Checking environment configuration..."
$results["Environment"] = Test-EnvironmentFile

# Test/Install dependencies
Write-Info "Checking dependencies..."
$nodeModulesExists = Test-NodeModules
$results["Node Modules"] = $nodeModulesExists

if (-not $nodeModulesExists -and $results["NPM"]) {
    $results["Dependencies"] = Install-Dependencies
    $results["Node Modules"] = Test-NodeModules
} else {
    $results["Dependencies"] = $nodeModulesExists
}

# Test port availability
Write-Info "Checking port availability..."
$results["Port"] = Test-Port -Port 3000

# Show summary
Show-Summary -Results $results -StartTime $startTime

# Create a simple status file
$statusData = @{
    timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    results = $results
    summary = @{
        total = $results.Count
        passed = ($results.Values | Where-Object { $_ -eq $true }).Count
        failed = ($results.Values | Where-Object { $_ -eq $false }).Count
    }
}

try {
    $statusData | ConvertTo-Json -Depth 3 | Out-File "setup-status.json" -Encoding UTF8
    Write-Info "Setup status saved to: setup-status.json"
} catch {
    Write-Warning "Could not save setup status: $($_.Exception.Message)"
}

# Exit with appropriate code
$exitCode = if (($results.Values | Where-Object { $_ -eq $false }).Count -eq 0) { 0 } else { 1 }
exit $exitCode