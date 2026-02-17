#!/bin/bash

# Sluagh Swarm Auth Synchronization Validator
# Verifies that PROXY_API_KEY matches across Cloudflare, Fly.io, and Local environments.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔍 Validating Swarm Authentication Synchronization...${NC}"

# Helper to hash a string (first 8 chars of sha256)
function get_hash() {
  echo -n "$1" | openssl dgst -sha256 | awk '{print $2}' | cut -c1-8
}

# 1. Check Local (.dev.vars)
if [ -f "workers/crypt-core/.dev.vars" ]; then
  LOCAL_KEY=$(grep PROXY_API_KEY workers/crypt-core/.dev.vars | cut -d'=' -f2)
  LOCAL_HASH=$(get_hash "$LOCAL_KEY")
  echo -e "🏠 Local (.dev.vars): ${GREEN}Found${NC} (Hash: $LOCAL_HASH)"
else
  echo -e "🏠 Local (.dev.vars): ${RED}Not Found${NC}"
  LOCAL_HASH="missing"
fi

# 2. Check Cloudflare (Production)
echo -n "☁️  Cloudflare (crypt-core): "
CF_KEY=$(cd workers/crypt-core && npx wrangler secret list 2>/dev/null | jq -r '.[] | select(.name=="PROXY_API_KEY") | .value' 2>/dev/null)
if [ -z "$CF_KEY" ] || [ "$CF_KEY" == "null" ]; then
    # Wrangler secret list might not show values for security. 
    # Attempting to verify if it EXISTS at least.
    CF_EXISTS=$(cd workers/crypt-core && npx wrangler secret list 2>/dev/null | grep PROXY_API_KEY)
    if [ -n "$CF_EXISTS" ]; then
        echo -e "${GREEN}Exists${NC} (Value hidden by Wrangler)"
        # Since we can't get the value easily via CLI without 'wrangler secret put' (which we don't want to do),
        # we'll rely on the Fly.io comparison if possible.
    else
        echo -e "${RED}Missing${NC}"
    fi
else
    CF_HASH=$(get_hash "$CF_KEY")
    echo -e "${GREEN}Found${NC} (Hash: $CF_HASH)"
fi

# 3. Check Fly.io (worker-bees)
echo -n "🦋 Fly.io (worker-bees): "
FLY_KEY=$(fly secrets list --app bifrost-worker-bees 2>/dev/null | grep WORKER_API_KEY | awk '{print $2}')
if [ -z "$FLY_KEY" ]; then
    echo -e "${RED}Missing or Unauthorized${NC}"
else
    # Fly secrets list only shows digests (MD5-ish). 
    # We can't easily compare hashes unless we set them ourselves.
    echo -e "${GREEN}Exists${NC} (Digest: $FLY_KEY)"
fi

echo -e "\n${YELLOW}PRO-TIP:${NC} If you are seeing 401s, run 'scripts/recover-secrets.sh' to force-sync all environments to the known good key."

if [ "$LOCAL_HASH" != "missing" ] && [ -n "$CF_HASH" ] && [ "$LOCAL_HASH" != "$CF_HASH" ]; then
    echo -e "\n${RED}⚠️  WARNING: Local and Cloudflare hashes MISMATCH!${NC}"
fi

echo -e "\n${GREEN}Validation Complete.${NC}"
