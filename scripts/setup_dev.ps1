$ErrorActionPreference = "Stop"

Write-Host "🚀 Setting up Bifrost Development Environment..." -ForegroundColor Cyan

# Ensure .tools directory exists
$toolsDir = Join-Path $PSScriptRoot "..\\.tools"
if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
}

# 1. Install GitHub CLI
$ghDir = Join-Path $toolsDir "gh"
$ghBin = Join-Path $ghDir "bin\gh.exe"
if (-not (Test-Path $ghBin)) {
    Write-Host "Installing GitHub CLI (Portable)..." -ForegroundColor Yellow
    # Hardcoded known good version
    $GhUrl = "https://github.com/cli/cli/releases/download/v2.86.0/gh_2.86.0_windows_amd64.zip"
    $zipPath = Join-Path $toolsDir "gh.zip"
    Invoke-WebRequest -Uri $GhUrl -OutFile $zipPath
    
    # Use tar for reliability with long paths/DLL issues
    New-Item -ItemType Directory -Force -Path $ghDir | Out-Null
    tar -xf $zipPath -C $ghDir
    
    # Find bin folder and add to path dynamically in profile, or move here.
    $ExtractedFolder = Get-ChildItem $ghDir -Directory | Select-Object -First 1
    if ($ExtractedFolder) {
        $BinPath = Join-Path $ExtractedFolder.FullName "bin"
        if (Test-Path $BinPath) {
            # Move bin contents to .tools/gh/bin
            New-Item -ItemType Directory -Force -Path (Join-Path $ghDir "bin") | Out-Null
            Copy-Item "$BinPath\*" (Join-Path $ghDir "bin") -Recurse -Force
        }
        Remove-Item $ExtractedFolder.FullName -Recurse -Force
    }
    Remove-Item $zipPath
    Write-Host "✅ GitHub CLI installed." -ForegroundColor Green
}
else {
    Write-Host "✅ GitHub CLI found." -ForegroundColor Green
}

# 2. Install Flyctl
$flyDir = Join-Path $toolsDir "flyctl"
$flyBin = Join-Path $flyDir "bin\flyctl.exe"
if (-not (Test-Path $flyBin)) {
    Write-Host "Installing Flyctl..." -ForegroundColor Yellow
    # Flyctl installation override to local dir
    $env:FLYCTL_INSTALL = $flyDir
    Invoke-WebRequest https://fly.io/install.ps1 -UseBasicParsing | Invoke-Expression
    Write-Host "✅ Flyctl installed." -ForegroundColor Green
}
else {
    Write-Host "✅ Flyctl found." -ForegroundColor Green
}

# 3. Check Authentication
Write-Host "`nChecking Authentication Status..." -ForegroundColor Cyan

# GH Auth
if (Test-Path $ghBin) {
    try {
        & $ghBin auth status 2>$null
        Write-Host "✅ GitHub: Authenticated" -ForegroundColor Green
    }
    catch {
        Write-Warning "⚠️ GitHub: Not Authenticated. Run '$ghBin auth login -h github.com -p https -w --skip-ssh-key'"
    }
}

# Fly Auth
if (Test-Path $flyBin) {
    $flyStatus = & $flyBin auth whoami 2>$null
    if ($flyStatus) {
        Write-Host "✅ Fly.io: Authenticated as $flyStatus" -ForegroundColor Green
    }
    else {
        Write-Warning "⚠️ Fly.io: Not Authenticated. Run '$flyBin auth login'"
    }
}

Write-Host "`n🎉 Setup Complete! Run 'npm run dev' in worker directories to start." -ForegroundColor Cyan
