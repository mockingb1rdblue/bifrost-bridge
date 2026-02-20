#!/bin/bash
set -e

echo "🔍 Running pre-commit checks..."

# Prioritize portable tools
PROJECT_ROOT="$(pwd)"
NODE_BIN="$PROJECT_ROOT/.tools/nodejs/bin"
if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$PATH"
fi

npm run lint
npm run format:check

echo "✅ Pre-commit checks passed."
