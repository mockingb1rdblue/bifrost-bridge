#!/bin/bash

# Bifrost Swarm Maintenance Loop
# Automates the "Always Up To Date" policy.
# Suggested Schedule: Run every 12 hours.

echo "🌀 Starting Swarm Maintenance Loop: $(date)"

# 1. Update Core Secrets & URL Mapping
echo "🔑 Syncing secrets..."
bash scripts/recover-secrets.sh

# 2. Update & Deploy Annals of Ankou (Event Store)
echo "📜 Updating Annals of Ankou..."
(cd workers/annals-of-ankou && npm run deploy)

# 3. Update & Deploy Crypt Core (The Brain)
echo "🧠 Updating Crypt Core..."
(cd workers/crypt-core && npm run deploy)

# 4. Update & Deploy Worker Bees (The Hands)
echo "🐝 Updating Worker Bees..."
(cd workers/worker-bees && npm run deploy)

echo "✅ Swarm Maintenance Complete: $(date)"
