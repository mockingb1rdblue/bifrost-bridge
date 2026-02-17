# Linear Swarm Deployment: Step-by-Step Guide

> **Execute this checklist to transform Linear into an autonomous agent task queue**

---

## Prerequisites

- [ ] Linear workspace admin access
- [ ] Crypt-core worker deployed with LINEAR_API_KEY secret configured
- [ ] Access to Cloudflare dashboard (for worker management)
- [ ] Bifrost team ID: `d43e265a-cbc3-4f07-afcd-7792ce875ad3`

> [!IMPORTANT]
> **Zero Local Secrets Architecture**: All Linear API operations are executed via the `crypt-core` Cloudflare Worker. No local LINEAR_API_KEY is required or permitted.

---

## Phase 1: Configure Workflow States (15 mins)

### Step 1.1: Update Workflow States

Navigate to Team Settings → Workflows → Edit Workflow

**Add these states if not present**:

| State Name   | Type        | Color    | Description                             |
| ------------ | ----------- | -------- | --------------------------------------- |
| Sluagh Ready | `unstarted` | 🟢 Green  | Tasks ready for autonomous agent pickup |
| In Progress  | `started`   | 🟡 Yellow | Currently being executed by agent       |
| Blocked      | `unstarted` | 🔴 Red    | Waiting for human input (HITL)          |
| Review       | `completed` | 🔵 Blue   | Awaiting human validation               |
| Done         | `completed` | ⚪ Gray   | Verified and complete                   |

**Remove or deprecate**:
- Backlog (replace with Sluagh Ready)
- Todo (redundant with Sluagh Ready)

### Step 1.2: Set State Transitions

Configure allowed transitions:
```
Sluagh Ready → In Progress
In Progress → Review
In Progress → Blocked
Blocked → Sluagh Ready (after unblocking)
Review → Done
Review → Blocked (if issues found)
```

---

## Phase 2: Create Label Taxonomy (10 mins)

### Step 2.1: Autonomy Labels

Create these labels in Team Settings → Labels:

| Label               | Color    | Usage                                  |
| ------------------- | -------- | -------------------------------------- |
| `sluagh:autonomous` | 🟢 Green  | Full autonomy, no approval needed      |
| `sluagh:supervised` | 🟡 Yellow | Autonomous exec, human review required |
| `sluagh:hitl`       | 🟠 Orange | Human approval before execution        |
| `sluagh:research`   | 🔴 Red    | Requires human guidance throughout     |
| `sluagh:stuck`      | 🔴 Red    | Auto-applied when agent can't proceed  |

### Step 2.2: Type Labels

| Label           | Color    |
| --------------- | -------- |
| `type:feature`  | 🔵 Blue   |
| `type:bug`      | 🔴 Red    |
| `type:refactor` | 🟡 Yellow |
| `type:docs`     | 🟢 Green  |
| `type:test`     | 🟣 Purple |

### Step 2.3: Complexity Labels

| Label                 | Color    |
| --------------------- | -------- |
| `complexity:simple`   | 🟢 Green  |
| `complexity:moderate` | 🟡 Yellow |
| `complexity:complex`  | 🔴 Red    |

### Step 2.4: Component Labels

| Label                    | Usage                    |
| ------------------------ | ------------------------ |
| `component:crypt-core`   | Dullahan Dispatcher work |
| `component:worker-bees`  | Agent runner work        |
| `component:annals`       | Event sourcing work      |
| `component:linear-proxy` | Linear integration work  |
| `component:infra`        | Deployment/DevOps        |

---

## Phase 3: Create Filtered Views (10 mins)

### Step 3.1: Navigate to Views

Team → Views → Create New View

### Step 3.2: Create These Views

**1. "🟢 Swarm Ready" (Primary Agent Queue)**
```
Filter:
- State = "Sluagh Ready"
- Label = "sluagh:autonomous"
- Assignee = "No one"

Sort: Priority (High to Low), then Created (Oldest first)
Group by: Complexity
```

**2. "🔄 In Flight" (Monitoring)**
```
Filter:
- State = "In Progress"

Sort: Updated (Oldest first)
Group by: Assignee
Display: Show "stuck" badge if updated > 2 hours ago
```

**3. "⏸️ Human Needed" (HITL Queue)**
```
Filter:
- State = "Blocked" OR Label = "sluagh:hitl"

Sort: Priority (High to Low)
Group by: Label
```

