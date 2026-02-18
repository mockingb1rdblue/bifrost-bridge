#!/bin/bash
set -e # Fail fast

# Bifrost Sluagh Swarm Maintenance Loop (Hardened)
# Automates the "Always Up To Date" policy.
# Suggested Schedule: Run every 12 hours.

LOG_FILE="maintenance.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "🌀 Starting Sluagh Swarm Maintenance Loop: $(date)"

# 0. Prioritize Portable Tools
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$PROJECT_ROOT/.tools/nodejs/bin"
if [ -d "$NODE_BIN" ]; then
    echo "[*] Adding portable tools to PATH..."
    export PATH="$NODE_BIN:$PATH"
fi

# 1. Update Core Secrets & URL Mapping
echo "🔑 Syncing secrets..."
bash scripts/infra/recover-secrets.sh || echo "[!] Secret recovery failed, continuing..."

# 2. Update & Deploy Annals of Ankou (Event Store)
echo "📜 Updating Annals of Ankou..."
(cd workers/annals-of-ankou && npm install && npm run deploy)

# 3. Update & Deploy Crypt Core (The Brain)
echo "🧠 Updating Crypt Core..."
(cd workers/crypt-core && npm install && npm run deploy)

# 4. Update & Deploy Worker Bees (The Hands)
echo "🐝 Updating Worker Bees..."
(cd workers/worker-bees && npm install && npm run deploy)

echo "✅ Sluagh Swarm Maintenance Complete: $(date)"
