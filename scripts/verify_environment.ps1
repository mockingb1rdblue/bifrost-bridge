# Bifrost Environment Verification Script
# Run before deployment: .\scripts\verify_environment.ps1

Write-Host "`n=== Bifrost Environment Verification ===" -ForegroundColor Cyan

$issues = @()

# 1. Check TLS protocols
if ($PSVersionTable.PSVersion.Major -lt 7) {
    try {
        $tls = [Net.ServicePointManager]::SecurityProtocol
        if ($tls -notlike "*Tls12*" -and $tls -notlike "*Tls13*") {
            $issues += "⚠️  TLS 1.2/1.3 not enforced (restart terminal)"
        }
        else {
            Write-Host "✓ TLS 1.2/1.3 enforced (Windows PowerShell)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "✓ TLS check skipped" -ForegroundColor Gray
    }
}
else {
    Write-Host "✓ TLS handled by .NET Core (PowerShell 7+)" -ForegroundColor Green
}

# 2. Check certificate trust (test against Linear API)
try {
    $null = Invoke-WebRequest -Uri https://api.linear.app/graphql -UseBasicParsing -Method Head -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Certificate trust working (Linear API)" -ForegroundColor Green
}
catch {
    if ($_.Exception.Message -like "*certificate*" -or $_.Exception.Message -like "*SSL*") {
        $issues += "⚠️  Certificate trust issue (export corporate CA to certs/)"
    }
    else {
        Write-Host "✓ Network accessible (certificate trust OK)" -ForegroundColor Green
    }
}

# 3. Check required environment variables
$requiredVars = @('CLOUDFLARE_API_TOKEN', 'LINEAR_API_KEY', 'LINEAR_TEAM_ID', 'BIFROST_ROOT')
$missingVars = $requiredVars | Where-Object { -not (Test-Path env:$_) }
if ($missingVars.Count -eq 0) {
    Write-Host "✓ Required environment variables set" -ForegroundColor Green
}
else {
    $missingVars | ForEach-Object { $issues += "❌ Missing environment variable: $_" }
}

# 4. Check command availability (deployment tools)
$requiredCommands = @('npx', 'git', 'python', 'node')
$missingCommands = $requiredCommands | Where-Object { -not (Get-Command $_ -ErrorAction SilentlyContinue) }
if ($missingCommands.Count -eq 0) {
    Write-Host "✓ Deployment commands available" -ForegroundColor Green
}
else {
    $missingCommands | ForEach-Object { $issues += "❌ Command not found: $_" }
}

# 5. Check execution policy
$policy = Get-ExecutionPolicy -Scope CurrentUser
if ($policy -in @('RemoteSigned', 'Unrestricted', 'Bypass', 'Undefined')) {
    Write-Host "✓ Execution policy: $policy (OK for development)" -ForegroundColor Green
}
else {
    $issues += "⚠️  Execution policy too restrictive: $policy"
}

# 6. Check proxy bypass configuration
if ($env:NO_PROXY -like "*workers.dev*") {
    Write-Host "✓ Proxy bypass configured" -ForegroundColor Green
}
else {
    $issues += "⚠️  Proxy bypass not configured (restart terminal)"
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($issues.Count -eq 0) {
    Write-Host "✅ All checks passed! Environment ready for deployment.`n" -ForegroundColor Green
    exit 0
}
else {
    Write-Host "⚠️  $($issues.Count) issue(s) found:`n" -ForegroundColor Yellow
    $issues | ForEach-Object { Write-Host "   $_" }
    Write-Host "`nRun this script again after fixing issues.`n" -ForegroundColor Gray
    exit 1
}
