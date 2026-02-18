#!/bin/bash

# Resilience Test: Sluagh Sluagh Swarm Recovery
# 1. Start bees
# 2. Stop router
# 3. Observe backoff
# 4. Start router
# 5. Observe recovery

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting Sluagh Swarm Resilience Verification...${NC}"

# 1. Ensure bees are running
npm run swarm:restart
sleep 5

# 2. Crash the Router (Local)
echo -e "${RED}🛑 Crashing the Router (killing wrangler)...${NC}"
pkill -f "wrangler dev" || echo "Wrangler was not running."

echo -e "${YELLOW}⏳ Waiting 15 seconds to observe bee backoff...${NC}"
sleep 15

# 3. Check logs (assuming they pipe to stdout or we check process)
# In this environment, we'll just check if the process is still alive and trying
echo -e "${YELLOW}🔍 Checking if bees are still alive (in backoff pulse)...${NC}"
ps aux | grep "ts-node" | grep "agent.ts" | grep -v grep

# 4. Resurrect the Router
echo -e "${GREEN}♻️  Resurrecting the Router...${NC}"
# Use background command for wrangler
cd workers/crypt-core && npx wrangler dev --remote --port 8787 > /tmp/wrangler_resilience.log 2>&1 &
sleep 10

echo -e "${GREEN}✅ Verification manual check: Run 'fly logs' or check local swarm output.${NC}"
echo -e "${GREEN}Verification script ended.${NC}"
