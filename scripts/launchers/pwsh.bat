@echo off
setlocal

:: Get script directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "PWSH_EXE=%PROJECT_ROOT%\.tools\pwsh\pwsh.exe"
set "PROFILE=%PROJECT_ROOT%\.tools\pwsh\profile.ps1"

:: Check if PowerShell Core exists
if not exist "%PWSH_EXE%" (
    echo PowerShell Core not found. Running setup...
    python "%SCRIPT_DIR%\setup_portable_shell.py"
    if errorlevel 1 (
        echo Setup failed!
        pause
        exit /b 1
    )
)

:: Launch PowerShell Core with custom profile
"%PWSH_EXE%" -NoExit -ExecutionPolicy Bypass -NoProfile -Command ". '%PROFILE%'"
