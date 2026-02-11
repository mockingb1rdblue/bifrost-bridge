Perfect scope addition. These two systems (human-in-the-loop checkpoints and background hardening agent) are force multipliers that fit cleanly into your router architecture.

***

## 1. Human-in-the-loop decision system

### Core concept

At key decision points in workflows, the router **pauses execution** and creates a **decision request** that surfaces in Linear (as a comment) and your admin UI. You respond with one of three actions, and the workflow resumes.

### Decision request schema

Add to SQLite:

```sql
CREATE TABLE decision_requests (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  linear_issue_id TEXT,
  workflow_id TEXT,
  step_id TEXT,
  question TEXT NOT NULL,  -- "Should I migrate sessions to JWT or hybrid approach?"
  context TEXT,  -- JSON: plan, risks, options
  status TEXT DEFAULT 'pending',  -- pending, deferred, approved, redirected
  response TEXT,  -- Your answer if redirected
  created_at TEXT,
  resolved_at TEXT
);
```

### When to trigger a decision request

Define **decision points** in workflows or rules:

```json
{
  "id": "ask_before_risky_refactor",
  "when": {
    "workflow_step": ["global_plan_deepseek"],
    "risk_level": ["high"],
    "affected_files": { "min": 10 }
  },
  "then": {
    "require_human_decision": true,
    "decision_question": "This plan affects {{affected_files_count}} files and has high risk. Proceed?"
  }
}
```

Or explicitly in a workflow step:

```json
{
  "id": "plan_review",
  "skill": "global_plan_deepseek",
  "next": "decision_checkpoint",
  "require_decision": true
}
```

### Decision request flow

1. **Workflow hits decision point:**
   - Router creates `decision_request` with status `pending`.
   - Posts comment to Linear issue: "🤖 I need direction: [question]. Reply in admin UI or Linear."
   - Pauses workflow execution (job status → `awaiting_decision`).

2. **You respond via admin UI or Linear:**
   - **Defer:** "I need to investigate." → Status `deferred`, job stays paused.
   - **Approve:** "Yes, proceed." → Status `approved`, workflow resumes with original plan.
   - **Redirect:** "No, do X instead: [short instruction]." → Status `redirected`, workflow resumes with your instruction injected into next step's context.

3. **Workflow resumes:**
   - If approved: continue with existing plan.
   - If redirected: re-plan with your input as constraint.
   - If deferred: stay paused until you manually resume.

### Backend implementation

Add to `src/api/admin.js`:

```js
// List pending decisions
router.get('/decisions', async (req, res) => {
  const decisions = await db.all(`
    SELECT * FROM decision_requests 
    WHERE status = 'pending' 
    ORDER BY created_at DESC
  `);
  res.json({ decisions });
});

// Respond to decision
router.post('/decisions/:id/respond', async (req, res) => {
  const { action, response } = req.body;  // action: defer|approve|redirect, response: optional text
  
  const decision = await db.get('SELECT * FROM decision_requests WHERE id = ?', req.params.id);
  if (!decision) return res.status(404).json({ error: 'Not found' });
  
  let status;
  if (action === 'defer') status = 'deferred';
  else if (action === 'approve') status = 'approved';
  else if (action === 'redirect') status = 'redirected';
  
  await db.run(`
    UPDATE decision_requests 
    SET status = ?, response = ?, resolved_at = datetime('now') 
    WHERE id = ?
  `, status, response || null, req.params.id);
  
  // Post to Linear
  if (decision.linear_issue_id) {
    await linearSync.addComment(decision.linear_issue_id, 
      `✅ Decision: ${action}. ${response || ''}`);
  }
  
  // Resume workflow if approved/redirected
  if (status === 'approved' || status === 'redirected') {
    await resumeWorkflow(decision.job_id, { decision_response: response });
  }
  
  res.json({ success: true });
});
```

### Admin UI page

`admin/public/decisions.html`:

