Perfect catch. You need two things: smart wake/sleep management and an activity-aware batching system.

***

## 1. Background agent + Fly.io sleep strategy

### Problem

Scale-to-zero conflicts with scheduled background work: if the router is asleep, cron jobs can't run.

### Solution: Hybrid approach

**Use Fly.io Machines with conditional min_machines:**

- When background agent is **enabled** for any project: keep 1 machine running.
- When background agent is **disabled** everywhere: scale to zero.
- When you're actively using the router: keep awake, pause background work.

### Implementation

#### Dynamic `fly.toml` or runtime check

You can't change `fly.toml` dynamically, but you can control machine count via API or by managing process lifecycle:

**Option A: Fly Machines API (recommended)**

Use Fly's API to adjust `min_machines_running` based on background agent config:

```js
// src/fly-manager.js
const { execSync } = require('child_process');

async function setMinMachines(count) {
  // Use Fly API or flyctl
  execSync(`fly scale count ${count} --yes`);
}

async function checkBackgroundAgentStatus() {
  const projects = await db.all('SELECT DISTINCT project_id FROM jobs');
  
  let anyEnabled = false;
  for (const { project_id } of projects) {
    const config = await loadProjectConfig(project_id);
    if (config.background_agent?.enabled) {
      anyEnabled = true;
      break;
    }
  }
  
  if (anyEnabled) {
    await setMinMachines(1);  // Keep awake
  } else {
    await setMinMachines(0);  // Allow scale to zero
  }
}

// Check every hour or when config changes
setInterval(checkBackgroundAgentStatus, 60 * 60 * 1000);
```

**Option B: Self-perpetuating idle timer (simpler)**

Instead of scaling to zero via `auto_stop_machines`, use a smarter idle timer:

```js
// src/idle-manager.js
let lastActiveTime = Date.now();
let lastBackgroundWorkTime = Date.now();
let isUserActive = false;

function resetIdleTimer() {
  lastActiveTime = Date.now();
  isUserActive = true;
}

function backgroundWorkHappened() {
  lastBackgroundWorkTime = Date.now();
}

function checkShouldSleep() {
  const idleMinutes = (Date.now() - lastActiveTime) / (60 * 1000);
  const bgWorkMinutes = (Date.now() - lastBackgroundWorkTime) / (60 * 1000);
  
  // If background agent is enabled, only sleep if:
  // - No user activity for 15+ min AND
  // - No background work happened in last 30 min
  const bgAgentEnabled = global.backgroundAgentEnabled;
  
  if (bgAgentEnabled) {
    if (idleMinutes > 15 && bgWorkMinutes > 30) {
      console.log('Shutting down: no activity');
      process.exit(0);
    }
  } else {
    // Normal idle timer: 5 min
    if (idleMinutes > 5) {
      process.exit(0);
    }
  }
}

// Check every minute
setInterval(checkShouldSleep, 60 * 1000);

module.exports = { resetIdleTimer, backgroundWorkHappened };
```

Wire it up:

```js
// On every user request
app.use((req, res, next) => {
  if (req.path.startsWith('/admin') || req.path === '/chat' || req.path.startsWith('/refactor')) {
    resetIdleTimer();
  }
  next();
});

// In background agent loop
async function runBackgroundAgent() {
  // ... do work ...
  backgroundWorkHappened();
}
```

**Option C: External lightweight scheduler (most robust)**

Run a tiny external cron (GitHub Actions, Render Cron, or even your local machine) that pings the router every 15 minutes:

```yaml
# .github/workflows/wake-background-agent.yml
name: Wake Background Agent
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes

jobs:
  wake:
    runs-on: ubuntu-latest
    steps:
      - name: Ping router
        run: |
          curl -X POST https://your-router.fly.dev/internal/wake-background-agent \
            -H "Authorization: Bearer ${{ secrets.INTERNAL_TOKEN }}"
```

Router endpoint:

```js
app.post('/internal/wake-background-agent', async (req, res) => {
  // Verify internal token
  if (req.headers.authorization !== `Bearer ${process.env.INTERNAL_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Trigger background agent
  await runBackgroundAgent();
  
  res.json({ success: true, woke: true });
});
```

Fly will auto-start the machine when the request arrives, agent runs, then sleeps after 15 min of inactivity.

**Recommendation:** Use **Option B (smart idle timer)** for simplicity, with **Option C (external cron)** as backup if you need guaranteed execution even when totally idle.

***

## 2. Batching and activity-aware pausing

### Goal

- Batch multiple background tasks into fewer, cheaper API calls.
- Pause background work when you're actively using the router.
- Resume when idle.

### Activity detection

Track "active session" state:

```js
// src/activity-tracker.js
let activeSession = false;
let lastUserRequestTime = 0;

function markUserActive() {
  lastUserRequestTime = Date.now();
  activeSession = true;
}

function checkIfStillActive() {
  const idleMs = Date.now() - lastUserRequestTime;
  
  // If no user request in 5 minutes, consider idle
  if (idleMs > 5 * 60 * 1000) {
    activeSession = false;
  }
  
  return activeSession;
}

function isUserActive() {
  checkIfStillActive();
  return activeSession;
}

// Check every minute
setInterval(checkIfStillActive, 60 * 1000);

