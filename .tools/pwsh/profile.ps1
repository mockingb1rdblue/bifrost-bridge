# Bifrost Portable PowerShell Profile

# Set execution policy for this session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Get project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Add Node.js to PATH (if exists)
$NodePath = Join-Path $ProjectRoot ".tools\nodejs"
if (Test-Path $NodePath) {
    $env:PATH = "$NodePath;$env:PATH"
}

# Add npm global bin to PATH
$NpmPath = "$env:APPDATA\npm"
if (Test-Path $NpmPath) {
    $env:PATH = "$NpmPath;$env:PATH"
}

# Set NODE_EXTRA_CA_CERTS for corporate SSL
$CertBundle = Join-Path $ProjectRoot ".certs\corporate_bundle.pem"
if (Test-Path $CertBundle) {
    $env:NODE_EXTRA_CA_CERTS = $CertBundle
    Write-Host "Using corporate certificate bundle" -ForegroundColor DarkGray
}


# Load project .env file
$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    Write-Host "Loading environment from .env..." -ForegroundColor Gray
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        # Skip empty lines and comments
        if ($line -and -not $line.StartsWith('#')) {
            # Split on first = only
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                # Remove quotes if present
                $value = $value -replace '^["'']|["'']$', ''
                [Environment]::SetEnvironmentVariable($key, $value, 'Process')
                Write-Host "  Set: $key" -ForegroundColor DarkGray
            }
        }
    }
}


# Custom prompt
function prompt {
    Write-Host "[Bifrost] " -NoNewline -ForegroundColor Cyan
    Write-Host (Get-Location) -ForegroundColor Yellow
    return "> "
}

# Welcome message
Write-Host ""
Write-Host "╔═══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Bifrost Portable Shell Environment ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "PowerShell: " -NoNewline -ForegroundColor Gray
Write-Host $PSVersionTable.PSVersion -ForegroundColor White

if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host "Node.js:    " -NoNewline -ForegroundColor Gray
    Write-Host (node --version) -ForegroundColor White
}

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "npm:        " -NoNewline -ForegroundColor Gray
    Write-Host (npm --version) -ForegroundColor White
}

Write-Host ""
Write-Host "Ready to deploy workers! Use 'npx wrangler deploy'" -ForegroundColor Green
Write-Host ""
