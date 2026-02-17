# Linear Integration Guide - Complete Setup

> **Quick Reference**: From zero to deployed in 15 minutes  
> **Last Updated**: 2026-02-16

This guide focuses specifically on integrating Cloudflare Workers with Linear for autonomous swarm agent deployment.

---

## TL;DR - Quick Setup

```bash
# 1. Get Linear API key from https://linear.app/settings/api
LINEAR_KEY="lin_api_xxxxx"

# 2. Set Cloudflare secret
cd workers/crypt-core
echo "$LINEAR_KEY" | npx wrangler secret put LINEAR_API_KEY

# 3. Deploy
npx wrangler deploy

# 4. Create test issue
curl -X POST https://crypt-core.YOUR-DOMAIN.workers.dev/admin/linear/create-issue \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","labels":["sluagh:ready"]}'
```

---

## Detailed Setup

### Step 1: Get Linear Credentials

#### Linear API Key

1. Go to https://linear.app/settings/api
2. Click **Create new key**
3. Name: "Bifrost Bridge Worker"
4. Copy the key (format: `lin_api_*****`)

#### Linear Team ID

**Option A: Via GraphQL Playground**

1. Go to https://linear.app/api-playground
2. Run this query:
```graphql
{
  viewer {
    organization {
      teams {
        nodes {
          id
          name
        }
      }
    }
  }
}
```
3. Copy the `id` for your team

#### Linear Webhook Secret (Optional)

If you want to receive webhooks from Linear:

1. Go to Linear Settings → Webhooks → Create webhook
2. URL: `https://crypt-core.YOUR-DOMAIN.workers.dev/webhooks/linear`
3. Select events: Issue created, Issue updated
4. Copy the webhook secret (format: `lin_wh_*****`)

---

### Step 2: Configure Cloudflare Worker

#### Set Secrets

```bash
cd workers/crypt-core

# Required
echo "lin_api_YOUR_KEY" | npx wrangler secret put LINEAR_API_KEY

# Optional (if using webhooks)
echo "lin_wh_YOUR_SECRET" | npx wrangler secret put LINEAR_WEBHOOK_SECRET

# Verify
npx wrangler secret list
```

#### Update wrangler.toml

Edit `workers/crypt-core/wrangler.toml`:

```toml
[env.production]
name = "crypt-core"

[env.production.vars]
LINEAR_TEAM_ID = "d43e265a-cbc3-4f07-afcd-7792ce875ad3"  # Your team ID
LINEAR_PROJECT_ID = "9aeceb58-dc0e-46ab-9b26-f12c8a083815"  # Optional: your project ID
PROXY_API_KEY = "test-key-default"  # Change for production
```

---

### Step 3: Deploy Worker

```bash
cd workers/crypt-core
npx wrangler deploy
```

---

### Step 4: Create Your First Issue

```bash
curl -X POST https://crypt-core.YOUR-DOMAIN.workers.dev/admin/linear/create-issue \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First API-Created Issue",
    "description": "## Acceptance Criteria\n- [ ] Verify issue appears in Linear\n- [ ] Check labels were created",
    "labels": ["sluagh:ready", "type:feature", "complexity:moderate"]
  }' | jq .
```

---

## Understanding the Label System

### Swarm Management Labels

The worker automatically creates and manages these labels to drive the autonomous workflow:

| Label Prefix     | Color  | Hex     | Example                  |
| ---------------- | ------ | ------- | ------------------------ |
| `sluagh:ready`   | Green  | #10B981 | Task ready for swarm     |
| `sluagh:active`  | Blue   | #3B82F6 | Task being processed     |
| `sluagh:review`  | Yellow | #F59E0B | Task awaiting review     |
| `sluagh:hitl`    | Orange | #F97316 | Human-in-the-loop needed |
| `sluagh:blocked` | Red    | #EF4444 | Task execution failed    |

### Metadata Labels

| Label Prefix          | Color  | Example       |
| --------------------- | ------ | ------------- |
| `type:feature`        | Blue   | New features  |
| `type:bug`            | Red    | Bug fixes     |
| `type:docs`           | Green  | Documentation |
| `complexity:simple`   | Green  | <15 min tasks |
| `complexity:moderate` | Yellow | 15-60 min     |
| `complexity:complex`  | Red    | >60 min       |

---

## Linear Filtered Views

### Create "Swarm Ready" View
- Filter: Labels → Contains → `sluagh:ready`
- Status → Is → Backlog OR Todo

### Create "In Progress" View
- Filter: Labels → Contains → `sluagh:active`
- Status → Is → In Progress

### Create "Human Needed" View
- Filter: Labels → Contains → `sluagh:hitl` OR `sluagh:blocked`

---

## Testing & Verification

### Test 1: Health Check
```bash
curl https://crypt-core.YOUR-DOMAIN.workers.dev/health
```

### Test 2: Create Minimal Issue
```bash
curl -X POST https://crypt-core.YOUR-DOMAIN.workers.dev/admin/linear/create-issue \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d '{"title":"Minimal Test", "labels":["sluagh:ready"]}'
```

---

## Troubleshooting

### "Variable $teamId type mismatch"
**Cause**: Using wrong GraphQL type for operation.  
**Status**: ✅ Already fixed in `workers/crypt-core/src/linear.ts`. Queries use `ID!`, Mutations use `String!`.

---

_Documentation maintained by Antigravity Agent._