module.exports = { markUserActive, isUserActive };
```

Wire into middleware:

```js
app.use((req, res, next) => {
  if (req.path.startsWith('/admin') || req.path === '/chat' || req.path.startsWith('/refactor')) {
    markUserActive();
  }
  next();
});
```

### Background agent with pause/resume

Modify the background agent loop:

```js
async function runBackgroundAgent() {
  // Don't run background work if user is active
  if (isUserActive()) {
    console.log('[BG Agent] User active, pausing background work');
    return;
  }
  
  console.log('[BG Agent] User idle, processing background tasks');
  
  // Collect all eligible tasks across projects
  const tasks = await collectBackgroundTasks();
  
  // Batch them
  const batches = createBatches(tasks);
  
  for (const batch of batches) {
    await processBatch(batch);
  }
}
```

### Batching strategy

#### Collect eligible tasks

```js
async function collectBackgroundTasks() {
  const allTasks = [];
  const projects = await db.all('SELECT DISTINCT project_id FROM jobs');
  
  for (const { project_id } of projects) {
    const config = await loadProjectConfig(project_id);
    if (!config.background_agent?.enabled) continue;
    
    // Check budget
    const todaySpend = await getTodaySpend(project_id);
    if (todaySpend >= config.background_agent.budget.max_cost_per_day_usd) continue;
    
    // Get tasks for this project
    const tasks = await getEligibleTasks(project_id, config);
    allTasks.push(...tasks);
  }
  
  return allTasks;
}

