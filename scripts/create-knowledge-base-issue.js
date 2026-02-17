/**
 * Create Linear issue documenting cold-start setup learnings
 * This preserves institutional knowledge in Linear for future reference
 */

const ROUTER_URL = process.env.ROUTER_URL || 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = process.env.API_KEY || 'test-key-default';

const knowledgeBaseIssue = {
  title: "📚 Knowledge Base: Linear Swarm Integration Setup",
  description: `## Overview

Complete documentation for setting up Linear integration with Cloudflare Workers for autonomous swarm agent deployment.

## Architecture

**Zero-Local-Secrets Pattern**:
\`\`\`
Local Machine (No Secrets)
    ↓ HTTPS
Cloudflare Worker (Secrets Stored)
    ↓ GraphQL
Linear API
\`\`\`

## Key Components

### 1. Worker Endpoint: \`/admin/linear/create-issue\`

**Purpose**: Programmatically create Linear issues with auto-label creation

**Request**:
\`\`\`json
{
  "title": "Issue Title",
  "description": "Markdown description",
  "labels": ["sluagh:autonomous", "type:docs", "complexity:simple"]
}
\`\`\`

**Response**:
\`\`\`json
{
  "success": true,
  "id": "abc123",
  "identifier": "BIF-XXX",
  "url": "https://linear.app/issue/BIF-XXX"
}
\`\`\`

### 2. Auto-Label Creation

Labels are created automatically on first use with smart color coding:
- \`sluagh:autonomous\` → Green (#10B981)
- \`sluagh:supervised\` → Yellow (#F59E0B)
- \`type:feature\` → Blue (#3B82F6)
- \`type:docs\` → Green (#10B981)
- \`complexity:simple\` → Green (#10B981)

## Critical Learnings

### 🔴 Linear GraphQL API Type Inconsistency

**Problem**: Linear API uses different types for \`teamId\` parameter across different operations.

**Details**:
- Team queries: \`team(id: ID!)\` expects \`ID!\` type
- Label mutations: \`issueLabelCreate(input: {teamId: String!})\` expects \`String!\` type
- Issue queries: use \`ID!\` type
- Workflow mutations: use \`String!\` type

**Impact**: Cannot reuse same variable type across all GraphQL operations

**Solution**: Use operation-specific type declarations:

\`\`\`typescript
// Team query
async listWorkflowStates() {
  const query = \`
    query WorkflowStates($teamId: ID!) {
      team(id: $teamId) { states { nodes { id name } } }
    }
  \`;
  await this.query(query, { teamId: this.teamId });
}

// Label mutation
async createLabel(teamId: string, name: string) {
  const mutation = \`
    mutation CreateLabel($teamId: String!, $name: String!) {
      issueLabelCreate(input: {teamId: $teamId, name: $name}) {
        issueLabel { id }
      }
    }
  \`;
  await this.query(mutation, { teamId, name });
}
\`\`\`

**References**:
- \`workers/crypt-core/src/linear.ts\` lines 264-330
- File: \`docs/COLD_START.md\` section "Key Learnings"

### 🟢 Auto-Create Pattern Advantages

**Previous Approach** (Failed):
1. Query all existing labels
2. Check if label exists
3. Create only if missing
4. Apply to issue

**Problem**: Step 1 (query labels) had GraphQL type issues

**Current Approach** (Success):
1. Attempt to create label
2. If "already exists" error → ignore, continue
3. If successful → use new label ID
4. Apply label to issue

**Benefits**:
- ✅ Atomic operation
- ✅ Idempotent (can run multiple times safely)
- ✅ Avoids type mismatch queries
- ✅ Self-healing (creates missing labels)

**Code Location**: \`workers/crypt-core/src/router-do.ts\` method \`createLinearIssueWithLabels\`

## Setup from Cold Clone

### 1. Install Dependencies
\`\`\`bash
npm install
cd workers/crypt-core && npm install
cd ../annals-of-ankou && npm install
\`\`\`

### 2. Configure Cloudflare Secrets
\`\`\`bash
cd workers/crypt-core
echo "lin_api_YOUR_KEY" | npx wrangler secret put LINEAR_API_KEY
echo "lin_wh_YOUR_SECRET" | npx wrangler secret put LINEAR_WEBHOOK_SECRET
\`\`\`

**Required Secrets**:
- \`LINEAR_API_KEY\` (from Linear Settings → API)
- \`LINEAR_WEBHOOK_SECRET\` (from Linear Settings → Webhooks)
- \`PERPLEXITY_API_KEY\` (optional, or use "dummy")
- \`GEMINI_API_KEY\` (optional, or use "dummy")

### 3. Update wrangler.toml
\`\`\`toml
[env.production.vars]
LINEAR_TEAM_ID = "YOUR_TEAM_ID"  # Get from Linear GraphQL query
LINEAR_PROJECT_ID = "YOUR_PROJECT_ID"  # Optional
\`\`\`

### 4. Deploy Worker
\`\`\`bash
npx wrangler deploy
# Deployed to: https://crypt-core.YOUR-SUBDOMAIN.workers.dev
\`\`\`

### 5. Create Test Issue
\`\`\`bash
curl -X POST https://crypt-core.YOUR-SUBDOMAIN.workers.dev/admin/linear/create-issue \\
  -H "Authorization: Bearer test-key-default" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Test","labels":["sluagh:autonomous"]}'
\`\`\`

## Label System

### Autonomy Classification
- \`sluagh:autonomous\` - Fully autonomous, no human required
- \`sluagh:supervised\` - Requires human oversight/approval
- \`sluagh:hitl\` - Human-in-the-loop, requires human involvement

### Task Type
- \`type:feature\` - New functionality
- \`type:bug\` - Bug fixes
- \`type:docs\` - Documentation
- \`type:test\` - Testing tasks
- \`type:refactor\` - Code refactoring

### Complexity
- \`complexity:simple\` - <15 minutes
- \`complexity:moderate\` - 15-60 minutes
- \`complexity:complex\` - >60 minutes

### Component
- \`component:crypt-core\` - Main router worker
- \`component:annals\` - Event store worker
- \`component:worker-bees\` - Autonomous agents

## Scripts

### Batch Issue Creation
\`\`\`bash
ROUTER_URL=https://crypt-core.YOUR-DOMAIN.workers.dev \\
node scripts/create-swarm-issues.js
\`\`\`

Creates 5 pre-defined swarm-ready issues.

## Files Reference

| File | Purpose |
|------|---------|
| \`docs/COLD_START.md\` | Complete setup guide (this document's source) |
| \`docs/SWARM_ISSUE_TEMPLATE.md\` | Template for creating swarm-ready issues |
| \`docs/SWARM_BATCH_ISSUES.md\` | 15 pre-written issue examples |
| \`workers/crypt-core/src/linear.ts\` | Linear GraphQL client implementation |
| \`workers/crypt-core/src/router-do.ts\` | Worker endpoint implementation |
| \`scripts/create-swarm-issues.js\` | Batch issue creation script |

## Testing

### Verify Secrets
\`\`\`bash
cd workers/crypt-core
npx wrangler secret list
\`\`\`

### Verify Deployment
\`\`\`bash
curl https://crypt-core.YOUR-DOMAIN.workers.dev/health
# Should return: {"status":"ok"}
\`\`\`

### Verify Linear Integration
\`\`\`bash
curl -X POST https://crypt-core.YOUR-DOMAIN.workers.dev/admin/linear/create-issue \\
  -H "Authorization: Bearer test-key-default" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Integration Test","labels":["sluagh:autonomous"]}' | jq .
\`\`\`

Expected response:
\`\`\`json
{
  "success": true,
  "identifier": "BIF-XXX",
  "url": "https://linear.app/issue/BIF-XXX"
}
\`\`\`

## Troubleshooting

### Error: "Authentication required, not authenticated"
**Cause**: LINEAR_API_KEY not set in Cloudflare  
**Solution**: Run \`npx wrangler secret put LINEAR_API_KEY\` and redeploy

### Error: "Variable \\"$teamId\\" type mismatch"
**Cause**: Using wrong GraphQL type for operation  
**Solution**: Already fixed in codebase (see \`linear.ts\`)

### Local development fails with auth errors
**Cause**: Missing \`.dev.vars\` file  
**Solution**: Copy \`.dev.vars.example\` and add your API keys

## Success Metrics

✅ **Endpoint Functional**: Issues created via API  
✅ **Labels Auto-Created**: Smart color coding applied  
✅ **Zero Local Secrets**: All operations via worker  
✅ **Idempotent**: Safe to run multiple times  

## Related Issues

- BIF-146 to BIF-155: Initial swarm-ready issues created via this system

## External References

- Linear API Docs: https://developers.linear.app/docs
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- GraphQL Type System: https://graphql.org/learn/schema/`,
  labels: [
    "type:docs",
    "complexity:simple",
    "component:crypt-core",
    "sluagh:supervised"  // Requires human to verify/expand
  ]
};

async function createKnowledgeBaseIssue() {
  console.log('📚 Creating Linear knowledge base issue...\n');

  try {
    const response = await fetch(`${ROUTER_URL}/admin/linear/create-issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(knowledgeBaseIssue),
    });

    const result = await response.json();

    if (result.error) {
      console.log(`❌ Failed: ${result.error}`);
      process.exit(1);
    }

    console.log(`✅ Created Knowledge Base Issue: ${result.identifier}`);
    console.log(`   URL: ${result.url}\n`);
    console.log('This issue documents all learnings from the Linear integration setup.');
    console.log('Future developers can reference this for troubleshooting and replication.\n');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

createKnowledgeBaseIssue();
