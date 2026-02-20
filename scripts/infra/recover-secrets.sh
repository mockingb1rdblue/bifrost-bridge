#!/bin/bash
set -e

# Recovery Secret Migration Script - V2 (Hardened)
# Usage: ./scripts/infra/recover-secrets.sh
# Requires environment variables: NEW_PROXY_KEY, PPLX_KEY, LIN_API_KEY, LIN_WH_SECRET, GEMINI_KEY, NEW_EVENTS_SECRET, FLY_TOKEN

# Prioritize portable tools
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_BIN="$PROJECT_ROOT/.tools/nodejs/bin"
FLY_BIN="$PROJECT_ROOT/.tools/flyctl"
GH_BIN="$PROJECT_ROOT/.tools/gh/bin"
if [ -d "$NODE_BIN" ]; then
    export PATH="$NODE_BIN:$FLY_BIN:$GH_BIN:$PATH"
fi

if [ -z "$NEW_PROXY_KEY" ]; then
  echo "❌ ERROR: NEW_PROXY_KEY environment variable is not set."
  exit 1
fi

# Unified Event Config
PROD_EVENTS_URL="https://bifrost-events.fly.dev"
PROD_ROUTER_URL="https://crypt-core.mock1ng.workers.dev"

echo "🛠️ Synchronizing swarm secrets..."

function put_cf_secret() {
  local WORKER=$1
  local NAME=$2
  local VAL=$3
  echo "🔑 Cloudflare ($WORKER): Setting $NAME..."
  echo -n "$VAL" | (cd "workers/$WORKER" && npx -y wrangler secret put "$NAME" --env "")
}

function put_fly_secret() {
  local APP=$1
  local NAME=$2
  local VAL=$3
  echo "🦋 Fly.io ($APP): Setting $NAME..."
  echo -n "$VAL" | fly secrets set "$NAME=-" --app "$APP"
}

# 1. Update Core Auth (The source of 401s)
put_cf_secret "crypt-core" "PROXY_API_KEY" "$NEW_PROXY_KEY"
put_cf_secret "perplexity-proxy" "PROXY_API_KEY" "$NEW_PROXY_KEY"
put_cf_secret "linear-proxy" "PROXY_API_KEY" "$NEW_PROXY_KEY"
put_fly_secret "bifrost-worker-bees" "WORKER_API_KEY" "$NEW_PROXY_KEY"

# 2. Update Functional Keys
if [ -n "$GEMINI_KEY" ]; then put_cf_secret "crypt-core" "GEMINI_API_KEY" "$GEMINI_KEY"; fi
if [ -n "$LIN_API_KEY" ]; then put_cf_secret "crypt-core" "LINEAR_API_KEY" "$LIN_API_KEY"; fi
if [ -n "$LIN_WH_SECRET" ]; then put_cf_secret "crypt-core" "LINEAR_WEBHOOK_SECRET" "$LIN_WH_SECRET"; fi
if [ -n "$PPLX_KEY" ]; then put_cf_secret "perplexity-proxy" "PERPLEXITY_API_KEY" "$PPLX_KEY"; fi

# 3. Update Event Sourcing & Routing (The missing links)
if [ -n "$NEW_EVENTS_SECRET" ]; then
  put_fly_secret "bifrost-events" "EVENTS_SECRET" "$NEW_EVENTS_SECRET"
  put_cf_secret "crypt-core" "EVENTS_SECRET" "$NEW_EVENTS_SECRET"
  put_fly_secret "bifrost-worker-bees" "EVENTS_SECRET" "$NEW_EVENTS_SECRET"
fi

put_cf_secret "crypt-core" "EVENTS_URL" "$PROD_EVENTS_URL"
if [ -n "$FLY_TOKEN" ]; then put_cf_secret "crypt-core" "FLY_API_TOKEN" "$FLY_TOKEN"; fi

put_fly_secret "bifrost-worker-bees" "EVENTS_URL" "$PROD_EVENTS_URL"
put_fly_secret "bifrost-worker-bees" "ROUTER_URL" "$PROD_ROUTER_URL"

echo "✅ Sync complete!"