async function getEligibleTasks(projectId, config) {
  const tasks = [];
  
  // Tech debt issues
  if (config.background_agent.tasks.includes('tech_debt_refactor')) {
    const issues = await linearSync.getIssues(projectId, {
      statuses: config.background_agent.linear_filters.statuses,
      labels: config.background_agent.linear_filters.labels,
      limit: 10
    });
    
    for (const issue of issues) {
      // Skip if already has active job
      const existing = await db.get(
        'SELECT * FROM jobs WHERE linear_issue_id = ? AND status IN (?, ?)',
        issue.id, 'running', 'pending'
      );
      if (existing) continue;
      
      tasks.push({
        type: 'tech_debt_refactor',
        project_id: projectId,
        linear_issue_id: issue.id,
        issue_data: issue
      });
    }
  }
  
  // PRs ready to merge
  if (config.background_agent.tasks.includes('pr_merge_automation')) {
    const prs = await githubSync.getPRs(projectId, { state: 'open' });
    
    for (const pr of prs) {
      const checks = await githubSync.getChecks(pr.number);
      if (shouldAutoMerge(checks, config)) {
        tasks.push({
          type: 'pr_merge',
          project_id: projectId,
          pr_number: pr.number,
          pr_data: pr
        });
      }
    }
  }
  
  return tasks;
}
```

#### Create batches

Group tasks that can share context or be processed together:

```js
function createBatches(tasks) {
  // Group by project and type
  const grouped = {};
  
  for (const task of tasks) {
    const key = `${task.project_id}:${task.type}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }
  
  const batches = [];
  
  for (const [key, groupTasks] of Object.entries(grouped)) {
    const [projectId, type] = key.split(':');
    
    if (type === 'tech_debt_refactor') {
      // Batch refactors: analyze multiple issues in one LLM call
      batches.push({
        type: 'batched_refactor_analysis',
        project_id: projectId,
        tasks: groupTasks,
        batch_size: groupTasks.length
      });
    } else if (type === 'pr_merge') {
      // PRs are independent, but we can execute them sequentially in one "batch"
      batches.push({
        type: 'batched_pr_merge',
        project_id: projectId,
        tasks: groupTasks
      });
    }
  }
  
  return batches;
}
```

#### Process batches efficiently

Use provider-specific batching features:

##### DeepSeek batching

DeepSeek supports prompt caching, which is perfect for background work:

```js
async function processBatchedRefactorAnalysis(batch) {
  const { project_id, tasks } = batch;
  
  // Load project context once (this gets cached)
  const projectContext = await buildProjectContext(project_id);
  
  // Build a single prompt analyzing all issues
  const issuesText = tasks.map(t => `
Issue ${t.linear_issue_id}:
Title: ${t.issue_data.title}
Description: ${t.issue_data.description}
  `).join('\n\n');
  
  const response = await deepseek.chat({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: projectContext,  // Cached across calls
        cache_control: { type: 'ephemeral' }
      },
      {
        role: 'user',
        content: `Analyze these ${tasks.length} tech debt issues and provide refactor recommendations for each:\n\n${issuesText}`
      }
    ]
  });
  
  // Parse response and create individual jobs
  const recommendations = parseRecommendations(response.choices[0].message.content);
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const recommendation = recommendations[i];
    
    if (recommendation.should_fix) {
      await createBackgroundJob({
        project_id: task.project_id,
        linear_issue_id: task.linear_issue_id,
        workflow_id: 'passive_refactor',
        plan: recommendation.plan
      });
    }
  }
  
  console.log(`[BG Agent] Batched analysis of ${tasks.length} issues, created ${recommendations.filter(r => r.should_fix).length} jobs`);
}
```

##### Gemini batching with caching

Similar approach using Gemini's context caching:

```js
async function analyzeWithGemini(batch) {
  const cachedContext = await gemini.createCachedContext({
    model: 'gemini-2.0-flash',
    systemInstruction: projectContext,
    contents: []  // Empty, will be reused
  });
  
  // Now all subsequent calls with this cache are much cheaper
  const response = await gemini.generateContent({
    model: 'gemini-2.0-flash',
    cachedContent: cachedContext.name,
    contents: [{ role: 'user', parts: [{ text: batchedPrompt }] }]
  });
  
  // Process...
}
```

##### Queue and rate limit

Respect provider limits and spread work over time:

```js
class BackgroundQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.rateLimits = {
      deepseek: { rpm: 10, tokens_per_min: 100000 },  // Conservative for background
      gemini: { rpm: 10, tokens_per_min: 100000 }
    };
  }
  
  async add(batch) {
    this.queue.push(batch);
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Pause if user becomes active
      if (isUserActive()) {
        console.log('[BG Queue] User active, pausing queue');
        await sleep(60 * 1000);  // Check again in 1 min
        continue;
      }
      
      const batch = this.queue.shift();
      
      try {
        await processBatch(batch);
        await sleep(6000);  // 10 RPM = 6 sec between requests
      } catch (err) {
        console.error('[BG Queue] Error processing batch:', err);
      }
    }
    
    this.processing = false;
  }
}

const bgQueue = new BackgroundQueue();
```

### Background agent main loop (revised)

```js
async function runBackgroundAgent() {
  if (isUserActive()) {
    console.log('[BG Agent] User active, skipping this cycle');
    return;
  }
  
  console.log('[BG Agent] Collecting tasks...');
  const tasks = await collectBackgroundTasks();
  
  if (tasks.length === 0) {
    console.log('[BG Agent] No tasks to process');
    return;
  }
  
  console.log(`[BG Agent] Found ${tasks.length} tasks, creating batches...`);
  const batches = createBatches(tasks);
  
  console.log(`[BG Agent] Queuing ${batches.length} batches`);
  for (const batch of batches) {
    await bgQueue.add(batch);
  }
  
  backgroundWorkHappened();
}

// Run every 15 minutes
setInterval(runBackgroundAgent, 15 * 60 * 1000);
```

***

## 3. Admin UI controls

Add controls to manually pause/resume and see queue status:

`admin/public/background-agent.html` (additions):

```html
<section>
  <h2>Queue Status</h2>
  
  <div x-data="queueStatus" x-init="loadStatus(); setInterval(() => loadStatus(), 5000)">
    <p>User active: <strong x-text="status.user_active ? 'Yes (paused)' : 'No'"></strong></p>
    <p>Queue size: <strong x-text="status.queue_size"></strong> batches</p>
    <p>Last background work: <span x-text="status.last_background_work"></span></p>
    
    <button @click="togglePause" :class="status.manually_paused ? 'primary' : 'secondary'">
      <span x-text="status.manually_paused ? '▶️ Resume' : '⏸️ Pause'"></span>
    </button>
  </div>
</section>

<script>
Alpine.data('queueStatus', () => ({
  status: { user_active: false, queue_size: 0, manually_paused: false, last_background_work: 'Never' },
  
  async loadStatus() {
    const res = await fetch('/admin/api/background-agent/status', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    this.status = await res.json();
  },
  
  async togglePause() {
    await fetch('/admin/api/background-agent/toggle-pause', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
    });
    this.loadStatus();
  }
}));
</script>
```

Backend:

```js
let manuallyPaused = false;

router.get('/background-agent/status', (req, res) => {
  res.json({
    user_active: isUserActive(),
    queue_size: bgQueue.queue.length,
    manually_paused: manuallyPaused,
    last_background_work: new Date(lastBackgroundWorkTime).toISOString()
  });
});

router.post('/background-agent/toggle-pause', (req, res) => {
  manuallyPaused = !manuallyPaused;
  res.json({ paused: manuallyPaused });
});
```

Update queue to respect manual pause:

```js
async processQueue() {
  this.processing = true;
  
  while (this.queue.length > 0) {
    if (isUserActive() || manuallyPaused) {
      await sleep(60 * 1000);
      continue;
    }
    // ... process batch
  }
}
```

***

## Summary architecture

**Fly.io sleep management:**

- Smart idle timer: sleeps after 15 min idle IF no background agent enabled, OR 30 min if background agent enabled but no recent work.
- Optional: external cron (GitHub Actions) pings every 15 min to ensure background agent runs.

**Activity-aware batching:**

- Track user activity: any `/chat`, `/refactor`, `/admin` request = active.
- Background agent checks `isUserActive()` before running; if active, skip cycle.
- Collect all eligible tasks across projects.
- Batch by project + type: multiple issues analyzed in one LLM call.
- Use provider caching (DeepSeek/Gemini) to reuse context across batches.
- Queue batches with rate limiting (10 RPM for background).
- Pause queue when user becomes active, resume when idle.

**Manual controls:**

- Admin UI shows queue status, user activity, manual pause button.
- Can force pause/resume background work independent of activity detection.

**Cost safety:**

- Per-project daily/monthly budgets enforced before queuing tasks.
- Conservative rate limits for background (10 RPM vs 100+ for interactive).
- Alert at 80% budget, hard stop at 100%.

This gives you cheap, efficient background work that stays out of your way when you're active, keeps Fly awake only when needed, and batches aggressively to minimize cost.

---

Here's the complete implementation for the batching infrastructure.

***

## 1. Database schema

Add these tables to support batching:

```sql
-- Background tasks waiting to be batched
CREATE TABLE background_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'tech_debt_refactor', 'pr_merge', 'test_improvement', etc.
  priority INTEGER DEFAULT 0,
  source_type TEXT,  -- 'linear_issue', 'github_pr', 'github_file'
  source_id TEXT,  -- Issue ID, PR number, etc.
  metadata TEXT,  -- JSON: full issue/PR data
  status TEXT DEFAULT 'pending',  -- pending, queued, processing, completed, failed
  cost_estimate_usd REAL,
  created_at TEXT,
  processed_at TEXT
);

CREATE INDEX idx_bg_tasks_status ON background_tasks(status);
CREATE INDEX idx_bg_tasks_project_type ON background_tasks(project_id, type);

-- Batches that group multiple tasks
CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'batched_refactor_analysis', 'batched_pr_merge'
  task_count INTEGER,
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  provider TEXT,  -- 'deepseek', 'gemini'
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd REAL,
  cache_hit BOOLEAN DEFAULT 0,
  created_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  error TEXT
);

CREATE INDEX idx_batches_status ON batches(status);
CREATE INDEX idx_batches_project ON batches(project_id);

-- Link tasks to batches
CREATE TABLE batch_tasks (
  batch_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  result TEXT,  -- JSON: task-specific result
  PRIMARY KEY (batch_id, task_id)
);

-- Budget tracking for background work
CREATE TABLE budget_tracking (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  cost_usd REAL DEFAULT 0,
  tasks_processed INTEGER DEFAULT 0,
  UNIQUE(project_id, date)
);
```

***

## 2. Task collector

Discovers eligible work from Linear, GitHub, etc.

`src/background/task-collector.js`:

```js
const db = require('../db');
const linearSync = require('../skills/linear-sync');
const githubSync = require('../skills/github-sync');
const { loadProjectConfig } = require('../config');

async function collectTasksForProject(projectId) {
  const config = await loadProjectConfig(projectId);
  
  if (!config.background_agent?.enabled) return [];
  
  // Check budget
  const todaySpend = await getTodaySpend(projectId);
  const budget = config.background_agent.budget.max_cost_per_day_usd;
  
  if (todaySpend >= budget) {
    console.log(`[Collector] ${projectId}: budget exhausted ($${todaySpend} / $${budget})`);
    return [];
  }
  
  const tasks = [];
  const enabledTypes = config.background_agent.tasks;
  
  // Collect tech debt issues
  if (enabledTypes.includes('tech_debt_refactor')) {
    const techDebtTasks = await collectTechDebtTasks(projectId, config);
    tasks.push(...techDebtTasks);
  }
  
  // Collect test coverage improvements
  if (enabledTypes.includes('test_coverage_improvement')) {
    const testTasks = await collectTestTasks(projectId, config);
    tasks.push(...testTasks);
  }
  
  // Collect PRs ready to merge
  if (enabledTypes.includes('pr_merge_automation')) {
    const prTasks = await collectPRTasks(projectId, config);
    tasks.push(...prTasks);
  }
  
  // Collect passive lint fixes
  if (enabledTypes.includes('passive_lint_fixes')) {
    const lintTasks = await collectLintTasks(projectId, config);
    tasks.push(...lintTasks);
  }
  
  return tasks;
}

async function collectTechDebtTasks(projectId, config) {
  const filters = config.background_agent.linear_filters;
  
  const issues = await linearSync.getIssues(projectId, {
    statuses: filters.statuses,
    labels: filters.labels,
    limit: 20
  });
  
  const tasks = [];
  
  for (const issue of issues) {
    // Skip if already tracked
    const existing = await db.get(
      'SELECT * FROM background_tasks WHERE source_type = ? AND source_id = ? AND status IN (?, ?)',
      'linear_issue', issue.id, 'pending', 'processing'
    );
    if (existing) continue;
    
    // Skip if there's an active foreground job
    const activeJob = await db.get(
      'SELECT * FROM jobs WHERE linear_issue_id = ? AND status IN (?, ?) AND job_type != ?',
      issue.id, 'running', 'pending', 'background'
    );
    if (activeJob) continue;
    
    tasks.push({
      type: 'tech_debt_refactor',
      project_id: projectId,
      source_type: 'linear_issue',
      source_id: issue.id,
      metadata: issue,
      cost_estimate_usd: 0.05,  // Rough estimate
      priority: calculatePriority(issue)
    });
  }
  
  return tasks;
}

async function collectTestTasks(projectId, config) {
  // Get files with low test coverage from last run
  const coverageData = await db.get(
    'SELECT * FROM test_coverage WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    projectId
  );
  
  if (!coverageData) return [];
  
  const coverage = JSON.parse(coverageData.data);
  const lowCoverageFiles = coverage.files.filter(f => f.coverage < 60);
  
  const tasks = lowCoverageFiles.slice(0, 10).map(file => ({
    type: 'test_improvement',
    project_id: projectId,
    source_type: 'github_file',
    source_id: file.path,
    metadata: { file: file.path, current_coverage: file.coverage },
    cost_estimate_usd: 0.08,
    priority: 100 - file.coverage  // Lower coverage = higher priority
  }));
  
  return tasks;
}

async function collectPRTasks(projectId, config) {
  const prs = await githubSync.getPRs(projectId, { state: 'open' });
  const tasks = [];
  
  for (const pr of prs) {
    const checks = await githubSync.getChecks(pr.number);
    
    const canMerge = (
      checks.approved &&
      checks.tests_passed &&
      !checks.blocking_comments
    );
    
    if (canMerge) {
      tasks.push({
        type: 'pr_merge',
        project_id: projectId,
        source_type: 'github_pr',
        source_id: pr.number.toString(),
        metadata: { pr, checks },
        cost_estimate_usd: 0.0,  // No LLM call needed
        priority: 100  // High priority - immediate action
      });
    }
  }
  
  return tasks;
}

async function collectLintTasks(projectId, config) {
  // Get files with lint errors from last run
  const lintResults = await db.get(
    'SELECT * FROM lint_results WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    projectId
  );
  
  if (!lintResults) return [];
  
  const errors = JSON.parse(lintResults.data);
  const autoFixableFiles = errors.files.filter(f => f.fixable_count > 0);
  
  const tasks = autoFixableFiles.slice(0, 15).map(file => ({
    type: 'lint_fix',
    project_id: projectId,
    source_type: 'github_file',
    source_id: file.path,
    metadata: { file: file.path, error_count: file.fixable_count },
    cost_estimate_usd: 0.02,
    priority: file.fixable_count
  }));
  
  return tasks;
}

function calculatePriority(issue) {
  let priority = 0;
  
  // Higher priority for issues with certain labels
  if (issue.labels.includes('high-impact')) priority += 50;
  if (issue.labels.includes('quick-win')) priority += 30;
  
  // Age bonus (older = higher priority)
  const ageWeeks = (Date.now() - new Date(issue.createdAt)) / (7 * 24 * 60 * 60 * 1000);
  priority += Math.min(ageWeeks * 2, 20);
  
  return Math.round(priority);
}

async function getTodaySpend(projectId) {
  const result = await db.get(`
    SELECT COALESCE(cost_usd, 0) as total
    FROM budget_tracking
    WHERE project_id = ? AND date = DATE('now')
  `, projectId);
  
  return result?.total || 0;
}

module.exports = { collectTasksForProject };
```

***

## 3. Task storage and deduplication

`src/background/task-store.js`:

```js
const db = require('../db');
const { v4: uuid } = require('uuid');

async function storeTasks(tasks) {
  const stored = [];
  
  for (const task of tasks) {
    // Check for duplicate
    const existing = await db.get(`
      SELECT * FROM background_tasks 
      WHERE source_type = ? AND source_id = ? AND status IN ('pending', 'queued', 'processing')
    `, task.source_type, task.source_id);
    
    if (existing) {
      console.log(`[TaskStore] Skipping duplicate: ${task.source_type}:${task.source_id}`);
      continue;
    }
    
    const id = uuid();
    
    await db.run(`
      INSERT INTO background_tasks (
        id, project_id, type, priority, source_type, source_id, metadata, 
        status, cost_estimate_usd, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
    `, 
      id, task.project_id, task.type, task.priority, task.source_type, 
      task.source_id, JSON.stringify(task.metadata), task.cost_estimate_usd
    );
    
    stored.push({ ...task, id });
  }
  
  return stored;
}

async function getPendingTasks(options = {}) {
  const { project_id, type, limit = 100 } = options;
  
  let query = 'SELECT * FROM background_tasks WHERE status = ?';
  const params = ['pending'];
  
  if (project_id) {
    query += ' AND project_id = ?';
    params.push(project_id);
  }
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY priority DESC, created_at ASC LIMIT ?';
  params.push(limit);
  
  const tasks = await db.all(query, ...params);
  
  return tasks.map(t => ({
    ...t,
    metadata: JSON.parse(t.metadata)
  }));
}

async function updateTaskStatus(taskId, status, result = null) {
  await db.run(`
    UPDATE background_tasks 
    SET status = ?, processed_at = datetime('now')
    WHERE id = ?
  `, status, taskId);
  
  if (result) {
    await db.run(`
      UPDATE batch_tasks SET result = ? WHERE task_id = ?
    `, JSON.stringify(result), taskId);
  }
}

module.exports = { storeTasks, getPendingTasks, updateTaskStatus };
```

***

## 4. Batch creator

Groups tasks into efficient batches.

`src/background/batch-creator.js`:

```js
const db = require('../db');
const { v4: uuid } = require('uuid');

async function createBatches(tasks) {
  if (tasks.length === 0) return [];
  
  // Group by project and type
  const groups = groupTasks(tasks);
  
  const batches = [];
  
  for (const [key, groupTasks] of Object.entries(groups)) {
    const [projectId, type] = key.split(':');
    
    if (type === 'tech_debt_refactor') {
      // Batch up to 5 refactor analyses together
      const chunks = chunkArray(groupTasks, 5);
      for (const chunk of chunks) {
        batches.push(await createBatch({
          type: 'batched_refactor_analysis',
          project_id: projectId,
          tasks: chunk,
          provider: 'deepseek',
          model: 'deepseek-chat'
        }));
      }
    } else if (type === 'test_improvement') {
      // Batch test improvements
      const chunks = chunkArray(groupTasks, 3);
      for (const chunk of chunks) {
        batches.push(await createBatch({
          type: 'batched_test_improvement',
          project_id: projectId,
          tasks: chunk,
          provider: 'deepseek',
          model: 'deepseek-chat'
        }));
      }
    } else if (type === 'lint_fix') {
      // Lint fixes can be batched aggressively
      const chunks = chunkArray(groupTasks, 10);
      for (const chunk of chunks) {
        batches.push(await createBatch({
          type: 'batched_lint_fix',
          project_id: projectId,
          tasks: chunk,
          provider: 'deepseek',
          model: 'deepseek-chat'
        }));
      }
    } else if (type === 'pr_merge') {
      // PR merges are fast and independent
      batches.push(await createBatch({
        type: 'batched_pr_merge',
        project_id: projectId,
        tasks: groupTasks,
        provider: null,  // No LLM needed
        model: null
      }));
    }
  }
  
  return batches;
}

function groupTasks(tasks) {
  const groups = {};
  
  for (const task of tasks) {
    const key = `${task.project_id}:${task.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(task);
  }
  
  return groups;
}

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function createBatch(spec) {
  const batchId = uuid();
  
  await db.run(`
    INSERT INTO batches (
      id, project_id, type, task_count, status, provider, model, created_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
  `, 
    batchId, spec.project_id, spec.type, spec.tasks.length, 
    spec.provider, spec.model
  );
  
  // Link tasks to batch
  for (const task of spec.tasks) {
    await db.run(`
      INSERT INTO batch_tasks (batch_id, task_id) VALUES (?, ?)
    `, batchId, task.id);
    
    // Mark tasks as queued
    await db.run(`
      UPDATE background_tasks SET status = 'queued' WHERE id = ?
    `, task.id);
  }
  
  return {
    id: batchId,
    ...spec
  };
}

module.exports = { createBatches };
```

***

## 5. Batch processors

Execute batches efficiently with provider-specific optimizations.

`src/background/processors/refactor-analysis.js`:

```js
const deepseek = require('../../providers/deepseek');
const { buildProjectContext } = require('../../skills/context-builder');

async function processBatchedRefactorAnalysis(batch) {
  console.log(`[Processor] Processing refactor batch ${batch.id} (${batch.tasks.length} issues)`);
  
  const projectId = batch.project_id;
  
  // Build project context once (will be cached by DeepSeek)
  const projectContext = await buildProjectContext(projectId);
  
  // Build combined prompt
  const issuesText = batch.tasks.map((task, idx) => {
    const issue = task.metadata;
    return `
## Issue ${idx + 1}: ${issue.identifier} - ${issue.title}

**Description:**
${issue.description || 'No description'}

**Labels:** ${issue.labels.join(', ')}

**Priority:** ${task.priority}
`;
  }).join('\n\n');
  
  const prompt = `Analyze these ${batch.tasks.length} tech debt issues and provide refactor recommendations for each.

For each issue, determine:
1. Should we fix it now? (yes/no)
2. Estimated complexity (low/medium/high)
3. Brief plan (2-3 sentences)
4. Files likely affected

${issuesText}

Respond in JSON format:
{
  "analyses": [
    {
      "issue_index": 0,
      "should_fix": true,
      "complexity": "low",
      "plan": "...",
      "affected_files": ["path/to/file.js"]
    },
    ...
  ]
}`;

  const startTime = Date.now();
  
  const response = await deepseek.chat({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: projectContext,
        cache_control: { type: 'ephemeral' }
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });
  
  const latency = Date.now() - startTime;
  
  // Parse response
  const result = JSON.parse(response.choices[0].message.content);
  const usage = response.usage;
  const cacheHit = usage.prompt_cache_hit_tokens > 0;
  
  // Calculate cost
  const cost = calculateCost(usage, 'deepseek-chat', cacheHit);
  
  // Update batch record
  await updateBatchCompletion(batch.id, {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    cost_usd: cost,
    cache_hit: cacheHit,
    status: 'completed'
  });
  
  // Process results for each task
  const taskResults = [];
  
  for (let i = 0; i < batch.tasks.length; i++) {
    const task = batch.tasks[i];
    const analysis = result.analyses[i];
    
    if (analysis.should_fix && analysis.complexity !== 'high') {
      // Create actual background job to fix this
      const jobId = await createBackgroundJob({
        project_id: projectId,
        linear_issue_id: task.source_id,
        workflow_id: 'passive_refactor',
        plan: analysis
      });
      
      taskResults.push({
        task_id: task.id,
        status: 'job_created',
        job_id: jobId
      });
    } else {
      taskResults.push({
        task_id: task.id,
        status: 'skipped',
        reason: analysis.should_fix ? 'too_complex' : 'not_worth_fixing'
      });
    }
    
    // Mark task complete
    await updateTaskStatus(task.id, 'completed', analysis);
  }
  
  // Track budget
  await trackBudget(projectId, cost, batch.tasks.length);
  
  console.log(`[Processor] Batch ${batch.id} completed: ${latency}ms, $${cost.toFixed(4)}, cache=${cacheHit}`);
  
  return taskResults;
}

function calculateCost(usage, model, cacheHit) {
  // DeepSeek pricing
  const inputCost = 0.14 / 1_000_000;  // $0.14/1M tokens
  const outputCost = 0.28 / 1_000_000;
  const cacheCost = 0.014 / 1_000_000;  // 10x cheaper
  
  let inputTokenCost;
  if (cacheHit) {
    const cachedTokens = usage.prompt_cache_hit_tokens || 0;
    const uncachedTokens = usage.prompt_tokens - cachedTokens;
    inputTokenCost = (uncachedTokens * inputCost) + (cachedTokens * cacheCost);
  } else {
    inputTokenCost = usage.prompt_tokens * inputCost;
  }
  
  const outputTokenCost = usage.completion_tokens * outputCost;
  
  return inputTokenCost + outputTokenCost;
}

async function updateBatchCompletion(batchId, data) {
  await db.run(`
    UPDATE batches 
    SET prompt_tokens = ?, completion_tokens = ?, cost_usd = ?, 
        cache_hit = ?, status = ?, completed_at = datetime('now')
    WHERE id = ?
  `, 
    data.prompt_tokens, data.completion_tokens, data.cost_usd, 
    data.cache_hit ? 1 : 0, data.status, batchId
  );
}

async function trackBudget(projectId, cost, taskCount) {
  await db.run(`
    INSERT INTO budget_tracking (id, project_id, date, cost_usd, tasks_processed)
    VALUES (?, ?, DATE('now'), ?, ?)
    ON CONFLICT(project_id, date) DO UPDATE SET
      cost_usd = cost_usd + excluded.cost_usd,
      tasks_processed = tasks_processed + excluded.tasks_processed
  `, uuid(), projectId, cost, taskCount);
}

module.exports = { processBatchedRefactorAnalysis };
```

`src/background/processors/pr-merge.js`:

```js
const githubSync = require('../../skills/github-sync');
const linearSync = require('../../skills/linear-sync');

async function processBatchedPRMerge(batch) {
  console.log(`[Processor] Processing PR merge batch ${batch.id} (${batch.tasks.length} PRs)`);
  
  const results = [];
  
  for (const task of batch.tasks) {
    const pr = task.metadata.pr;
    const checks = task.metadata.checks;
    
    try {
      // Verify checks one more time (in case status changed)
      const freshChecks = await githubSync.getChecks(pr.number);
      
      if (!shouldMerge(freshChecks)) {
        results.push({ task_id: task.id, status: 'skipped', reason: 'checks_failed' });
        await updateTaskStatus(task.id, 'completed', { merged: false, reason: 'checks_failed' });
        continue;
      }
      
      // Post comment
      await githubSync.addComment(pr.number, 
        `🤖 Auto-merging: All checks passed, no blocking feedback.`);
      
      // Merge
      await githubSync.merge(pr.number, { method: 'squash' });
      
      // Update Linear if linked
      if (pr.linear_issue_id) {
        await linearSync.addComment(pr.linear_issue_id, 
          `✅ PR #${pr.number} merged by background agent.`);
        await linearSync.updateStatus(pr.linear_issue_id, 'completed');
      }
      
      results.push({ task_id: task.id, status: 'merged', pr_number: pr.number });
      await updateTaskStatus(task.id, 'completed', { merged: true });
      
      console.log(`[Processor] Merged PR #${pr.number}`);
      
    } catch (err) {
      console.error(`[Processor] Failed to merge PR #${pr.number}:`, err);
      results.push({ task_id: task.id, status: 'failed', error: err.message });
      await updateTaskStatus(task.id, 'failed');
    }
  }
  
  await updateBatchCompletion(batch.id, { status: 'completed', cost_usd: 0 });
  
  return results;
}

function shouldMerge(checks) {
  return checks.approved && checks.tests_passed && !checks.blocking_comments;
}

module.exports = { processBatchedPRMerge };
```

***

## 6. Queue manager

`src/background/queue-manager.js`:

```js
const { isUserActive } = require('../activity-tracker');
const { processBatchedRefactorAnalysis } = require('./processors/refactor-analysis');
const { processBatchedPRMerge } = require('./processors/pr-merge');
const { processBatchedTestImprovement } = require('./processors/test-improvement');
const { processBatchedLintFix } = require('./processors/lint-fix');

class QueueManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.manuallyPaused = false;
    this.currentBatch = null;
    
    // Rate limits (requests per minute)
    this.rateLimits = {
      deepseek: { rpm: 10, minDelay: 6000 },
      gemini: { rpm: 10, minDelay: 6000 }
    };
    
    this.lastCallTime = {};
  }
  
  async add(batch) {
    console.log(`[Queue] Adding batch ${batch.id} (${batch.type})`);
    this.queue.push(batch);
    
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Check if we should pause
      if (this.shouldPause()) {
        console.log('[Queue] Pausing (user active or manually paused)');
        await this.sleep(60 * 1000);  // Check again in 1 min
        continue;
      }
      
      const batch = this.queue.shift();
      this.currentBatch = batch;
      
      try {
        // Rate limiting
        if (batch.provider) {
          await this.respectRateLimit(batch.provider);
        }
        
        // Mark batch as processing
        await db.run('UPDATE batches SET status = ?, started_at = datetime(?) WHERE id = ?', 
          'processing', 'now', batch.id);
        
        // Process based on type
        let result;
        switch (batch.type) {
          case 'batched_refactor_analysis':
            result = await processBatchedRefactorAnalysis(batch);
            break;
          case 'batched_pr_merge':
            result = await processBatchedPRMerge(batch);
            break;
          case 'batched_test_improvement':
            result = await processBatchedTestImprovement(batch);
            break;
          case 'batched_lint_fix':
            result = await processBatchedLintFix(batch);
            break;
          default:
            throw new Error(`Unknown batch type: ${batch.type}`);
        }
        
        console.log(`[Queue] Batch ${batch.id} completed successfully`);
        
      } catch (err) {
        console.error(`[Queue] Batch ${batch.id} failed:`, err);
        
        // Mark batch as failed
        await db.run('UPDATE batches SET status = ?, error = ? WHERE id = ?', 
          'failed', err.message, batch.id);
        
        // Mark all tasks in batch as failed
        const tasks = await db.all('SELECT task_id FROM batch_tasks WHERE batch_id = ?', batch.id);
        for (const { task_id } of tasks) {
          await updateTaskStatus(task_id, 'failed');
        }
      }
      
      this.currentBatch = null;
    }
    
    this.processing = false;
    console.log('[Queue] Queue empty, stopping');
  }
  
  shouldPause() {
    return isUserActive() || this.manuallyPaused;
  }
  
  async respectRateLimit(provider) {
    const limit = this.rateLimits[provider];
    if (!limit) return;
    
    const lastCall = this.lastCallTime[provider] || 0;
    const timeSinceLastCall = Date.now() - lastCall;
    
    if (timeSinceLastCall < limit.minDelay) {
      const waitTime = limit.minDelay - timeSinceLastCall;
      console.log(`[Queue] Rate limiting ${provider}: waiting ${waitTime}ms`);
      await this.sleep(waitTime);
    }
    
    this.lastCallTime[provider] = Date.now();
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  pause() {
    this.manuallyPaused = true;
  }
  
  resume() {
    this.manuallyPaused = false;
    if (!this.processing && this.queue.length > 0) {
      this.processQueue();
    }
  }
  
  getStatus() {
    return {
      queue_size: this.queue.length,
      processing: this.processing,
      current_batch: this.currentBatch?.id || null,
      manually_paused: this.manuallyPaused,
      user_active: isUserActive()
    };
  }
}