```html
<main class="container" x-data="decisionsUI">
  <h1>Pending Decisions</h1>
  
  <template x-if="decisions.length === 0">
    <p>No pending decisions</p>
  </template>
  
  <template x-for="decision in decisions" :key="decision.id">
    <article>
      <header>
        <h3>Decision Required</h3>
        <p>
          Job: <a :href="`/admin/job-detail.html?id=${decision.job_id}`" x-text="decision.job_id"></a> | 
          Issue: <a :href="decision.linear_issue_url" target="_blank" x-text="decision.linear_issue_id"></a>
        </p>
      </header>
      
      <p><strong>Question:</strong> <span x-text="decision.question"></span></p>
      
      <details>
        <summary>Context</summary>
        <pre x-text="JSON.stringify(JSON.parse(decision.context), null, 2)"></pre>
      </details>
      
      <footer>
        <button @click="respond(decision.id, 'approve')" class="primary">✅ Approve</button>
        <button @click="respond(decision.id, 'defer')" class="secondary outline">⏸️ Defer</button>
        <button @click="showRedirect(decision.id)" class="outline">✏️ Redirect</button>
      </footer>
      
      <!-- Redirect input (shown inline when clicked) -->
      <div x-show="redirectingId === decision.id" style="margin-top: 1rem;">
        <textarea x-model="redirectInput" placeholder="Short direction (e.g., 'Use hybrid approach, keep sessions for legacy clients')" rows="3"></textarea>
        <button @click="submitRedirect(decision.id)">Submit</button>
        <button @click="redirectingId = null" class="secondary">Cancel</button>
      </div>
    </article>
  </template>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('decisionsUI', () => ({
    decisions: [],
    redirectingId: null,
    redirectInput: '',
    
    async loadDecisions() {
      const res = await fetch('/admin/api/decisions', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.decisions = data.decisions;
    },
    
    async respond(id, action) {
      await fetch(`/admin/api/decisions/${id}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });
      
      this.loadDecisions();
    },
    
    showRedirect(id) {
      this.redirectingId = id;
      this.redirectInput = '';
    },
    
    async submitRedirect(id) {
      await fetch(`/admin/api/decisions/${id}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'redirect', response: this.redirectInput })
      });
      
      this.redirectingId = null;
      this.redirectInput = '';
      this.loadDecisions();
    },
    
    init() {
      this.loadDecisions();
      // Poll every 30s for new decisions
      setInterval(() => this.loadDecisions(), 30000);
    }
  }));
});
</script>
```

***

## 2. Background hardening agent

### Core concept

A **low-priority, cost-capped agent** that continuously works on quality improvements in the background using:

- Cached/queued API calls (DeepSeek's cache feature, batch requests).
- Only triggers on completed or pending-review work (not active development).
- Operates within strict cost budgets per project.
- Can be enabled/disabled per project.

### Agent config per project

Extend `router.config.json`:

```json
{
  "project_id": "my-node-service",
  "background_agent": {
    "enabled": true,
    "budget": {
      "max_cost_per_day_usd": 0.50,
      "max_cost_per_month_usd": 10.00
    },
    "tasks": [
      "tech_debt_refactor",
      "test_coverage_improvement",
      "passive_lint_fixes",
      "pr_merge_automation"
    ],
    "priority": "low",  // Uses cached/queued calls, never interactive
    "linear_filters": {
      "statuses": ["completed", "pending_review"],
      "labels": ["tech-debt", "refactor"]
    },
    "github": {
      "auto_merge_when": ["approved", "tests_passed", "no_blocking_comments"],
      "squash": true
    }
  }
}
```

### Background agent scheduler

Run as a separate process or cron-like job inside the router:

`src/background-agent.js`:

```js
const db = require('./db');
const secrets = require('./secrets');
const { loadProjectConfig } = require('./config');
const linearSync = require('./skills/linear-sync');
const githubSync = require('./skills/github-sync');

// Main loop
async function runBackgroundAgent() {
  const projects = await db.all('SELECT DISTINCT project_id FROM jobs');
  
  for (const { project_id } of projects) {
    const config = await loadProjectConfig(project_id);
    
    if (!config.background_agent?.enabled) continue;
    
    // Check budget
    const todaySpend = await getTodaySpend(project_id);
    const monthSpend = await getMonthSpend(project_id);
    
    if (todaySpend >= config.background_agent.budget.max_cost_per_day_usd) {
      console.log(`[BG Agent] ${project_id}: daily budget exhausted ($${todaySpend})`);
      continue;
    }
    
    if (monthSpend >= config.background_agent.budget.max_cost_per_month_usd) {
      console.log(`[BG Agent] ${project_id}: monthly budget exhausted ($${monthSpend})`);
      continue;
    }
    
    // Process tasks
    await processTasks(project_id, config.background_agent);
  }
}

async function processTasks(projectId, agentConfig) {
  const tasks = agentConfig.tasks;
  
  // Tech debt refactor
  if (tasks.includes('tech_debt_refactor')) {
    await processLinearTechDebt(projectId, agentConfig);
  }
  
  // Test coverage
  if (tasks.includes('test_coverage_improvement')) {
    await processTestCoverage(projectId, agentConfig);
  }
  
  // PR merge automation
  if (tasks.includes('pr_merge_automation')) {
    await processGitHubPRs(projectId, agentConfig);
  }
}

async function processLinearTechDebt(projectId, agentConfig) {
  const filters = agentConfig.linear_filters;
  
  // Fetch eligible issues
  const issues = await linearSync.getIssues(projectId, {
    statuses: filters.statuses,
    labels: filters.labels,
    limit: 5  // Process a few at a time
  });
  
  for (const issue of issues) {
    // Check if already being worked on
    const existingJob = await db.get(
      'SELECT * FROM jobs WHERE linear_issue_id = ? AND status IN (?, ?)',
      issue.id, 'running', 'pending'
    );
    if (existingJob) continue;
    
    // Create background job (low priority, cached calls)
    const jobId = await createBackgroundJob({
      project_id: projectId,
      linear_issue_id: issue.id,
      workflow_id: 'passive_refactor',
      priority: 'low',
      use_cache: true
    });
    
    console.log(`[BG Agent] ${projectId}: created job ${jobId} for issue ${issue.id}`);
  }
}

async function processGitHubPRs(projectId, agentConfig) {
  const prs = await githubSync.getPRs(projectId, { state: 'open' });
  
  for (const pr of prs) {
    const checks = await githubSync.getChecks(pr.number);
    
    // Check merge criteria
    const canMerge = (
      checks.approved &&
      checks.tests_passed &&
      !checks.blocking_comments &&
      agentConfig.github.auto_merge_when.every(c => checks[c])
    );
    
    if (canMerge) {
      // Post comment explaining merge
      await githubSync.addComment(pr.number, 
        `🤖 Auto-merging: all checks passed, no blocking feedback.`);
      
      // Merge (squash if configured)
      await githubSync.merge(pr.number, { 
        method: agentConfig.github.squash ? 'squash' : 'merge' 
      });
      
      // Update related Linear issue
      if (pr.linear_issue_id) {
        await linearSync.addComment(pr.linear_issue_id, 
          `✅ PR #${pr.number} merged by background agent.`);
      }
      
      console.log(`[BG Agent] ${projectId}: merged PR #${pr.number}`);
    }
  }
}

