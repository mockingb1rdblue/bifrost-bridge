#!/bin/bash
set -e

# check-secrets.sh
# Scans the repository for forbidden secret files (.env, .dev.vars, etc.)
# Usage: ./check-secrets.sh [--fix]

# Prioritize portable tools
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="$PROJECT_ROOT/.tools/nodejs/bin"
if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
fi

FIX=false
if [ "$1" == "--fix" ]; then
  FIX=true
fi

FORBIDDEN_FILES=(
  ".env"
  ".dev.vars"
  "workers/custom-router/.dev.vars"
  "workers/linear-proxy/.dev.vars"
  "workers/worker-bees/.dev.vars"
  "workers/bifrost-bridge/.dev.vars"
)

FOUND_SECRETS=false

echo "🔍 Scanning for forbidden secret files..."

for file in "${FORBIDDEN_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "⚠️  Found forbidden file: $file"
    FOUND_SECRETS=true
    
    if [ "$FIX" == "true" ]; then
      echo "🔥 Deleting $file..."
      rm "$file"
    fi
  fi
done

if [ "$FOUND_SECRETS" == "true" ]; then
  if [ "$FIX" == "true" ]; then
    echo "✅ All forbidden files deleted."
    exit 0
  else
    echo "❌ Forbidden secret files found! Run with --fix to delete them."
    exit 1
  fi
else
  echo "✅ No forbidden secret files found."
  exit 0
fi
