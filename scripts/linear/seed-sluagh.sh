#!/bin/bash

# Sluagh Sluagh Swarm Seeding Wrapper
# This script ensures that the required Linear environment variables are set
# before executing the TypeScript seeding script.

set -e

# Load .env if it exists (but we assume Zero Local Secrets policy)
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check for LINEAR_API_KEY
if [ -z "$LINEAR_API_KEY" ]; then
    read -p "Enter your LINEAR_API_KEY: " LINEAR_API_KEY
    export LINEAR_API_KEY
fi

# Check for LINEAR_TEAM_ID
if [ -z "$LINEAR_TEAM_ID" ]; then
    read -p "Enter your LINEAR_TEAM_ID: " LINEAR_TEAM_ID
    export LINEAR_TEAM_ID
fi

# 0. Prioritize Portable Tools
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="$PROJECT_ROOT/.tools/nodejs/bin"
if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
fi

echo "🚀 Seeding 5 test issues to Linear (Sluagh Sluagh Swarm)..."
npx tsx src/cli.ts seed swarm

echo "✅ Seeding complete. Check your Linear board for 'sluagh:ready' issues."