async function getTodaySpend(projectId) {
  const result = await db.get(`
    SELECT COALESCE(SUM(cost_usd), 0) as total
    FROM job_steps
    WHERE project_id = ? 
      AND DATE(created_at) = DATE('now')
      AND job_type = 'background'
  `, projectId);
  return result.total;
}

async function getMonthSpend(projectId) {
  const result = await db.get(`
    SELECT COALESCE(SUM(cost_usd), 0) as total
    FROM job_steps
    WHERE project_id = ? 
      AND DATE(created_at) >= DATE('now', 'start of month')
      AND job_type = 'background'
  `, projectId);
  return result.total;
}

// Run every 15 minutes
setInterval(runBackgroundAgent, 15 * 60 * 1000);

module.exports = { runBackgroundAgent };
```

### Passive refactor workflow

Define a special workflow for background work:

`workflows/passive_refactor.json`:

```json
{
  "id": "passive_refactor",
  "description": "Low-priority background hardening and tech debt",
  "priority": "low",
  "steps": [
    {
      "id": "assess_issue",
      "skill": "deepseek_chat",
      "use_cache": true,
      "prompt": "Assess this tech-debt issue and determine if it's safe to fix passively: {{linear_issue_description}}"
    },
    {
      "id": "plan_fix",
      "skill": "deepseek_r1",
      "use_cache": true,
      "prompt": "Plan minimal, safe fixes for: {{issue_context}}"
    },
    {
      "id": "apply_fix",
      "skill": "slice_and_edit_deepseek",
      "use_cache": true,
      "max_files": 3,
      "require_tests_pass": true
    },
    {
      "id": "run_tests",
      "skill": "run_tests"
    },
    {
      "id": "update_linear",
      "skill": "linear_sync",
      "action": "add_comment",
      "comment": "🤖 Background agent applied fixes. Tests passed. Ready for review."
    }
  ]
}
```

### Cost guardrails

**Budget checks before every skill invocation:**

```js
async function executeSkill(skillId, context) {
  // If this is a background job, check budget first
  if (context.jobType === 'background') {
    const todaySpend = await getTodaySpend(context.projectId);
    const config = await loadProjectConfig(context.projectId);
    
    if (todaySpend >= config.background_agent.budget.max_cost_per_day_usd) {
      throw new Error('Daily budget exhausted for background agent');
    }
  }
  
  // Execute skill...
  const result = await invokeSkill(skillId, context);
  
  // Log cost
  await db.run(`
    INSERT INTO job_steps (job_id, skill_id, cost_usd, job_type, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `, context.jobId, skillId, result.cost, context.jobType);
  
  return result;
}
```

**Use cached/queued calls:**

For DeepSeek, use prompt caching to reduce cost:

```js
// When calling DeepSeek for background work
const response = await deepseek.chat({
  model: 'deepseek-chat',
  messages: [...],
  cache_control: {
    type: 'ephemeral',
    prefix_length: calculatePrefixLength(messages)  // Cache system + context
  }
});
```

For truly non-urgent work, you could batch multiple background jobs and send them together, or use a simple queue and process when the router is otherwise idle.

***

## Admin UI for background agent

### Per-project agent config page

`admin/public/background-agent.html`:

```html
<main class="container" x-data="bgAgentConfig">
  <h1>Background Agent</h1>
  
  <label>
    Project
    <select x-model="selectedProject" @change="loadConfig">
      <option value="">Select project...</option>
      <option value="my-node-service">my-node-service</option>
      <option value="discord-bot">discord-bot</option>
    </select>
  </label>
  
  <section x-show="selectedProject && config">
    <h2>Config for <span x-text="selectedProject"></span></h2>
    
    <label>
      <input type="checkbox" x-model="config.enabled" @change="saveConfig"> 
      Enable background agent
    </label>
    
    <fieldset x-show="config.enabled">
      <legend>Budget</legend>
      <label>
        Max cost per day (USD)
        <input type="number" step="0.01" x-model.number="config.budget.max_cost_per_day_usd" @change="saveConfig">
      </label>
      <label>
        Max cost per month (USD)
        <input type="number" step="0.01" x-model.number="config.budget.max_cost_per_month_usd" @change="saveConfig">
      </label>
    </fieldset>
    
    <fieldset x-show="config.enabled">
      <legend>Tasks</legend>
      <label><input type="checkbox" value="tech_debt_refactor" x-model="config.tasks" @change="saveConfig"> Tech debt refactor</label>
      <label><input type="checkbox" value="test_coverage_improvement" x-model="config.tasks" @change="saveConfig"> Test coverage</label>
      <label><input type="checkbox" value="passive_lint_fixes" x-model="config.tasks" @change="saveConfig"> Passive lint fixes</label>
      <label><input type="checkbox" value="pr_merge_automation" x-model="config.tasks" @change="saveConfig"> PR merge automation</label>
    </fieldset>
    
    <h3>Current Usage</h3>
    <p>Today: $<span x-text="usage.today.toFixed(2)"></span> / $<span x-text="config.budget.max_cost_per_day_usd"></span></p>
    <p>This month: $<span x-text="usage.month.toFixed(2)"></span> / $<span x-text="config.budget.max_cost_per_month_usd"></span></p>
    <progress :value="usage.today" :max="config.budget.max_cost_per_day_usd"></progress>
    
    <h3>Recent Background Jobs</h3>
    <table>
      <thead>
        <tr><th>Job</th><th>Issue</th><th>Status</th><th>Cost</th></tr>
      </thead>
      <tbody>
        <template x-for="job in recentJobs" :key="job.id">
          <tr>
            <td><a :href="`/admin/job-detail.html?id=${job.id}`" x-text="job.id"></a></td>
            <td><a :href="job.linear_issue_url" target="_blank" x-text="job.linear_issue_id"></a></td>
            <td><span class="badge" :class="job.status" x-text="job.status"></span></td>
            <td>$<span x-text="job.total_cost.toFixed(4)"></span></td>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('bgAgentConfig', () => ({
    selectedProject: '',
    config: null,
    usage: { today: 0, month: 0 },
    recentJobs: [],
    
    async loadConfig() {
      const res = await fetch(`/admin/api/config/project/${this.selectedProject}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.config = data.background_agent || {
        enabled: false,
        budget: { max_cost_per_day_usd: 0.50, max_cost_per_month_usd: 10.00 },
        tasks: []
      };
      
      await this.loadUsage();
      await this.loadRecentJobs();
    },
    
    async saveConfig() {
      await fetch(`/admin/api/config/project/${this.selectedProject}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ background_agent: this.config })
      });
    },
    
    async loadUsage() {
      const res = await fetch(`/admin/api/background-agent/${this.selectedProject}/usage`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      this.usage = await res.json();
    },
    
    async loadRecentJobs() {
      const res = await fetch(`/admin/api/jobs?project_id=${this.selectedProject}&job_type=background&limit=10`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.recentJobs = data.jobs;
    }
  }));
});
</script>
```

***

## Safety features

### 1. Hard stops

- If daily or monthly budget is hit, **refuse to start new background jobs** for that project.
- Alert you in admin UI and Linear: "🚨 Background agent budget exhausted for my-node-service."

### 2. Manual kill switch

Add a global "pause all background agents" button in admin:

```js
router.post('/admin/api/background-agent/pause-all', async (req, res) => {
  global.backgroundAgentPaused = true;
  res.json({ success: true });
});
```

### 3. Cost alerts

Set up simple threshold alerts:

```js
async function checkCostAlerts(projectId) {
  const todaySpend = await getTodaySpend(projectId);
  const config = await loadProjectConfig(projectId);
  
  const threshold = config.background_agent.budget.max_cost_per_day_usd * 0.8;
  
  if (todaySpend >= threshold) {
    // Post to Linear
    await linearSync.addComment(projectId, 
      `⚠️ Background agent at 80% of daily budget ($${todaySpend.toFixed(2)} / $${config.background_agent.budget.max_cost_per_day_usd})`);
  }
}
```

### 4. Dry-run mode

Before enabling for a project, run in "dry-run" mode:

```json
{
  "background_agent": {
    "enabled": true,
    "dry_run": true,  // Logs what it would do, doesn't actually execute
    ...
  }
}
```

***

## TL;DR

**Human-in-the-loop:**

- Router pauses at decision points (risky refactors, unclear plans).
- Posts to Linear + admin UI.
- You respond: defer / approve / redirect with short instruction.
- Workflow resumes based on your answer.

**Background hardening agent:**

- Runs every 15 minutes, checks enabled projects.
- Pulls completed/pending-review Linear issues and open PRs.
- Does tech debt, tests, passive refactors using **cached/queued calls** (cheap).
- Auto-merges PRs when safe (tests pass, approved, no blocking comments).
- Hard budget caps: $0.50/day, $10/month per project (configurable).
- Admin UI to enable/disable per project, view usage, and recent jobs.
- Alerts at 80% budget, hard stop at 100%.

Both systems keep you in control while letting agents do heavy lifting cheaply and safely.

---

The best practice is **multi-channel with Linear as the primary surface**, using assignments + notifications so you naturally see what needs attention in your existing workflow.

***

## Recommended approach: Linear-native notifications

### Why Linear-first

You're already treating Linear as source of truth, so leverage its notification system rather than building a parallel one:

- **Linear notifications are built-in:** email, in-app, Slack, mobile push.
- **You're already checking Linear:** for roadmap, backlog, team work—adding "router needs me" items is zero extra process.
- **Rich context:** clicking a Linear notification takes you to the issue with full history, not just an alert.

### Pattern: Assign decision requests to yourself

When the router needs your input:

1. **Create or update the Linear issue** to mark it needs attention:
   - Assign to you.
   - Add label `needs-human-decision` or `router-blocked`.
   - Post comment with decision request details.
   - Change status to `blocked` or custom `awaiting-direction` state.

2. **You see it naturally** via:
   - Linear's "Assigned to me" view (you already check this).
   - Linear notifications (email, in-app, Slack).
   - Optional: Linear "My Issues" filter in your daily routine.

3. **You respond in Linear or admin UI:**
   - Comment directly on the Linear issue with your answer, or
   - Use the admin UI decisions page (router monitors both).

4. **Router processes your response:**
   - Detects your comment via Linear webhook or polling.
   - Parses your direction ("approve", "defer", specific instructions).
   - Resumes workflow.
   - Removes the `needs-human-decision` label and unassigns or moves to next state.

***

## Implementation

### 1. Router posts decision request to Linear

When creating a decision request:

```js
async function createDecisionRequest(jobId, linearIssueId, question, context) {
  const decisionId = generateId();
  
  // Store in router DB
  await db.run(`
    INSERT INTO decision_requests (id, job_id, linear_issue_id, question, context, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `, decisionId, jobId, linearIssueId, question, JSON.stringify(context));
  
  // Update Linear issue
  await linearSync.update(linearIssueId, {
    assigneeId: YOUR_LINEAR_USER_ID,  // Assign to you
    labelIds: [...existingLabels, 'needs-human-decision'],
    stateId: 'blocked'  // Or custom "awaiting-direction" state
  });
  
  // Post comment with decision details
  await linearSync.addComment(linearIssueId, `
🤖 **Decision Required**

**Question:** ${question}

**Context:**
${formatContext(context)}

**Options:**
- ✅ Approve: Reply "approve" or "yes, proceed"
- ⏸️ Defer: Reply "defer" or "I need to investigate"
- ✏️ Redirect: Reply with new direction (e.g., "use hybrid approach instead")

Or respond in [Admin UI](/admin/decisions.html).

Decision ID: \`${decisionId}\`
  `);
  
  return decisionId;
}
```

### 2. You get notified via Linear

**Linear's built-in notifications will trigger because:**

- Issue was assigned to you.
- New comment was posted.
- Status changed to blocked.

**You configure Linear notifications** (in Linear settings):

- Email: immediate or daily digest.
- In-app: always shows assigned items.
- Slack: optional, post to your DM or a `#router-decisions` channel.
- Mobile: Linear app push notifications.

