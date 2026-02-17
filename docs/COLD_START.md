# Bifrost Bridge - Cold Start Guide

> **Last Updated**: 2026-02-14  
> **Purpose**: Complete setup guide for developers starting from a fresh clone

This guide walks you through setting up the Bifrost Bridge project from scratch, including Cloudflare Worker deployment, Linear integration, and swarm agent configuration.

---

## Prerequisites

### Required Accounts
- **GitHub**: Repository access
- **Cloudflare**: Worker deployment platform
- **Linear**: Project management and issue tracking
- **Perplexity** (optional): AI research API
- **Google Gemini** (optional): AI generation API

### Required Tools
```bash
node --version  # v18+ required
npm --version   # v9+ required
git --version
```

### Install Wrangler (Cloudflare CLI)
```bash
npm install -g wrangler
wrangler login  # Authenticate with Cloudflare
```

---

## Step 1: Clone and Install

```bash
# Clone repository
git clone https://github.com/mockingb1rdblue/bifrost-bridge.git
cd bifrost-bridge

# Install dependencies
npm install

# Navigate to workers
cd workers/crypt-core
npm install

cd ../annals-of-ankou
npm install

cd ../..
```

---

## Step 2: Configure Cloudflare Secrets

### Get Your API Keys

1. **Linear API Key**:
   - Go to https://linear.app/settings/api
   - Create new Personal API Key
   - Copy the key (format: `lin_api_*****`)

2. **Linear Team ID**:
   ```bash
   # Use Linear's GraphQL explorer or run this query
   curl https://api.linear.app/graphql \
     -H "Authorization: YOUR_LINEAR_API_KEY" \
     -d '{"query":"{ viewer { organization { teams { nodes { id name } } } } }"}'
   ```

3. **Linear Webhook Secret**:
   - Go to Linear Settings → Webhooks
   - Create webhook pointing to: `https://YOUR-WORKER.workers.dev/webhooks/linear`
   - Copy the webhook secret (format: `lin_wh_*****`)

4. **Cloudflare Account ID**:
   ```bash
   wrangler whoami
   # Find "Account ID" in output
   ```

### Set Secrets in Cloudflare

```bash
cd workers/crypt-core

# Required for Linear integration
echo "YOUR_LINEAR_API_KEY" | npx wrangler secret put LINEAR_API_KEY
echo "YOUR_WEBHOOK_SECRET" | npx wrangler secret put LINEAR_WEBHOOK_SECRET

# Optional (set to "dummy" if not using)
echo "YOUR_PERPLEXITY_KEY" | npx wrangler secret put PERPLEXITY_API_KEY
echo "YOUR_GEMINI_KEY" | npx wrangler secret put GEMINI_API_KEY
echo "dummy" | npx wrangler secret put GITHUB_APP_ID
echo "dummy" | npx wrangler secret put GITHUB_PRIVATE_KEY
echo "dummy" | npx wrangler secret put GITHUB_INSTALLATION_ID
echo "dummy" | npx wrangler secret put DEEPSEEK_API_KEY
echo "dummy" | npx wrangler secret put ANTHROPIC_API_KEY

# Verify secrets
npx wrangler secret list
```

### Update wrangler.toml

Edit `workers/crypt-core/wrangler.toml`:

```toml
[env.production]
name = "crypt-core"
main = "src/index.ts"

[env.production.vars]
LINEAR_TEAM_ID = "YOUR_TEAM_ID_HERE"
LINEAR_PROJECT_ID = "YOUR_PROJECT_ID_HERE"  # Optional
PROXY_API_KEY = "test-key-default"  # Change in production
```

---

## Step 3: Deploy Workers

### Deploy crypt-core (Main Worker)

```bash
cd workers/crypt-core
npx wrangler deploy

# Note the deployed URL: https://crypt-core.YOUR-SUBDOMAIN.workers.dev
```

### Deploy annals-of-ankou (Event Store)

```bash
cd workers/annals-of-ankou
npx wrangler deploy

# Note the deployed URL: https://annals-of-ankou.YOUR-SUBDOMAIN.workers.dev
```

### Verify Deployment

```bash
# Test crypt-core health
curl https://crypt-core.YOUR-SUBDOMAIN.workers.dev/health

# Should return: {"status":"ok"}
```

---

## Step 4: Create Linear Issues Programmatically

### Test Issue Creation

```bash
cd /path/to/bifrost-bridge

curl -X POST "https://crypt-core.YOUR-SUBDOMAIN.workers.dev/admin/linear/create-issue" \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Issue from API",
    "description": "## Acceptance Criteria\n- [ ] Test criterion",
    "labels": ["sluagh:autonomous", "type:docs", "complexity:simple"]
  }' | jq .

# Should return:
# {
#   "success": true,
#   "id": "...",
#   "identifier": "BIF-XXX",
#   "url": "https://linear.app/issue/BIF-XXX"
# }
```