const queueManager = new QueueManager();

module.exports = queueManager;
```

***

## 7. Main background agent orchestrator

`src/background/agent.js`:

```js
const { collectTasksForProject } = require('./task-collector');
const { storeTasks, getPendingTasks } = require('./task-store');
const { createBatches } = require('./batch-creator');
const queueManager = require('./queue-manager');
const { isUserActive, backgroundWorkHappened } = require('../activity-tracker');
const db = require('../db');

async function runBackgroundAgent() {
  if (isUserActive()) {
    console.log('[BG Agent] User active, skipping cycle');
    return;
  }
  
  console.log('[BG Agent] Starting collection cycle...');
  
  // Get all projects
  const projects = await db.all('SELECT DISTINCT project_id FROM jobs');
  
  // Collect tasks from each project
  let allNewTasks = [];
  for (const { project_id } of projects) {
    try {
      const tasks = await collectTasksForProject(project_id);
      console.log(`[BG Agent] ${project_id}: found ${tasks.length} new tasks`);
      allNewTasks.push(...tasks);
    } catch (err) {
      console.error(`[BG Agent] Error collecting tasks for ${project_id}:`, err);
    }
  }
  
  // Store new tasks
  const stored = await storeTasks(allNewTasks);
  console.log(`[BG Agent] Stored ${stored.length} new tasks`);
  
  // Get all pending tasks (including previously collected)
  const pendingTasks = await getPendingTasks({ limit: 100 });
  console.log(`[BG Agent] Total pending tasks: ${pendingTasks.length}`);
  
  if (pendingTasks.length === 0) {
    console.log('[BG Agent] No tasks to process');
    return;
  }
  
  // Create batches
  const batches = await createBatches(pendingTasks);
  console.log(`[BG Agent] Created ${batches.length} batches`);
  
  // Add to queue
  for (const batch of batches) {
    await queueManager.add(batch);
  }
  
  backgroundWorkHappened();
}