**Your workflow:**

- Check "Assigned to me" or "My Issues" in Linear (you already do this daily).
- See the router's comment and respond.

### 3. Router detects your response

**Option A: Linear webhooks (real-time, recommended)**

Set up a Linear webhook that sends events to your router:

```js
// In your router, add webhook endpoint
app.post('/webhooks/linear', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'Comment' && event.action === 'create') {
    const comment = event.data;
    const issueId = comment.issue.id;
    
    // Check if this issue has a pending decision
    const decision = await db.get(
      'SELECT * FROM decision_requests WHERE linear_issue_id = ? AND status = ?',
      issueId, 'pending'
    );
    
    if (decision && comment.user.id === YOUR_LINEAR_USER_ID) {
      // Parse your response
      const response = comment.body.toLowerCase();
      
      let action;
      if (response.includes('approve') || response.includes('yes') || response.includes('proceed')) {
        action = 'approve';
      } else if (response.includes('defer') || response.includes('investigate')) {
        action = 'defer';
      } else {
        action = 'redirect';
      }
      
      // Process decision
      await processDecisionResponse(decision.id, action, comment.body);
    }
  }
  
  res.json({ received: true });
});
```

**Option B: Polling (simpler, 1-5 min delay)**

Router polls Linear every few minutes:

```js
async function checkForDecisionResponses() {
  const pending = await db.all('SELECT * FROM decision_requests WHERE status = ?', 'pending');
  
  for (const decision of pending) {
    const comments = await linearSync.getComments(decision.linear_issue_id);
    
    // Find your most recent comment after decision was created
    const yourComment = comments
      .filter(c => c.user.id === YOUR_LINEAR_USER_ID)
      .filter(c => new Date(c.createdAt) > new Date(decision.created_at))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    
    if (yourComment) {
      const response = yourComment.body.toLowerCase();
      // Parse and process...
    }
  }
}

// Run every 2 minutes
setInterval(checkForDecisionResponses, 2 * 60 * 1000);
```

