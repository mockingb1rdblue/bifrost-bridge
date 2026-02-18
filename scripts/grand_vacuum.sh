#!/bin/bash
set -e

echo "🌪️  Initiating The Grand Vacuum..."
echo "Target: /Users/mock1ng/Documents/Projects/Antigravity-Github/bifrost-bridge"

# Safety check
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project root!"
    exit 1
fi

# 1. Delete _INBOX
if [ -d "_INBOX" ]; then
    echo "Deleting _INBOX..."
    rm -rf _INBOX
fi

# 2. Delete Legacy Folders in docs/
LEGACY_DIRS=(
    "docs/boneyard"
    "docs/relics"
    "docs/cairn-cache"
    "docs/wake-writs"
    "docs/ingested"
    "docs/knowledge"
    "docs/backlog"
    "docs/archive"
    "docs/infrastructure"
    "docs/strategy"
    "docs/reference"
    "docs/orchestrator"
)

for dir in "${LEGACY_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "Deleting $dir..."
        rm -rf "$dir"
    fi
done

# 3. Delete Legacy Files in docs/
LEGACY_FILES=(
    "docs/linear-sync-docs.md"
    "docs/manager-agent-flow.md"
    "docs/naming-convention.md"
    "docs/scripts-reference.md"
    "docs/setup_guide.md"
    "docs/swarm-architecture.md"
    "docs/swarm-kanban-protocol.md"
    "docs/test_write.txt"
    "docs/TROUBLESHOOTING.md"
    "docs/COLD_START.md"
    "docs/LINEAR_INTEGRATION.md"
    "docs/fly-infrastructure.md"
    "docs/linear-issue-limits.md"
    "docs/agent-ecosystem.md"
    "docs/infrastructure-sprites.md"
    "docs/deployment.md"
    "docs/bif-30-jules-integration.md"
    "docs/jules-setup-guide.md"
    "docs/LINEAR_SWARM_DEPLOYMENT.md"
    "docs/TELEMETRY_DIAGNOSTIC.md"
    "docs/GEMINI_MODELS.md"
    "docs/ARCHITECTURE_MAP.md"
    "docs/LEARNINGS.md"
)

for file in "${LEGACY_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Deleting $file..."
        rm "$file"
    fi
done

# 4. Update task.md and README.md (handled by agent, but printing reminder)
echo "✅ Vacuum Complete."
echo "Remaining in docs/:"
ls -1 docs/