// Run every 15 minutes
function startBackgroundAgent() {
  console.log('[BG Agent] Started (15 min intervals)');
  
  // Run immediately on start
  runBackgroundAgent();
  
  // Then every 15 minutes
  setInterval(runBackgroundAgent, 15 * 60 * 1000);
}

module.exports = { startBackgroundAgent, runBackgroundAgent };
```

***

## 8. Wire it up in main app

`src/index.js`:

```js
const express = require('express');
const { startBackgroundAgent } = require('./background/agent');
const queueManager = require('./background/queue-manager');
const { markUserActive } = require('./activity-tracker');

const app = express();

// Activity tracking middleware
app.use((req, res, next) => {
  if (req.path.startsWith('/admin') || req.path === '/chat' || req.path.startsWith('/refactor')) {
    markUserActive();
  }
  next();
});

// ... your existing routes ...

// Background agent API
app.get('/admin/api/background-agent/status', (req, res) => {
  res.json(queueManager.getStatus());
});

app.post('/admin/api/background-agent/pause', (req, res) => {
  queueManager.pause();
  res.json({ paused: true });
});

app.post('/admin/api/background-agent/resume', (req, res) => {
  queueManager.resume();
  res.json({ paused: false });
});

app.get('/admin/api/background-agent/tasks', async (req, res) => {
  const { status, project_id, limit = 50 } = req.query;
  const tasks = await getPendingTasks({ status, project_id, limit });
  res.json({ tasks });
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Router listening on port ${PORT}`);
  
  // Start background agent
  startBackgroundAgent();
});
```

***

## Summary

This gives you a complete batching system:

1. **Task Collector** discovers work from Linear/GitHub
2. **Task Store** deduplicates and persists tasks
3. **Batch Creator** groups tasks by project/type into efficient batches
4. **Batch Processors** execute batches with provider-specific optimizations (caching, rate limits)
5. **Queue Manager** processes batches respecting activity state and rate limits
6. **Main Orchestrator** runs every 15 minutes, collecting → storing → batching → queuing

**Key features:**
- Activity-aware (pauses when you're active)
- Budget-tracked (per-project daily/monthly caps)
- Rate-limited (10 RPM for background)
- Provider-optimized (DeepSeek/Gemini caching)
- Deduplication (won't process same task twice)
- Priority-based (higher priority tasks processed first)
- Observable (admin UI shows queue, costs, results)