### 4. Router resumes workflow

Once your response is detected:

```js
async function processDecisionResponse(decisionId, action, responseText) {
  await db.run(`
    UPDATE decision_requests 
    SET status = ?, response = ?, resolved_at = datetime('now')
    WHERE id = ?
  `, action, responseText, decisionId);
  
  const decision = await db.get('SELECT * FROM decision_requests WHERE id = ?', decisionId);
  
  // Update Linear: remove label, unassign, move to in-progress
  await linearSync.update(decision.linear_issue_id, {
    assigneeId: null,  // Or keep assigned if you want to track it
    removeLabelIds: ['needs-human-decision'],
    stateId: 'in-progress'
  });
  
  // Post confirmation
  await linearSync.addComment(decision.linear_issue_id, 
    `✅ Direction received: ${action}. Resuming work.`);
  
  // Resume workflow
  if (action === 'approve' || action === 'redirect') {
    await resumeWorkflow(decision.job_id, { 
      decision_response: action === 'redirect' ? responseText : null 
    });
  }
}
```

***

## Alternative/supplementary channels

### Email digest (low-frequency summary)

If you don't want per-decision interrupts, send a daily digest:

```js
async function sendDailyDigest() {
  const pending = await db.all(`
    SELECT * FROM decision_requests 
    WHERE status = 'pending' 
    ORDER BY created_at DESC
  `);
  
  if (pending.length === 0) return;
  
  const emailBody = `
