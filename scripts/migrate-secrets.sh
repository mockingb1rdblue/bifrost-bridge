#!/bin/bash

# Zero Local Secrets Migration Script
# This script moves keys from .env/ .dev.vars to Cloudflare Secrets and then scrubs local files.

echo "🚀 Starting Zero Local Secrets Migration..."

# Function to safely put secret
put_secret() {
  local WORKER_DIR=$1
  local SECRET_NAME=$2
  local SECRET_VALUE=$3
  
  if [ -z "$SECRET_VALUE" ] || [ "$SECRET_VALUE" == "dummy" ]; then
    echo "⚠️ Skipping $SECRET_NAME (invalid value)"
    return
  fi

  echo "🔑 Uploading $SECRET_NAME to $WORKER_DIR..."
  echo -n "$SECRET_VALUE" | (cd "$WORKER_DIR" && npx wrangler secret put "$SECRET_NAME")
}

# 1. Parse .env
# Note: This is an simplified parser for the known .env format
KEYS=(
  "PERPLEXITY_API_KEY"
  "PROXY_API_KEY"
  "GEMINI_API_KEY"
  "DEEPSEEK_API_KEY"
  "ANTHROPIC_API_KEY"
  "LINEAR_API_KEY"
  "LINEAR_WEBHOOK_SECRET"
)

# Load values from .env
for KEY in "${KEYS[@]}"; do
  VALUE=$(grep "^$KEY=" .env | cut -d'=' -f2- | tr -d '"')
  
  # Distribute to crypt-core
  put_secret "workers/crypt-core" "$KEY" "$VALUE"

  # Distribute to perplexity-proxy if applicable
  if [[ "$KEY" == "PERPLEXITY_API_KEY" ]] || [[ "$KEY" == "PROXY_API_KEY" ]]; then
    put_secret "workers/perplexity-proxy" "$KEY" "$VALUE"
  fi

  # Distribute to linear-proxy if applicable
  if [[ "$KEY" == "LINEAR_API_KEY" ]] || [[ "$KEY" == "PROXY_API_KEY" ]] || [[ "$KEY" == "LINEAR_WEBHOOK_SECRET" ]]; then
    put_secret "workers/linear-proxy" "$KEY" "$VALUE"
  fi

  # Distribute to Fly.io (worker-bees) if applicable
  if [[ "$KEY" == "PROXY_API_KEY" ]] || [[ "$KEY" == "GEMINI_API_KEY" ]] || [[ "$KEY" == "ANTHROPIC_API_KEY" ]] || [[ "$KEY" == "DEEPSEEK_API_KEY" ]]; then
    if [ ! -z "$VALUE" ] && [ "$VALUE" != "dummy" ]; then
      echo "🦋 Uploading $KEY to Fly.io (worker-bees)..."
      # Map PROXY_API_KEY to WORKER_API_KEY for the bees
      SECRET_NAME=$KEY
      if [ "$KEY" == "PROXY_API_KEY" ]; then SECRET_NAME="WORKER_API_KEY"; fi
      
      echo -n "$VALUE" | fly secrets set "$SECRET_NAME=-" --app bifrost-worker-bees
    fi
  fi
done

echo "✅ All secrets uploaded to Cloudflare."

# 2. Cleanup local files
echo "🧹 Scrubbing local .env and .dev.vars..."

for KEY in "${KEYS[@]}"; do
  sed -i '' "s|^$KEY=.*|$KEY=dummy|g" .env
  sed -i '' "s|^$KEY=.*|$KEY=dummy|g" workers/crypt-core/.dev.vars
done

echo "🎉 Zero Local Secrets Alignment Complete!"
echo "Note: Use 'wrangler dev --remote' to access these secrets during development."