### Batch Create Swarm Issues

```bash
# Update ROUTER_URL in script
export ROUTER_URL="https://crypt-core.YOUR-SUBDOMAIN.workers.dev"

# Run batch creation
node scripts/create-swarm-issues.js

# Output:
# 🚀 Creating 5 swarm-ready issues via https://...
# ✅ Created: BIF-146
# ✅ Created: BIF-147
# ...
```

---

## Step 5: Configure Linear Workspace

### Labels Created Automatically

When you create issues via the API, these labels are auto-created:

| Label                 | Color   | Purpose                      |
| --------------------- | ------- | ---------------------------- |
| `sluagh:autonomous`   | Green   | Fully autonomous agent tasks |
| `sluagh:supervised`   | Yellow  | Requires human oversight     |
| `sluagh:hitl`         | Orange  | Human-in-the-loop required   |
| `type:feature`        | Blue    | New functionality            |
| `type:bug`            | Red     | Bug fixes                    |
| `type:docs`           | Green   | Documentation tasks          |
| `type:test`           | Purple  | Testing tasks                |
| `type:refactor`       | Gray    | Code refactoring             |
| `complexity:simple`   | Green   | <15 min tasks                |
| `complexity:moderate` | Yellow  | 15-60 min tasks              |
| `complexity:complex`  | Red     | >60 min tasks                |
| `component:*`         | Various | Component/service tags       |

### Create Filtered Views (Manual)

1. Open Linear workspace
2. Click **Views** → **New View**
3. Set filter: `Labels contains sluagh:autonomous`
4. Name: "Swarm Ready"
5. Save

Repeat for:
- "Swarm Supervised" (`sluagh:supervised`)
- "Human Needed" (`sluagh:hitl`)

---

## Step 6: Local Development

### Configure Local Environment

```bash
# Copy environment template
cp workers/crypt-core/.dev.vars.example workers/crypt-core/.dev.vars

# Edit .dev.vars with your credentials
```

**workers/crypt-core/.dev.vars**:
```bash
# Linear Configuration
LINEAR_API_KEY=lin_api_*****
LINEAR_WEBHOOK_SECRET=lin_wh_*****
LINEAR_TEAM_ID=YOUR_TEAM_ID
LINEAR_PROJECT_ID=YOUR_PROJECT_ID

# Optional API Keys
PERPLEXITY_API_KEY=pplx-*****
GEMINI_API_KEY=AIzaSy*****

# Local Development
PROXY_API_KEY=test-key-default
```

### Start Local Development Servers

```bash
# Terminal 1: crypt-core
cd workers/crypt-core
npx wrangler dev --port 8787

# Terminal 2: annals-of-ankou
cd workers/annals-of-ankou
npx wrangler dev --port 8889
```

### Test Local Endpoints

```bash
# Health check
curl http://localhost:8787/health

# Create issue locally
curl -X POST http://localhost:8787/admin/linear/create-issue \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d '{"title":"Local Test","labels":["sluagh:autonomous"]}'
```

---

## Common Issues & Solutions

### Issue 1: Authentication Errors

**Error**: `Linear API Error: Authentication required, not authenticated`

**Cause**: LINEAR_API_KEY not set in Cloudflare secrets

**Solution**:
```bash
cd workers/crypt-core
echo "YOUR_LINEAR_API_KEY" | npx wrangler secret put LINEAR_API_KEY
npx wrangler deploy  # Redeploy after setting secret
```

### Issue 2: GraphQL Type Errors

**Error**: `Variable "$teamId" of type "ID!" used in position expecting type "String!"`

**Cause**: Linear API has inconsistent type requirements for `teamId`

**Solution**: Our implementation handles this automatically. Different queries use different types:
- Team queries: use `ID!`
- Label/Issue mutations: use `String!`

See `workers/crypt-core/src/linear.ts` for correct type usage.

### Issue 3: Local Worker Missing Secrets

**Error**: Issues created via localhost fail with authentication error

**Cause**: Local `.dev.vars` not configured

**Solution**: Copy `.dev.vars.example` and fill in your API keys (see Step 6)

### Issue 4: Duplicate Labels Created

**Error**: Multiple labels with same name but different IDs

**Cause**: Linear allows duplicate label names (unfortunately)

**Solution**: Delete duplicates manually in Linear UI. Our code now checks for existing labels before creating.

---

## Architecture Overview

### Zero-Local-Secrets Pattern