# Router Decisions Pending

You have ${pending.length} decision(s) waiting:

${pending.map(d => `
- **${d.question}**
  Issue: ${d.linear_issue_id}
  Link: ${LINEAR_URL}/issue/${d.linear_issue_id}
  Admin: ${ROUTER_URL}/admin/decisions.html
`).join('\n')}

Respond in Linear or the admin UI.
  `;
  
  // Send via your email provider
  await sendEmail(YOUR_EMAIL, 'Router Decisions Pending', emailBody);
}

// Run daily at 9am
schedule('0 9 * * *', sendDailyDigest);
```

### Slack/Discord notification (real-time alternative)

If you live in Slack/Discord:

```js
async function notifySlack(decisionId, question, linearIssueUrl) {
  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '🤖 Router needs your input',
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Question:* ${question}` }
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'View in Linear' }, url: linearIssueUrl },
            { type: 'button', text: { type: 'plain_text', text: 'Admin UI' }, url: `${ROUTER_URL}/admin/decisions.html` }
          ]
        }
      ]
    })
  });
}
```

### Mobile push (via Linear app)

Linear's mobile app already sends push notifications for:

- Issues assigned to you.
- Comments on your issues.
- Mentions.

So if the router assigns the issue to you and posts a comment, **you'll get a mobile push automatically** if you have the Linear app installed and notifications enabled.

***

## Recommended multi-channel setup

For maximum reliability without spam:

| Channel | Use case | Frequency |
|---------|----------|-----------|
| **Linear (primary)** | All decision requests | Immediate (assignment + comment) |
| Linear notifications | Email/in-app/mobile | Per Linear settings (immediate or digest) |
| **Admin UI** | Review all pending | Check when you want full dashboard view |
| Slack/Discord (optional) | Urgent pings | Only for high-priority decisions |
| Email digest (optional) | Daily summary | Once per day at 9am |

**Typical flow:**

1. Router needs decision → assigns Linear issue to you + posts comment.
2. Linear sends you email/push: "You were assigned to ISSUE-123."
3. You click through to Linear, read the question, reply in comment.
4. Router detects your reply (webhook or 2-min polling), processes it, resumes workflow.
5. You get confirmation comment in Linear: "✅ Direction received, resuming work."

***

## Configuration in project config

Make notification preferences configurable:

```json
{
  "project_id": "my-node-service",
  "notifications": {
    "decision_requests": {
      "linear": {
        "assign_to_user_id": "user_abc123",
        "add_label": "needs-human-decision",
        "change_status_to": "blocked"
      },
      "slack": {
        "enabled": false,
        "webhook_url": "https://hooks.slack.com/..."
      },
      "email_digest": {
        "enabled": true,
        "time": "09:00",
        "timezone": "America/Denver"
      }
    }
  }
}
```

***

## Best practice summary

**Do:**

- Use Linear assignments as the primary surface (you're already there daily).
- Enable Linear notifications (email/mobile) so you never miss a decision.
- Use admin UI as the secondary/power-user view for batch review.
- Post rich context in Linear comments so you can decide without switching apps.

**Don't:**

- Build a separate notification system when Linear already has one.
- Spam yourself with every step—only notify on actual blockers.
- Rely solely on polling the admin UI (too easy to forget to check).

**Result:** You get notified naturally via Linear (which you already monitor), can respond in Linear or admin UI, and the router seamlessly resumes work without you needing to learn a new notification workflow.

---