**4. "✅ Needs Review" (Validation Queue)**
```
Filter:
- State = "Review"

Sort: Updated (Oldest first)
Display: Auto-approve after 24hrs if all checks pass
```

**5. "📊 Agent Metrics" (Dashboard)**
```
Filter: (All issues)
Display:
- Chart: Completion rate by autonomy level
- Chart: Average cycle time by complexity
- Table: Top 10 agents by tasks completed
```

---

## Phase 4: Set Up Automations (15 mins)

### Step 4.1: Navigate to Automations

Team Settings → Automations → Create Automation

### Step 4.2: Create These Rules

**Auto-transition to Review**
```yaml
Trigger: Comment created
Condition: Comment contains "✅ Task completed by agent"
Action: 
  - Set state to "Review"
  - Add label "sluagh:supervised"
```

**Auto-approve after 24hrs**
```yaml
Trigger: Every day at 00:00 UTC
Condition: 
  - State = "Review"
  - Updated > 24 hours ago
  - All GitHub checks passing
Action:
  - Set state to "Done"
  - Add comment "Auto-approved: All verification passed"
```

**Stuck agent detection**
```yaml
Trigger: Every hour
Condition:
  - State = "In Progress"
  - Updated > 2 hours ago
Action:
  - Add label "sluagh:stuck"
  - Add comment "@mention-human Agent may be stuck, please investigate"
  - Set priority to "Urgent"
```

**Auto-assign on claim**
```yaml
Trigger: Comment created
Condition: Comment contains "🤖 Claimed by agent:"
Action:
  - Set state to "In Progress"
  - Extract agent ID from comment
  - Set assignee to "Swarm Agent Bot" (create this Linear user)
```

---

## Phase 5: Refactor Existing Issues (30-60 mins)

### Step 5.1: Audit Current Issues

Query via crypt-core worker endpoint:
```bash
curl -X GET https://your-worker.workers.dev/admin/linear/audit \
  -H "Authorization: Bearer test-key-default" | jq . > /tmp/linear_current_state.json
```

Or for local development:
```bash
curl -X GET http://localhost:8787/admin/linear/audit \
  -H "Authorization: Bearer test-key-default" | jq . > /tmp/linear_current_state.json
```

### Step 5.2: Categorize by Autonomy

For each existing issue:

1. **Is it well-defined?**
   - Yes → Can be autonomous
   - No → Needs thin-slicing (go to Step 5.3)

2. **Does it require approval?**
   - Schema changes, deployment → `sluagh:hitl`
   - Refactoring, features → `sluagh:supervised`
   - Docs, tests → `sluagh:autonomous`

3. **How complex is it?**
   - <5 files, <100 LOC → `complexity:simple`
   - 5-10 files, <500 LOC → `complexity:moderate`
   - >10 files or >500 LOC → `complexity:complex` (thin-slice!)

### Step 5.3: Thin-Slice Oversized Issues

For any issue marked `complexity:complex`:

1. Create parent epic: `[EPIC] Original Issue Title`
2. Break into 3-5 child issues using template from `docs/SWARM_ISSUE_TEMPLATE.md`
3. Each child issue must be `complexity:simple` or `moderate`
4. Add dependencies between children if needed

**Example**: `BIF-50: Implement Full GitHub CI/CD Pipeline`

Becomes:
- `BIF-50-1`: Create .github/workflows/test.yml
- `BIF-50-2`: Add build job to workflow  
- `BIF-50-3`: Configure deployment to staging
- `BIF-50-4`: Add production deployment with approval

### Step 5.4: Add Acceptance Criteria

For each issue, add JSON acceptance criteria block:

```json
{
  "type": "code_change",
  "autonomy_level": "greenfield",
  "files_modified": ["path/to/file.ts"],
  "verification": {
    "command": "npm test",
    "expected_output": "All tests pass"
  }
}
```

Use find/replace in Linear:
1. Filter: All issues without "json" in description
2. Bulk edit: Add acceptance criteria template
3. Manually fill in specific details

---

## Phase 6: Seed Quick Wins (30 mins)

### Step 6.1: Deploy Pre-Made Batch

Import issues from `docs/SWARM_BATCH_ISSUES.md`:

