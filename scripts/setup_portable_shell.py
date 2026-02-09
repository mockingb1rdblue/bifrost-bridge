#!/usr/bin/env python3
"""
Setup Portable PowerShell Core Environment

Downloads and configures PowerShell Core 7.x for use in corporate environments
where the system PowerShell has execution policies disabled.
"""

import os
import sys
import urllib.request
import zipfile
import shutil
from pathlib import Path

# Configuration
PWSH_VERSION = "7.4.1"
PWSH_URL = f"https://github.com/PowerShell/PowerShell/releases/download/v{PWSH_VERSION}/PowerShell-{PWSH_VERSION}-win-x64.zip"
PROJECT_ROOT = Path(__file__).parent.parent
TOOLS_DIR = PROJECT_ROOT / ".tools"
PWSH_DIR = TOOLS_DIR / "pwsh"
PWSH_ZIP = TOOLS_DIR / "pwsh.zip"

def print_status(message, status="INFO"):
    """Print colored status message"""
    colors = {
        "INFO": "\033[94m",  # Blue
        "SUCCESS": "\033[92m",  # Green
        "WARNING": "\033[93m",  # Yellow
        "ERROR": "\033[91m",  # Red
    }
    reset = "\033[0m"
    print(f"{colors.get(status, '')}{message}{reset}")

def download_file(url, destination):
    """Download file with progress indicator"""
    print_status(f"Downloading from {url}...", "INFO")
    
    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, downloaded * 100 / total_size)
            sys.stdout.write(f"\r  Progress: {percent:.1f}% ({downloaded // 1024 // 1024}MB / {total_size // 1024 // 1024}MB)")
            sys.stdout.flush()
    
    try:
        urllib.request.urlretrieve(url, destination, reporthook)
        print()  # New line after progress
        print_status(f"Downloaded to {destination}", "SUCCESS")
        return True
    except Exception as e:
        print()
        print_status(f"Download failed: {e}", "ERROR")
        return False

def extract_zip(zip_path, extract_to):
    """Extract ZIP file"""
    print_status(f"Extracting to {extract_to}...", "INFO")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        print_status("Extraction complete", "SUCCESS")
        return True
    except Exception as e:
        print_status(f"Extraction failed: {e}", "ERROR")
        return False

def create_profile():
    """Create PowerShell profile for portable instance"""
    profile_content = '''# Bifrost Portable PowerShell Profile

# Set execution policy for this session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

# Get project root
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Add Node.js to PATH (if exists)
$NodePath = Join-Path $ProjectRoot ".tools\\nodejs"
if (Test-Path $NodePath) {
    $env:PATH = "$NodePath;$env:PATH"
}

# Add npm global bin to PATH
$NpmPath = "$env:APPDATA\\npm"
if (Test-Path $NpmPath) {
    $env:PATH = "$NpmPath;$env:PATH"
}

# Set NODE_EXTRA_CA_CERTS for corporate SSL
$CertBundle = Join-Path $ProjectRoot "corporate_bundle.pem"
if (Test-Path $CertBundle) {
    $env:NODE_EXTRA_CA_CERTS = $CertBundle
}

# Load project .env file
$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
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
'''
    
    profile_path = PWSH_DIR / "profile.ps1"
    print_status(f"Creating PowerShell profile at {profile_path}...", "INFO")
    
    try:
        with open(profile_path, 'w', encoding='utf-8') as f:
            f.write(profile_content)
        print_status("Profile created", "SUCCESS")
        return True
    except Exception as e:
        print_status(f"Failed to create profile: {e}", "ERROR")
        return False

def create_launcher_bat():
    """Create batch launcher script"""
    launcher_content = '''@echo off
setlocal

:: Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "PWSH_EXE=%PROJECT_ROOT%\\.tools\\pwsh\\pwsh.exe"
set "PROFILE=%PROJECT_ROOT%\\.tools\\pwsh\\profile.ps1"

:: Check if PowerShell Core exists
if not exist "%PWSH_EXE%" (
    echo PowerShell Core not found. Running setup...
    python "%SCRIPT_DIR%\\setup_portable_shell.py"
    if errorlevel 1 (
        echo Setup failed!
        pause
        exit /b 1
    )
)

:: Launch PowerShell Core with custom profile
"%PWSH_EXE%" -NoExit -ExecutionPolicy Bypass -NoProfile -Command ". '%PROFILE%'"
'''
    
    launcher_path = PROJECT_ROOT / "scripts" / "pwsh.bat"
    print_status(f"Creating launcher script at {launcher_path}...", "INFO")
    
    try:
        with open(launcher_path, 'w', encoding='utf-8') as f:
            f.write(launcher_content)
        print_status("Launcher created", "SUCCESS")
        return True
    except Exception as e:
        print_status(f"Failed to create launcher: {e}", "ERROR")
        return False

def verify_installation():
    """Verify PowerShell Core installation"""
    pwsh_exe = PWSH_DIR / "pwsh.exe"
    
    if not pwsh_exe.exists():
        print_status("PowerShell Core executable not found!", "ERROR")
        return False
    
    print_status("Verifying installation...", "INFO")
    
    try:
        import subprocess
        result = subprocess.run(
            [str(pwsh_exe), "-Command", "Write-Host 'PowerShell Core works!'"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if result.returncode == 0:
            print_status("Installation verified successfully!", "SUCCESS")
            return True
        else:
            print_status(f"Verification failed: {result.stderr}", "ERROR")
            return False
    except Exception as e:
        print_status(f"Verification error: {e}", "ERROR")
        return False

def main():
    """Main setup process"""
    print_status("=" * 60, "INFO")
    print_status("Bifrost Portable PowerShell Core Setup", "INFO")
    print_status("=" * 60, "INFO")
    print()
    
    # Check if already installed
    if (PWSH_DIR / "pwsh.exe").exists():
        print_status("PowerShell Core already installed!", "WARNING")
        response = input("Reinstall? (y/N): ").strip().lower()
        if response != 'y':
            print_status("Setup cancelled", "INFO")
            return 0
        
        # Remove existing installation
        print_status("Removing existing installation...", "INFO")
        shutil.rmtree(PWSH_DIR, ignore_errors=True)
    
    # Create directories
    print_status(f"Creating directories...", "INFO")
    TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Download PowerShell Core
    if not PWSH_ZIP.exists():
        if not download_file(PWSH_URL, PWSH_ZIP):
            return 1
    else:
        print_status(f"Using cached download: {PWSH_ZIP}", "INFO")
    
    # Extract
    if not extract_zip(PWSH_ZIP, PWSH_DIR):
        return 1
    
    # Create profile
    if not create_profile():
        return 1
    
    # Create launcher
    if not create_launcher_bat():
        return 1
    
    # Verify installation
    if not verify_installation():
        return 1
    
    # Cleanup
    print_status("Cleaning up...", "INFO")
    if PWSH_ZIP.exists():
        PWSH_ZIP.unlink()
    
    print()
    print_status("=" * 60, "SUCCESS")
    print_status("Setup Complete!", "SUCCESS")
    print_status("=" * 60, "SUCCESS")
    print()
    print_status("To launch portable PowerShell:", "INFO")
    print_status("  1. Run: scripts\\pwsh.bat", "INFO")
    print_status("  2. Or: python scripts/bifrost.py shell", "INFO")
    print()
    print_status("To deploy workers:", "INFO")
    print_status("  python scripts/bifrost.py deploy <worker-name>", "INFO")
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
