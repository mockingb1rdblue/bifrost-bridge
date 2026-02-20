# Bifrost Bridge: Scripts

This directory contains utility scripts for managing the Bifrost Bridge swarm. The structure is optimized for autonomous execution and hardening within corporate environments.

## Directory Structure

- **`launchers/`**: Entry point scripts for starting the Unholy Environment.
    - `bifrost-shell.sh` (macOS/ZSH)
    - `pwsh.bat` (Windows/PowerShell Core)
- **`infra/`**: Core infrastructure, safety, and maintenance scripts.
    - `maintenance-loop.sh`: Hardened core maintenance task.
    - `recover-secrets.sh`: Universal secret recovery protocol.
    - `extract_certs.js`: Corporate certificate extraction.
- **`linear/`**: Linear.app integration and swarm seeding utilities.
    - `seed-sluagh.sh`: Primary entry point for seeding the backlog.
    - `bulk_create_issues.ts`: Optimized batch issue generation.
- **`debug/`**: Diagnostic and exploration scripts.
- **`legacy/`**: Obsolete or redundant scripts retained for reference.

## Core Workflows

### 🌀 Maintenance Loop
Automates the "Always Up To Date" policy.
```bash
bash scripts/infra/maintenance-loop.sh
```
- Fail-fast enabled (`set -e`).
- Prioritizes portable `.tools/` binaries.
- Logs all output to `maintenance.log`.

### 🚀 Sluagh Swarm Seeding
Populate Linear with test issues.
```bash
bash scripts/linear/seed-sluagh.sh
```
- Uses the unified `bifrost` CLI.
- Automatically handles portable Node.js paths.

### 🔍 Pre-commit
Standardized checks for repository hygiene.
```bash
bash scripts/pre-commit.sh
```
- Runs `lint` and `prettier` check.
- Verifies environment before allow-commit.