```
┌─────────────┐
│ Your Machine│
│ (No Secrets)│
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────────────┐
│ Cloudflare Worker   │
│ - LINEAR_API_KEY    │ ← Secrets stored here
│ - WEBHOOK_SECRET    │
└──────┬──────────────┘
       │ GraphQL
       ▼
┌─────────────┐
│  Linear API │
└─────────────┘
```

**Benefits**:
- API keys never touch local filesystem
- Works from any machine (Windows, Mac, Linux)
- Centralized secret management
- Audit trail via Cloudflare logs

### Worker Architecture

```
crypt-core (Main Router)
├── /webhooks/linear → Linear webhook handler
├── /admin/linear/create-issue → Issue creation
├── /admin/linear/issues → Query issues
├── /health → Health check
└── /admin/* → Administrative endpoints

annals-of-ankou (Event Store)
├── /events → Event ingestion
├── /events/count → Event statistics
└── /health → Health check
```

---

## Key Learnings

### 1. Linear GraphQL API Type Inconsistency

**Discovery**: Linear's GraphQL schema uses different types for `teamId`:
- `team(id: ID!)` query expects `ID!` type
- `issueLabelCreate(input: {teamId: String!})` expects `String!` type

**Impact**: Cannot use same variable type across all mutations/queries

**Solution**: Use different variable declarations:
```graphql
# For team queries
query WorkflowStates($teamId: ID!) {
  team(id: $teamId) { ... }
}

# For label mutations  
mutation CreateLabel($teamId: String!) {
  issueLabelCreate(input: {teamId: $teamId}) { ... }
}
```

### 2. Auto-Create Labels Pattern

**Problem**: Pre-querying labels had type issues and added complexity

**Solution**: Auto-create labels when creating issues:
1. Attempt to create label
2. If "already exists" error → ignore
3. If created successfully → use new ID
4. Apply label to issue

**Benefit**: Atomic operation, handles duplicates gracefully

### 3. Cloudflare Secret Management

**Discovery**: `wrangler secret put` requires confirmation by default

**Solution for CI/CD**:
```bash
echo "value" | npx wrangler secret put SECRET_NAME  # Non-interactive
```

**Best Practice**: Use environment-specific secrets:
```toml
[env.production]
# Production secrets via wrangler secret put

[env.development]
# Development secrets via .dev.vars file
```

---

## Quick Reference

### Useful Commands

```bash
# Deploy worker
npx wrangler deploy

# View logs
npx wrangler tail

# List secrets
npx wrangler secret list

# Delete secret
npx wrangler secret delete SECRET_NAME

# Run locally
npx wrangler dev --port 8787

# Create Linear issue
curl -X POST https://crypt-core.YOUR-DOMAIN.workers.dev/admin/linear/create-issue \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d @issue.json
```

### Environment Variables

| Variable                | Required | Purpose                        | Example            |
| ----------------------- | -------- | ------------------------------ | ------------------ |
| `LINEAR_API_KEY`        | Yes      | Linear API authentication      | `lin_api_*****`    |
| `LINEAR_TEAM_ID`        | Yes      | Target team for issues         | UUID format        |
| `LINEAR_WEBHOOK_SECRET` | Yes      | Webhook signature verification | `lin_wh_*****`     |
| `LINEAR_PROJECT_ID`     | No       | Default project                | UUID format        |
| `PROXY_API_KEY`         | Yes      | Worker authentication          | `test-key-default` |
| `PERPLEXITY_API_KEY`    | No       | AI research                    | `pplx-*****`       |
| `GEMINI_API_KEY`        | No       | AI generation                  | `AIzaSy*****`      |

---

## Next Steps

1. ✅ Deploy workers to Cloudflare
2. ✅ Configure secrets
3. ✅ Create test issue in Linear
4. ⏭️ Create batch of swarm-ready issues (see `docs/SWARM_BATCH_ISSUES.md`)
5. ⏭️ Configure Linear filtered views
6. ⏭️ Deploy worker-bees autonomous agents
7. ⏭️ Monitor swarm execution metrics

---

## Support & Resources

- **Linear API Docs**: https://developers.linear.app/docs
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Project README**: `README.md`
- **Issue Templates**: `docs/SWARM_ISSUE_TEMPLATE.md`
- **Deployment Guide**: `docs/LINEAR_SWARM_DEPLOYMENT.md`

---

## Changelog

| Date       | Change                               | Author      |
| ---------- | ------------------------------------ | ----------- |
| 2026-02-14 | Initial cold start guide created     | Antigravity |
| 2026-02-14 | Added GraphQL type learnings section | Antigravity |
| 2026-02-14 | Added troubleshooting common issues  | Antigravity |
