# Bifrost Portable PowerShell Profile

# Set execution policy for this session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Get project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# === SECURITY HARDENING & PERFORMANCE ===

# Set BIFROST_ROOT environment variable
$env:BIFROST_ROOT = $ProjectRoot

# Enforce TLS 1.2 and 1.3 (Windows PowerShell only - PowerShell 7 uses .NET Core which handles this)
try {
    if ($PSVersionTable.PSVersion.Major -lt 7) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    }
}
catch {
    # PowerShell 7 doesn't have ServicePointManager - this is expected and safe to ignore
}

# Configure proxy bypass for internal endpoints (improves performance + security)
$env:NO_PROXY = "localhost,127.0.0.1,*.nutrien.com,*.mock1ng.workers.dev,*.workers.dev"
$env:no_proxy = $env:NO_PROXY

# --- Environment Dominance: Force Refresh PATH from Registry ---
# This bypasses session-caching (e.g. VS Code staying open) by reading directly from source.
$MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:PATH = "$UserPath;$MachinePath"

# Add Project Tools (Internal Priority)
# These are redundant if already in Registry, but good for local-only portability.
$NodePath = Join-Path $ProjectRoot ".tools\nodejs"
if (Test-Path $NodePath) { $env:PATH = "$NodePath;$env:PATH" }

# Add Flyctl
$FlyPath = Join-Path $ProjectRoot ".tools\flyctl"
if (Test-Path $FlyPath) { $env:PATH = "$FlyPath;$env:PATH" }

$env:PATH = "$PSScriptRoot;$env:PATH"
$NpmPath = "$env:APPDATA\npm"
if (Test-Path $NpmPath) { $env:PATH = "$NpmPath;$env:PATH" }


# Set NODE_EXTRA_CA_CERTS for corporate SSL
$CertBundle = Join-Path $ProjectRoot ".certs\corporate_bundle.pem"
if (Test-Path $CertBundle) {
    $env:NODE_EXTRA_CA_CERTS = $CertBundle
    Write-Host "Using corporate certificate bundle" -ForegroundColor DarkGray
}

# Trust corporate CA certificate (if present)
$corpCertPath = Join-Path $ProjectRoot ".certs\corporate_ca.crt"
if (Test-Path $corpCertPath) {
    try {
        # Add to trusted root CAs for current user
        $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($corpCertPath)
        $store = New-Object System.Security.Cryptography.X509Certificates.X509Store([System.Security.Cryptography.X509Certificates.StoreName]::Root, [System.Security.Cryptography.X509Certificates.StoreLocation]::CurrentUser)
        $store.Open([System.Security.Cryptography.X509Certificates.OpenFlags]::ReadWrite)
        $store.Add($cert)
        $store.Close()
        if ($cert) {
            Write-Host "✓ Corporate CA trusted" -ForegroundColor Green
        }
        # Set environment variables for other tools (Go, Python, etc.)
        $env:SSL_CERT_FILE = $corpCertPath
        $env:REQUESTS_CA_BUNDLE = $corpCertPath
        $env:NODE_EXTRA_CA_CERTS = $corpCertPath

        # Bifrost Portable Docker (Remote Builder) - DISABLED (Proxy Blocked)
        # Using flyctl proxy 2375:2375 -a bifrost-builder
        # $env:DOCKER_HOST = "tcp://127.0.0.1:2375"
        # Write-Host "✓ DOCKER_HOST configured (Fly.io Remote Docker via Proxy)" -ForegroundColor Cyan
    }
    catch {
        # Certificate may already be trusted, suppress error
        Write-Host "Corporate CA certificate already trusted or error occurred: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
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
                $value = $value -replace '^[\"'']|[\"'']$', ''
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
# Try to import PSReadline, but fail silently if missing (common in portable envs)
try {
    Import-Module PSReadLine -ErrorAction Stop
}
catch {
    # Fail silently to avoid user confusion
}