**Manual Method** (15 issues × 2 mins = 30 mins):
1. Open Linear
2. For each issue in SWARM_BATCH_ISSUES.md:
   - Click "New Issue"
   - Copy/paste title and description
   - Add labels: `sluagh:autonomous`, `type:[feature/docs/test]`, `complexity:simple`
   - Set state: **Sluagh Ready**
   - Click "Create"

**Worker Endpoint Method** (5 mins):
```bash
# Deploy issues via crypt-core worker
curl -X POST http://localhost:8787/admin/linear/batch-create \
  -H "Authorization: Bearer test-key-default" \
  -H "Content-Type: application/json" \
  -d @docs/SWARM_BATCH_ISSUES.json
```

> The worker will parse the batch file and create issues via Linear GraphQL API

### Step 6.2: Verify Queue

Check "🟢 Swarm Ready" view:
- Should show 15 issues
- All labeled `sluagh:autonomous`
- All in "Sluagh Ready" state
- None assigned

---

## Phase 7: Test Agent Polling (15 mins)

### Step 7.1: Verify API Access

Test that the worker can query the ready queue:

```bash
curl -X GET "http://localhost:8787/admin/linear/issues?state=Sluagh%20Ready&label=sluagh:autonomous" \
  -H "Authorization: Bearer test-key-default" | jq '.issues | length'
```

**Expected**: 15 (number of issues in queue)

> The worker internally uses LINEAR_API_KEY from its secrets to query Linear GraphQL API

### Step 7.2: Test Issue Claim

Manually simulate agent claiming task:

1. Pick first issue from queue (e.g., BIF-201)
2. Add comment: `🤖 Claimed by agent: test-agent-001 at 2026-02-14T10:30:00Z`
3. Verify automation triggered:
   - State changed to "In Progress"
   - Assignee set (if configured)

### Step 7.3: Test Completion Flow

1. Add comment: `✅ Task completed by agent: test-agent-001\n\nVerification: All tests passing`
2. Verify automation triggered:
   - State changed to "Review"
   - Label `sluagh:supervised` added (if applicable)

---

## Phase 8: Documentation & Handoff

### Step 8.1: Update Team Wiki

Create Linear doc: **"Swarm Agent Guide"**

Include:
- Link to `docs/SWARM_ISSUE_TEMPLATE.md`
- Link to `docs/SWARM_BATCH_ISSUES.md`
- Explanation of autonomy levels
- How to create agent-ready issues
- Escalation process for stuck agents

### Step 8.2: Brief Team

Send Slack/email announcement:

```
🐝 Swarm Deployment Complete!

Our Linear project is now configured for autonomous agent execution.

Quick Facts:
- 15 agent-ready tasks in "Sluagh Ready" queue
- Agents can autonomously claim and execute greenfield tasks
- Human review required only for supervised/HITL tasks
- Stuck agent detection runs hourly

Views:
- 🟢 Swarm Ready: Tasks agents can pick up
- 🔄 In Flight: Currently executing
- ⏸️ Human Needed: Requires your input

Questions? See Linear doc: "Swarm Agent Guide"
```

---

## Success Criteria

- [ ] All 5 workflow states configured
- [ ] 15+ labels created (autonomy, type, complexity, component)
- [ ] 5 filtered views created
- [ ] 4 automations active
- [ ] 15 issues in "Swarm Ready" queue
- [ ] Agent polling tested and working
- [ ] Team documentation updated
- [ ] Team briefed on new workflow

---

## Next Steps After Deployment

1. **Monitor First 24 Hours**
   - Watch "In Flight" view for stuck agents
   - Verify completion rate >70%
   - Collect feedback from agents (via event logs)

2. **Iterate on Templates**
   - Refine acceptance criteria format based on agent success
   - Add more examples to SWARM_ISSUE_TEMPLATE.md
   - Create templates for other task types (research, architecture)

3. **Scale the Queue**
   - Create Batch 4: Code Quality (10 issues)
   - Create Batch 5: Refactoring (10 issues)
   - Target: 50+ agent-ready tasks within 1 week

4. **Optimize Autonomy**
   - Measure escalation rate
   - If >10%, improve task descriptions
   - If <5%, increase task complexity gradually

5. **Deploy Production Agents**
   - Spin up 3-5 worker-bee instances
   - Configure LINEAR_API_KEY and ROUTER_URL
   - Start polling loop
   - Monitor Annals of Ankou for execution logs
