#!/bin/bash

# Swarm Seeding Wrapper
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

echo "🚀 Seeding 5 test issues to Linear..."
npx tsx scripts/seed-5-test-issues.ts

echo "✅ Seeding complete. Check your Linear board for 'swarm:ready' issues."
