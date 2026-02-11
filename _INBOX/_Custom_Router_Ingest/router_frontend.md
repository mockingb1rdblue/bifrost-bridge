A front-end command center for your router gives you **observability and control** without needing to ssh into Fly or parse raw logs. Here's what it can and can't do.

## What it IS and the benefits

A lightweight web UI served from your Fly router at `/admin` that acts as:

**Mission control for your AI mesh:**

- See all active and recent jobs across projects in one view.
- Understand why the router made a decision (which rules fired, which workflow ran, which provider/model was chosen).
- Audit what agents actually did (diffs, test results, Linear updates).
- Tune the system without redeploying (edit rules, approve auto-learned patterns).

**Real-time operational dashboard:**

- Job status: what's running right now, what's queued, what failed.
- Provider health: token usage, cost estimates, rate limit proximity per provider (DeepSeek/Gemini/Perplexity).
- Linear sync status: which issues are being worked on, by which agent.

**Policy editor and inspector:**

- View/edit global rules, workflows, and skills as JSON with syntax highlighting.
- "Effective policy tester": input a scenario (project + task + file path) and see exactly which rules match and what the router would do—without actually running it.
- Approve or reject auto-learned rule suggestions from the learning loop.

**Artifact viewer:**

- Browse stored IRs, plans, diffs, test reports, logs.
- Click through from Linear issue → router job → artifacts → specific slice/file changes.

**Cost and usage analytics:**

- Simple charts: tokens and estimated cost per provider over time.
- Breakdown by project, task type, or workflow.
- Alerts when approaching budget thresholds.

***

## What it CAN do

### Visibility

- **Job explorer:** table/list of recent jobs with filters (project, status, date range). Click a job to see:
  - Linear issue link.
  - Workflow and steps executed.
  - Provider/model used per step.
  - Token usage and latency.
  - Artifacts (IR, plan, diffs, logs).
  
- **Live tail:** stream router logs in real-time (like `fly logs` but filtered and formatted for humans).

- **Rules/workflows/skills viewer:** browse the current active config with:
  - Which rules came from global vs project.
  - Which workflows are available.
  - Which skills each stack provides.

- **Effective policy inspector:** a form where you enter:
  - Project ID
  - Task type
  - Optional file path
  
  Router runs policy resolution in dry-run mode and shows:
  - Which rules matched (in priority order).
  - Which workflow would run.
  - Which provider/model and skills would be invoked.
  - Estimated token cost.

### Control

- **Edit rules inline:** click a rule, edit the JSON, save. Router reloads config and applies new rules immediately (or after confirmation).

- **Manual job actions:**
  - Retry a failed job.
  - Cancel a running job.
  - Mark a job as "needs human review" and pause workflow progression.

- **Approve/reject learned rules:** the auto-learning loop proposes new rules; you see them in a queue and can click "Accept" (adds to global rules) or "Reject" (ignores).

- **Force provider/model:** for debugging, you can override: "run this job with Gemini Pro instead of DeepSeek."

- **Trigger workflows manually:** start a project ingest, self-heal, or refactor from the UI without going through VS Code.

### Integration hooks

- **Linear deep links:** click any issue ID in the UI, opens Linear in a new tab.
- **Artifact download:** download IRs, plans, diffs as JSON/text files.
- **Export logs:** export job logs or usage stats as CSV for offline analysis.

***

## What it CAN'T do

### Not a code editor

- It's **read-only for code**: you can view diffs and artifacts, but you can't edit files directly in the UI.
- If you want to tweak something, you do it in VS Code or your editor; the command center just shows you what happened.

### Not a full project management tool

- It's **not replacing Linear**: Linear is still your source of truth for issues, milestones, and team collaboration.
- The command center shows what the *router* knows about Linear (synced issues, job-to-issue mappings), but you manage roadmaps and backlogs in Linear itself.

### Not a real-time collaboration surface

- It's **single-user focused**: designed for you (or a small team) to monitor and steer the router, not for multiple people to work simultaneously in the UI.
- No rich commenting, chat, or collaborative editing—just config management and observability.

### Not an agent interaction layer

- You can't "chat with an agent" in the command center; that happens in VS Code or terminal.
- The UI shows agent *outputs* (what they did, logs, results), not an interactive conversation.

### Limited without network access

- If the Fly router is asleep or unreachable, the UI is unavailable.
- There's no offline mode or local cache; it's live data from the router's SQLite/memory.

### Not a standalone product

- It's tightly coupled to **your** router and config; it's not a generic "AI project dashboard" you could use for other tools.
- If you want to monitor non-router AI work (e.g., manual Cursor sessions), you'd need to log that separately and surface it here.

***

## Architecture: how it works

**Backend (already on the router):**

- `/admin/api/*` endpoints that query:
  - SQLite for job logs, usage stats.
  - In-memory cache for current rules/workflows/skills.
  - Linear API for issue status (optional, or cache locally).

**Frontend:**

- Single-page app (React/Vue or just vanilla JS + htmx for minimal bundle).
- Served from `/admin` as static HTML/JS/CSS.
- Talks to `/admin/api/*` via fetch.
- Total size: aim for <200 KB so it loads fast even on Fly cold start.

**Auth:**

- Simple: same API key you use in VS Code, or a separate admin token set via `fly secrets`.
- No OAuth or complex user management (you're the only user for now).

***

## Example screens

### Dashboard (home)

- **Active jobs** (currently running): project, task, elapsed time, progress bar.
- **Recent jobs** (last 24h): table with status icons, links to details.
- **Usage today**: token count and cost per provider (bar chart).
- **Alerts**: "DeepSeek approaching RPM limit," "3 jobs failed in last hour."

### Job detail

- Header: job ID, project, Linear issue link, status, timestamps.
- Tabs:
  - **Plan**: the workflow steps and which skills ran.
  - **Artifacts**: links to IR, diffs, test reports.
  - **Logs**: structured logs from each skill invocation.
  - **Usage**: tokens/cost breakdown per step.

### Rules editor

- List of global rules (collapsible JSON blocks).
- Click to expand/edit inline.
- "Test this rule" button: opens policy inspector pre-filled with this rule's `when` conditions.

### Policy inspector

- Form:
  - Project dropdown.
  - Task type dropdown.
  - Optional file path input.
  - "Dry run" button.
- Result panel:
  - "Matched rules: #1 (priority 100), #5 (priority 20)."
  - "Workflow: node_monolith_refactor."
  - "Provider: DeepSeek R1, estimated 8k tokens."

### Learning queue

- Table of proposed rules from auto-learning:
  - Condition, action, frequency (how many times pattern observed).
  - "Accept" / "Reject" buttons.
- Accepted rules get appended to global config and take effect immediately.

***

## When you'd use it

**Daily:**

- Glance at dashboard to see if anything is broken or stuck.
- Check usage to make sure you're not burning tokens unexpectedly.

**Weekly:**

- Review learning queue, approve useful new rules.
- Browse recent jobs to see patterns (which projects are most active, which workflows succeed/fail).

**When debugging:**

- A job failed: click through to logs and artifacts, see exactly what the agent tried and where it broke.
- Policy feels wrong: use inspector to understand which rules are firing, tweak them, re-run.

**When evolving the system:**

- Add a new workflow or skill: use the UI to verify it's loaded correctly and test it with the inspector.
- Experiment with new rules: add them, run a few test jobs, observe outcomes, iterate.

***

## TL;DR

**Benefits:**

- Single pane of glass for all router activity.
- Understand decisions without reading code or logs.
- Edit config and approve learned patterns without redeploying.
- Track cost and usage in real-time.

**Can do:**

- View jobs, logs, artifacts, rules, workflows, usage.
- Edit rules and approve learning.
- Dry-run policy resolution.
- Manual job control (retry, cancel).

**Can't do:**

- Edit code (VS Code's job).
- Replace Linear (it's still your backlog).
- Interactive chat with agents.
- Work offline.

It's **mission control**, not a full IDE or project manager—lean, fast, and purpose-built to keep your AI mesh transparent and steerable.

---

Here's a concrete, phased plan to build the admin command center.

***

## Tech stack (optimized for speed and simplicity)

**Backend (on your existing router):**

- Same Node/FastAPI app you're already building.
- Add `/admin/api/*` routes.
- SQLite for querying logs/jobs (already planned).
- In-memory cache for current config (rules/workflows/skills).

**Frontend:**

- **Option A (recommended):** Vanilla JS + htmx + Alpine.js
  - Ultra-light: ~50 KB total.
  - Server-rendered HTML with htmx for dynamic updates.
  - Alpine.js for minimal client-side interactivity.
  - Fast even on Fly cold start.

- **Option B:** React + Vite (if you prefer component model)
  - ~150 KB bundle.
  - Use React Router for navigation.
  - Deploy as static build served from `/admin`.

**Styling:**

- Tailwind CSS or Pico.css (classless, tiny).
- Dark mode by default (easier on eyes for monitoring).

**Charts:**

- Chart.js or Apache ECharts (lightweight, good enough for usage graphs).

***

## Backend API structure

Define these routes in your router:

### Core data endpoints

```
GET  /admin/api/status              # Router health, uptime, version
GET  /admin/api/jobs                # List jobs (query: ?project_id, ?status, ?limit, ?offset)
GET  /admin/api/jobs/:id            # Job detail (plan, steps, logs, artifacts)
POST /admin/api/jobs/:id/retry      # Retry failed job
POST /admin/api/jobs/:id/cancel     # Cancel running job

GET  /admin/api/config/global       # Global rules, workflows, skills
GET  /admin/api/config/project/:id  # Project-specific config
POST /admin/api/config/rules        # Update a rule (body: rule JSON)
POST /admin/api/config/reload       # Force reload config from disk

GET  /admin/api/policy/inspect      # Dry-run policy (query: ?project_id, ?task_type, ?path)

GET  /admin/api/usage               # Usage stats (query: ?period=day|week|month, ?provider)
GET  /admin/api/usage/cost          # Cost breakdown per provider/project

GET  /admin/api/learning/queue      # Proposed rules from auto-learning
POST /admin/api/learning/accept/:id # Accept a proposed rule
POST /admin/api/learning/reject/:id # Reject a proposed rule

GET  /admin/api/artifacts/:id       # Download artifact (IR, diff, log) by ID

GET  /admin/api/logs/tail           # SSE stream of live logs
```

### Response formats

All JSON except:

- `/admin/api/logs/tail` → Server-Sent Events (SSE) stream.
- `/admin/api/artifacts/:id` → Raw text/JSON download.

Example job list response:

```json
{
  "jobs": [
    {
      "id": "job_789",
      "project_id": "my-node-service",
      "linear_issue_id": "ISSUE-123",
      "linear_issue_url": "https://linear.app/...",
      "workflow_id": "node_monolith_refactor",
      "status": "completed",
      "created_at": "2026-02-09T20:00:00Z",
      "completed_at": "2026-02-09T20:05:30Z",
      "usage": {
        "deepseek": { "tokens": 12000, "cost_usd": 0.08 },
        "gemini": { "tokens": 0, "cost_usd": 0 }
      }
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

***

## Frontend architecture

### File structure (Option A: htmx + Alpine)

```
/admin
  /public
    index.html          # Main dashboard
    jobs.html           # Jobs list
    job-detail.html     # Job detail (template, rendered server-side)
    rules.html          # Rules editor
    policy.html         # Policy inspector
    learning.html       # Learning queue
    usage.html          # Usage/cost charts
    /css
      styles.css        # Tailwind or Pico
    /js
      app.js            # Alpine components, helpers
      charts.js         # Chart.js setup
  /templates (server-side)
    job-row.html        # htmx partial: single job row
    rule-card.html      # htmx partial: single rule card
```

### Routing

Simple: each HTML page is a separate route on the server.

- `/admin/` → `index.html` (dashboard)
- `/admin/jobs` → `jobs.html`
- `/admin/jobs/:id` → `job-detail.html` (server renders with data)
- `/admin/rules` → `rules.html`
- etc.

Use htmx to load partials dynamically (e.g., infinite scroll on jobs list, live log updates).

***

## Phased implementation

### Phase 1: Core infrastructure (Week 1)

**Goal:** Get basic backend API + static frontend skeleton running.

**Backend tasks:**

1. Add `/admin/api/status` endpoint (return router version, uptime, config version).
2. Add `/admin/api/jobs` endpoint:
   - Query SQLite for job logs.
   - Return paginated JSON.
3. Add `/admin/api/jobs/:id` endpoint:
   - Fetch job detail from SQLite.
   - Fetch related artifacts (IR, plan, diffs) by ID.
4. Add simple auth: check for `Authorization: Bearer <admin_token>` header on all `/admin/*` routes.

**Frontend tasks:**

1. Create `index.html` (dashboard skeleton):
   - Header with router status.
   - Section for "Active jobs" (empty for now).
   - Section for "Recent jobs" (hardcoded placeholder).
2. Create `jobs.html`:
   - Table with columns: ID, Project, Status, Created, Actions.
   - Fetch from `/admin/api/jobs` on load and render rows.
3. Add basic CSS (Pico.css or Tailwind).
4. Deploy: serve `/admin` static files from your router.

**Deliverable:** You can visit `https://your-router.fly.dev/admin` and see a list of jobs.

***

### Phase 2: Job detail and logs (Week 2)

**Goal:** Click a job and see full detail + logs.

**Backend tasks:**

1. Enhance `/admin/api/jobs/:id` to include:
   - Workflow steps executed.
   - Per-step usage (tokens, latency).
   - Links to artifacts.
2. Add `/admin/api/logs/tail`:
   - SSE endpoint that streams recent logs.
   - Filter by job_id if provided.

**Frontend tasks:**

1. Create `job-detail.html`:
   - Header: job ID, Linear issue link, status badge.
   - Tabs: Plan, Artifacts, Logs, Usage.
   - Plan tab: render workflow steps as a timeline.
   - Artifacts tab: list artifacts with download links.
   - Logs tab: fetch `/admin/api/logs/tail?job_id=X` and display in a scrollable log viewer.
   - Usage tab: simple table of tokens/cost per provider.
2. Wire up navigation: clicking a job in `jobs.html` opens `job-detail.html`.

**Deliverable:** Full job inspection with logs and artifacts.

***

### Phase 3: Config viewer and policy inspector (Week 3)

**Goal:** View current rules/workflows and test policy resolution.

**Backend tasks:**

1. Add `/admin/api/config/global`:
   - Return current rules, workflows, skills as JSON.
2. Add `/admin/api/policy/inspect`:
   - Accept `?project_id=X&task_type=Y&path=Z`.
   - Run policy resolution in dry-run mode.
   - Return: matched rules (in order), selected workflow, chosen provider/model, estimated cost.

**Frontend tasks:**

1. Create `rules.html`:
   - List all global rules as collapsible cards.
   - Each card shows: id, description, priority, when/then conditions.
   - "Test this rule" button opens policy inspector pre-filled.
2. Create `policy.html`:
   - Form: project dropdown, task type dropdown, optional path input, "Dry run" button.
   - Result panel: matched rules, workflow, provider/model, estimated tokens.
3. Add a "Config" nav item in header linking to `rules.html`.

**Deliverable:** You can inspect all rules and test "what would the router do" for any scenario.

***

### Phase 4: Usage and cost analytics (Week 4)

**Goal:** Visualize token usage and costs over time.

**Backend tasks:**

1. Add `/admin/api/usage`:
   - Query SQLite logs, aggregate by provider and time period (day/week/month).
   - Return: `{ period: "2026-02-09", provider: "deepseek", tokens: 120000, cost_usd: 0.85 }`.
2. Add `/admin/api/usage/cost`:
   - Aggregate by project or task type.

**Frontend tasks:**

1. Create `usage.html`:
   - Chart: tokens per provider over last 7 days (line or bar chart with Chart.js).
   - Chart: cost per provider (pie or bar).
   - Table: top projects by token usage.
2. Add chart rendering logic in `charts.js`.
3. Add "Usage" nav item in header.

**Deliverable:** Visual dashboard for monitoring cost and usage trends.

***

### Phase 5: Editing and control (Week 5)

**Goal:** Edit rules inline, retry jobs, approve learned rules.

**Backend tasks:**

1. Add `POST /admin/api/config/rules`:
   - Accept updated rule JSON.
   - Validate schema.
   - Write to `rules.global.json`.
   - Reload config.
2. Add `POST /admin/api/jobs/:id/retry`:
   - Re-queue job for execution.
3. Add `/admin/api/learning/queue`:
   - Return proposed rules from auto-learning system.
4. Add `POST /admin/api/learning/accept/:id`:
   - Append rule to global config.
5. Add `POST /admin/api/learning/reject/:id`:
   - Mark as rejected in DB.

**Frontend tasks:**

1. Enhance `rules.html`:
   - "Edit" button per rule opens inline JSON editor (textarea or Monaco editor if you want fancy).
   - "Save" button POSTs to `/admin/api/config/rules`.
2. Add "Retry" button on failed jobs in `job-detail.html`.
3. Create `learning.html`:
   - Table of proposed rules with "Accept" / "Reject" buttons.
4. Add "Learning" nav item.

**Deliverable:** Full control loop—view, edit, approve, retry, all from the UI.

***

### Phase 6: Polish and production-ready (Week 6)

**Goal:** Make it fast, secure, and pleasant to use.

**Tasks:**

1. **Auth hardening:**
   - Rotate admin token regularly.
   - Add rate limiting on `/admin/api/*` (e.g., 100 req/min per IP).
2. **Performance:**
   - Add caching headers on static assets (CSS/JS).
   - Paginate jobs list (default 20 per page).
   - Index SQLite logs table on `created_at`, `project_id`, `status`.
3. **UX polish:**
   - Add loading spinners for async actions.
   - Toast notifications for success/error (e.g., "Rule saved successfully").
   - Keyboard shortcuts (e.g., `/` to focus search, `r` to reload).
4. **Dark mode:**
   - Use `prefers-color-scheme` or a toggle.
5. **Mobile-friendly:**
   - Responsive layout (works on phone for quick checks).
6. **Error handling:**
   - Graceful fallback if router is asleep (show "Router offline, waking up..." message).

**Deliverable:** Production-ready command center.

***

## Deployment on Fly.io

The frontend is served directly from your router app, so no separate deployment.

### Node/Express example

```js
// server.js
const express = require('express');
const app = express();

// API routes
app.get('/admin/api/status', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

app.get('/admin/api/jobs', async (req, res) => {
  const jobs = await queryJobsFromSQLite(req.query);
  res.json({ jobs });
});

// ... other API routes ...

// Serve static frontend
app.use('/admin', express.static('admin/public'));

// Fallback: serve index.html for SPA routes (if using React)
app.get('/admin/*', (req, res) => {
  res.sendFile(__dirname + '/admin/public/index.html');
});

app.listen(8080);
```

### Build step (if using Vite for React)

```bash
cd admin-frontend
npm run build  # Outputs to admin/public
```

Then commit `admin/public` or build it during Docker image creation.

***

## Minimal starter (Option A: htmx)

### `admin/public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Router Admin</title>
  <link rel="stylesheet" href="https://unpkg.com/@picocss/pico@latest/css/pico.min.css">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body>
  <nav class="container-fluid">
    <ul><li><strong>Router Admin</strong></li></ul>
    <ul>
      <li><a href="/admin/">Dashboard</a></li>
      <li><a href="/admin/jobs">Jobs</a></li>
      <li><a href="/admin/rules">Rules</a></li>
      <li><a href="/admin/usage">Usage</a></li>
    </ul>
  </nav>

  <main class="container" x-data="dashboard">
    <h1>Dashboard</h1>
    
    <section>
      <h2>Router Status</h2>
      <div hx-get="/admin/api/status" hx-trigger="load" hx-swap="innerHTML">
        Loading...
      </div>
    </section>

    <section>
      <h2>Recent Jobs</h2>
      <div hx-get="/admin/api/jobs?limit=10" hx-trigger="load" hx-target="#jobs-list">
        <table id="jobs-list">
          <tr><td>Loading...</td></tr>
        </table>
      </div>
    </section>
  </main>

  <script>
    document.body.addEventListener('htmx:afterSwap', (e) => {
      if (e.detail.target.id === 'jobs-list') {
        // Jobs loaded, can add interactivity here
      }
    });
  </script>
</body>
</html>
```

### Server-side partial: `/admin/api/jobs` returns HTML

```html
<table>
  <thead>
    <tr><th>ID</th><th>Project</th><th>Status</th><th>Created</th></tr>
  </thead>
  <tbody>
    {{#each jobs}}
    <tr>
      <td><a href="/admin/jobs/{{id}}">{{id}}</a></td>
      <td>{{project_id}}</td>
      <td><span class="badge {{status}}">{{status}}</span></td>
      <td>{{created_at}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

***

## Timeline summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Core infra | 1 week | Jobs list visible |
| 2. Job detail | 1 week | Full job inspection with logs |
| 3. Config viewer | 1 week | Rules + policy inspector |
| 4. Usage charts | 1 week | Cost/usage analytics |
| 5. Editing | 1 week | Edit rules, retry jobs, learning queue |
| 6. Polish | 1 week | Production-ready, fast, secure |

**Total: 6 weeks part-time** or **2–3 weeks full-time.**

***

This gives you a fast, lightweight, production-ready command center that loads in <1 second even on Fly cold start, scales with your router, and keeps your AI mesh fully transparent and steerable.

---

Here's a decision framework based on your specific context.

## Your priorities (from what you've told me)

1. **Fast on Fly cold start** – You're doing 5-15 min idle shutdowns; UI needs to load instantly when you wake the router.
2. **Low ceremony** – You're building a ton already (router, workflows, Linear sync, multi-provider orchestration); you don't want the frontend to become a second full-time job.
3. **Single user (mostly you)** – Not shipping to customers; this is mission control for your own AI mesh.
4. **Iterate fast** – You'll want to tweak and add features as you learn what you actually need.

## The case for Alpine + htmx

**Why it fits:**

- **Tiny bundle (~50 KB):** Loads in <500ms even on Fly cold start, which matters when you're waking the router to check something. [fly](https://fly.io/docs/launch/autostop-autostart/)
- **Server-driven:** Your router is already the brain; Alpine + htmx keeps it that way. The backend renders HTML, htmx swaps it in. Less client-side state to manage.
- **Zero build step (or minimal):** Drop in CDN scripts and go. If you want Tailwind, add a tiny build step, but you're not maintaining a complex Vite config or worrying about tree-shaking.
- **Good enough for dashboards:** Monitoring UIs don't need React's power. You're showing tables, forms, charts, and logs—all things htmx + Alpine handle cleanly.
- **Less to maintain:** Fewer dependencies, no framework churn. You're not upgrading React every 6 months or debugging hydration issues.

**Where it struggles:**

- **Complex interactions:** If you want drag-and-drop rule reordering, rich Monaco editor for JSON, or real-time collaborative editing, Alpine gets clunky.
- **State management:** For simple stuff (show/hide, form state), Alpine is great. For "manage a complex workflow builder UI," you'll miss React's component model and hooks.
- **Familiarity:** If you already think in React, Alpine's `x-data` and directives feel like a step backward.

## The case for Vite + React

**Why it fits:**

- **Component model:** If you're building lots of similar UI patterns (rule cards, job rows, artifact viewers), React components make that fast and reusable.
- **State management:** useContext, Zustand, or even just useState make handling complex UI state easier than Alpine.
- **Ecosystem:** Need a fancy chart? React-Recharts. Rich JSON editor? Monaco + a React wrapper. Everything has a React package.
- **TypeScript:** If you want strong typing across your UI, React + TS is better supported than Alpine.
- **Future-proof:** If this grows into a team tool or you want to add heavier features (workflow visual editor, real-time collab), React won't hold you back.

**Where it costs you:**

- **Bundle size (~150-200 KB):** Still fast, but 3x Alpine. On a slow Fly cold start, that's an extra second of load time.
- **Build complexity:** You're adding Vite, configuring paths, managing dependencies, running `npm run build` before deploy. Not huge, but it's friction.
- **Overhead:** You're maintaining a React app alongside the router. More files, more deps, more "why is this not working" moments when something breaks.

## Decision matrix

| Scenario | Recommendation |
|----------|----------------|
| **You want it done fast, good enough, maintainable** | **Alpine + htmx** |
| You plan to keep the UI simple (tables, forms, logs, charts) | Alpine + htmx |
| You care most about fast load on cold start | Alpine + htmx |
| You're comfortable with server-rendered HTML + progressive enhancement | Alpine + htmx |
| **You already think in React and don't want to learn Alpine** | **Vite + React** |
| You anticipate complex client-side features (visual editors, drag-drop, etc.) | Vite + React |
| You want strong TypeScript support everywhere | Vite + React |
| You're building this as a stepping stone to a team product | Vite + React |

## My recommendation for you

**Start with Alpine + htmx**, because:

1. Your router is the hard part; the UI is just a view into it. Keep it simple.
2. You value speed and low ceremony ("competence over compliance").
3. Cold start matters—50 KB vs 150 KB is meaningful when you're waking Fly every time.
4. You can ship phase 1-4 in less time without fighting a bundler.

**Migrate to React later if:**

- You hit a wall with Alpine (e.g., you want a visual workflow editor and Alpine is painful).
- The UI becomes a bigger part of the project and you want better structure.
- You add collaborators who prefer React.

The migration path is straightforward: your backend API stays the same, you just rebuild the frontend with Vite + React and point it at the same `/admin/api/*` routes. You don't lose work.

## Hybrid option (pragmatic)

If you're torn:

- **Phase 1-3 (6 weeks):** Alpine + htmx. Get the basics working fast.
- **Phase 4+:** If you're hitting limits or want richer features, rebuild the frontend in React. By then you'll know exactly what you need, and the API will be stable.

This way you don't over-engineer early, but you're not locked in.

***

**TL;DR: Go Alpine + htmx.** It's faster to build, faster to load, easier to maintain, and good enough for a single-user mission control UI. If you outgrow it, React is there as an escape hatch. Given everything else you're building, this keeps the frontend from becoming a bottleneck.

---

Here's the complete implementation plan for the Alpine + htmx admin command center.

***

## Project structure

```
your-router/
├── src/
│   ├── index.js                 # Main router app
│   ├── api/
│   │   └── admin.js             # Admin API routes
│   └── db.js                    # SQLite helpers
├── admin/
│   ├── public/
│   │   ├── index.html           # Dashboard
│   │   ├── jobs.html            # Jobs list
│   │   ├── job-detail.html      # Job detail
│   │   ├── rules.html           # Rules viewer/editor
│   │   ├── policy.html          # Policy inspector
│   │   ├── learning.html        # Learning queue
│   │   ├── usage.html           # Usage/cost charts
│   │   ├── css/
│   │   │   └── styles.css       # Custom styles (optional, Pico handles most)
│   │   └── js/
│   │       ├── app.js           # Alpine components & helpers
│   │       └── charts.js        # Chart.js setup
│   └── templates/               # Server-rendered partials (htmx)
│       ├── job-row.html
│       ├── rule-card.html
│       └── log-line.html
├── config/
│   ├── rules.global.json
│   ├── workflows.json
│   └── skills.json
├── data/
│   └── router.db                # SQLite
├── fly.toml
├── Dockerfile
└── package.json
```

***

## Backend setup (Node/Express)

### `src/index.js` (main app)

```js
const express = require('express');
const path = require('path');
const adminRoutes = require('./api/admin');

const app = express();
app.use(express.json());

// Admin API
app.use('/admin/api', adminRoutes);

// Serve static admin frontend
app.use('/admin', express.static(path.join(__dirname, '../admin/public')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Main router endpoints (your existing /chat, /refactor, etc.)
// ... existing routes ...

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Router listening on port ${PORT}`);
});
```

### `src/api/admin.js` (admin API routes)

```js
const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

// Simple auth middleware
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAuth);

// Status
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    config_version: global.configVersion || 1
  });
});

// Jobs list
router.get('/jobs', async (req, res) => {
  const { project_id, status, limit = 20, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  
  if (project_id) {
    query += ' AND project_id = ?';
    params.push(project_id);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const jobs = await db.all(query, params);
  const total = await db.get('SELECT COUNT(*) as count FROM jobs');
  
  res.json({ jobs, total: total.count, page: Math.floor(offset / limit) + 1, per_page: limit });
});

// Job detail
router.get('/jobs/:id', async (req, res) => {
  const job = await db.get('SELECT * FROM jobs WHERE id = ?', req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const steps = await db.all('SELECT * FROM job_steps WHERE job_id = ? ORDER BY step_order', req.params.id);
  const artifacts = await db.all('SELECT * FROM artifacts WHERE job_id = ?', req.params.id);
  
  res.json({ job, steps, artifacts });
});

// Retry job
router.post('/jobs/:id/retry', async (req, res) => {
  const job = await db.get('SELECT * FROM jobs WHERE id = ?', req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  // Create new job with same params
  const newJobId = await createJob({ ...job, status: 'pending' });
  
  res.json({ success: true, new_job_id: newJobId });
});

// Cancel job
router.post('/jobs/:id/cancel', async (req, res) => {
  await db.run('UPDATE jobs SET status = ? WHERE id = ?', 'cancelled', req.params.id);
  res.json({ success: true });
});

// Config - global
router.get('/config/global', async (req, res) => {
  const rules = JSON.parse(await fs.readFile(path.join(__dirname, '../../config/rules.global.json'), 'utf8'));
  const workflows = JSON.parse(await fs.readFile(path.join(__dirname, '../../config/workflows.json'), 'utf8'));
  const skills = JSON.parse(await fs.readFile(path.join(__dirname, '../../config/skills.json'), 'utf8'));
  
  res.json({ rules, workflows, skills });
});

// Config - project
router.get('/config/project/:id', async (req, res) => {
  // Load from cache or project repo
  const projectConfig = global.projectConfigs?.[req.params.id] || {};
  res.json(projectConfig);
});

// Update rule
router.post('/config/rules', async (req, res) => {
  const { rule } = req.body;
  
  // Validate rule schema
  if (!rule.id || !rule.when || !rule.then) {
    return res.status(400).json({ error: 'Invalid rule format' });
  }
  
  // Load current rules
  const rulesPath = path.join(__dirname, '../../config/rules.global.json');
  const rulesData = JSON.parse(await fs.readFile(rulesPath, 'utf8'));
  
  // Update or add rule
  const index = rulesData.rules.findIndex(r => r.id === rule.id);
  if (index >= 0) {
    rulesData.rules[index] = rule;
  } else {
    rulesData.rules.push(rule);
  }
  
  rulesData.version++;
  
  // Write back
  await fs.writeFile(rulesPath, JSON.stringify(rulesData, null, 2));
  
  // Reload config in memory
  reloadConfig();
  
  res.json({ success: true, version: rulesData.version });
});

// Reload config
router.post('/config/reload', (req, res) => {
  reloadConfig();
  res.json({ success: true, version: global.configVersion });
});

// Policy inspector (dry run)
router.get('/policy/inspect', async (req, res) => {
  const { project_id, task_type, path } = req.query;
  
  // Run policy resolution without executing
  const result = await dryRunPolicy({ project_id, task_type, path });
  
  res.json(result);
});

// Usage stats
router.get('/usage', async (req, res) => {
  const { period = 'day', provider } = req.query;
  
  let dateFilter;
  if (period === 'day') dateFilter = 'DATE(created_at) = DATE("now")';
  else if (period === 'week') dateFilter = 'DATE(created_at) >= DATE("now", "-7 days")';
  else dateFilter = 'DATE(created_at) >= DATE("now", "-30 days")';
  
  let query = `
    SELECT 
      provider,
      DATE(created_at) as date,
      SUM(prompt_tokens + completion_tokens) as tokens,
      SUM(cost_usd) as cost
    FROM job_steps
    WHERE ${dateFilter}
  `;
  
  if (provider) {
    query += ' AND provider = ?';
  }
  
  query += ' GROUP BY provider, date ORDER BY date DESC';
  
  const usage = await db.all(query, provider ? [provider] : []);
  res.json({ usage });
});

// Usage by cost
router.get('/usage/cost', async (req, res) => {
  const usage = await db.all(`
    SELECT 
      provider,
      project_id,
      SUM(cost_usd) as total_cost,
      SUM(prompt_tokens + completion_tokens) as total_tokens
    FROM job_steps
    WHERE DATE(created_at) >= DATE("now", "-30 days")
    GROUP BY provider, project_id
    ORDER BY total_cost DESC
  `);
  
  res.json({ usage });
});

// Learning queue
router.get('/learning/queue', async (req, res) => {
  const queue = await db.all(`
    SELECT * FROM learning_queue 
    WHERE status = 'pending' 
    ORDER BY frequency DESC, created_at DESC
  `);
  
  res.json({ queue });
});

// Accept learned rule
router.post('/learning/accept/:id', async (req, res) => {
  const item = await db.get('SELECT * FROM learning_queue WHERE id = ?', req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  
  // Add rule to global config
  const rule = JSON.parse(item.rule_json);
  const rulesPath = path.join(__dirname, '../../config/rules.global.json');
  const rulesData = JSON.parse(await fs.readFile(rulesPath, 'utf8'));
  
  rulesData.rules.push(rule);
  rulesData.version++;
  
  await fs.writeFile(rulesPath, JSON.stringify(rulesData, null, 2));
  
  // Mark as accepted
  await db.run('UPDATE learning_queue SET status = ? WHERE id = ?', 'accepted', req.params.id);
  
  reloadConfig();
  
  res.json({ success: true });
});

// Reject learned rule
router.post('/learning/reject/:id', async (req, res) => {
  await db.run('UPDATE learning_queue SET status = ? WHERE id = ?', 'rejected', req.params.id);
  res.json({ success: true });
});

// Artifacts
router.get('/artifacts/:id', async (req, res) => {
  const artifact = await db.get('SELECT * FROM artifacts WHERE id = ?', req.params.id);
  if (!artifact) return res.status(404).json({ error: 'Not found' });
  
  res.setHeader('Content-Type', artifact.mime_type || 'text/plain');
  res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
  res.send(artifact.content);
});

// Live log tail (SSE)
router.get('/logs/tail', (req, res) => {
  const { job_id } = req.query;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial logs
  db.all('SELECT * FROM logs WHERE job_id = ? ORDER BY created_at DESC LIMIT 100', job_id || null)
    .then(logs => {
      logs.reverse().forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });
    });
  
  // Subscribe to new logs (pseudo-code, implement with event emitter)
  const listener = (log) => {
    if (!job_id || log.job_id === job_id) {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    }
  };
  
  global.logEmitter.on('log', listener);
  
  req.on('close', () => {
    global.logEmitter.off('log', listener);
  });
});

module.exports = router;
```

### `src/db.js` (SQLite helpers)

```js
const sqlite3 = require('sqlite3');
const { promisify } = require('util');

const db = new sqlite3.Database('./data/router.db');

// Promisify common methods
db.all = promisify(db.all.bind(db));
db.get = promisify(db.get.bind(db));
db.run = promisify(db.run.bind(db));

// Initialize schema
db.run(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    linear_issue_id TEXT,
    linear_issue_url TEXT,
    workflow_id TEXT,
    status TEXT,
    created_at TEXT,
    completed_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS job_steps (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    skill_id TEXT,
    provider TEXT,
    model TEXT,
    step_order INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    cost_usd REAL,
    latency_ms INTEGER,
    status TEXT,
    created_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    type TEXT,
    filename TEXT,
    mime_type TEXT,
    content TEXT,
    created_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    level TEXT,
    message TEXT,
    created_at TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS learning_queue (
    id TEXT PRIMARY KEY,
    rule_json TEXT,
    condition TEXT,
    action TEXT,
    frequency INTEGER,
    status TEXT,
    created_at TEXT
  )
`);

module.exports = db;
```

***

## Frontend pages

### Shared layout snippet (include in each HTML)

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Router Admin - Dashboard</title>
  
  <!-- Pico CSS (classless) -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  
  <!-- htmx -->
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  
  <!-- Alpine.js -->
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  
  <!-- Chart.js (for usage page) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  
  <!-- Custom styles -->
  <style>
    :root { --spacing: 1rem; }
    nav { padding: 0.5rem 1rem; }
    .badge { 
      display: inline-block; 
      padding: 0.25rem 0.5rem; 
      border-radius: 0.25rem; 
      font-size: 0.875rem;
      font-weight: 600;
    }
    .badge.completed { background: var(--pico-primary-background); color: var(--pico-primary-inverse); }
    .badge.failed { background: var(--pico-del-background); color: var(--pico-del-color); }
    .badge.running { background: var(--pico-ins-background); color: var(--pico-ins-color); }
    .badge.pending { background: var(--pico-secondary-background); }
    
    .log-viewer { 
      background: #1e1e1e; 
      padding: 1rem; 
      border-radius: 0.5rem; 
      max-height: 400px; 
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
    }
    .log-line { margin: 0.25rem 0; }
    .log-line.error { color: #f44336; }
    .log-line.warn { color: #ff9800; }
    .log-line.info { color: #4caf50; }
    
    pre { background: #1e1e1e; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
  </style>
</head>
<body>
  <nav class="container-fluid">
    <ul>
      <li><strong>🚀 Router Admin</strong></li>
    </ul>
    <ul>
      <li><a href="/admin/">Dashboard</a></li>
      <li><a href="/admin/jobs.html">Jobs</a></li>
      <li><a href="/admin/rules.html">Rules</a></li>
      <li><a href="/admin/policy.html">Policy</a></li>
      <li><a href="/admin/usage.html">Usage</a></li>
      <li><a href="/admin/learning.html">Learning</a></li>
    </ul>
  </nav>
  
  <!-- Page content goes here -->
  
  <script src="/admin/js/app.js"></script>
</body>
</html>
```

### `admin/public/index.html` (Dashboard)

```html
<!-- Include shared layout head/nav from above -->

<main class="container" x-data="dashboard">
  <h1>Dashboard</h1>
  
  <!-- Router Status -->
  <section>
    <h2>Router Status</h2>
    <div hx-get="/admin/api/status" 
         hx-trigger="load, every 30s"
         hx-swap="innerHTML">
      <article aria-busy="true">Loading...</article>
    </div>
  </section>
  
  <!-- Active Jobs -->
  <section x-data="{ activeJobs: [] }" x-init="fetchActiveJobs">
    <h2>Active Jobs</h2>
    <template x-if="activeJobs.length === 0">
      <p>No active jobs</p>
    </template>
    <template x-if="activeJobs.length > 0">
      <table>
        <thead>
          <tr><th>ID</th><th>Project</th><th>Status</th><th>Started</th></tr>
        </thead>
        <tbody>
          <template x-for="job in activeJobs" :key="job.id">
            <tr>
              <td><a :href="`/admin/job-detail.html?id=${job.id}`" x-text="job.id"></a></td>
              <td x-text="job.project_id"></td>
              <td><span class="badge running" x-text="job.status"></span></td>
              <td x-text="new Date(job.created_at).toLocaleString()"></td>
            </tr>
          </template>
        </tbody>
      </table>
    </template>
  </section>
  
  <!-- Recent Jobs -->
  <section>
    <h2>Recent Jobs</h2>
    <div hx-get="/admin/api/jobs?limit=10" 
         hx-trigger="load"
         hx-swap="innerHTML">
      <article aria-busy="true">Loading...</article>
    </div>
  </section>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('dashboard', () => ({
    activeJobs: [],
    
    async fetchActiveJobs() {
      const res = await fetch('/admin/api/jobs?status=running', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.activeJobs = data.jobs;
    }
  }));
});
</script>
```

### htmx partial response for `/admin/api/jobs`

In your backend, when htmx requests HTML (check `Accept: text/html`):

```js
router.get('/jobs', async (req, res) => {
  const jobs = await db.all('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?', req.query.limit || 10);
  
  if (req.headers.accept?.includes('text/html')) {
    // Return HTML partial for htmx
    const html = `
      <table>
        <thead>
          <tr><th>ID</th><th>Project</th><th>Status</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${jobs.map(job => `
            <tr>
              <td><a href="/admin/job-detail.html?id=${job.id}">${job.id}</a></td>
              <td>${job.project_id}</td>
              <td><span class="badge ${job.status}">${job.status}</span></td>
              <td>${new Date(job.created_at).toLocaleString()}</td>
              <td>
                <a href="${job.linear_issue_url}" target="_blank" role="button" class="secondary outline">Linear</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    return res.send(html);
  }
  
  // Return JSON for Alpine
  res.json({ jobs });
});
```

### `admin/public/jobs.html` (Jobs List)

```html
<!-- Include shared layout -->

<main class="container" x-data="jobsList">
  <h1>Jobs</h1>
  
  <!-- Filters -->
  <form @submit.prevent="loadJobs">
    <div class="grid">
      <input type="text" x-model="filters.project_id" placeholder="Project ID">
      <select x-model="filters.status">
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="running">Running</option>
        <option value="completed">Completed</option>
        <option value="failed">Failed</option>
      </select>
      <button type="submit">Filter</button>
    </div>
  </form>
  
  <!-- Jobs Table -->
  <div x-show="loading" aria-busy="true">Loading...</div>
  
  <table x-show="!loading">
    <thead>
      <tr>
        <th>ID</th>
        <th>Project</th>
        <th>Workflow</th>
        <th>Status</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      <template x-for="job in jobs" :key="job.id">
        <tr>
          <td><a :href="`/admin/job-detail.html?id=${job.id}`" x-text="job.id"></a></td>
          <td x-text="job.project_id"></td>
          <td x-text="job.workflow_id"></td>
          <td><span class="badge" :class="job.status" x-text="job.status"></span></td>
          <td x-text="new Date(job.created_at).toLocaleString()"></td>
          <td>
            <a :href="job.linear_issue_url" target="_blank" class="secondary">Linear</a>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
  
  <!-- Pagination -->
  <nav x-show="totalPages > 1">
    <ul>
      <li><button @click="prevPage" :disabled="page === 1">Previous</button></li>
      <li>Page <span x-text="page"></span> of <span x-text="totalPages"></span></li>
      <li><button @click="nextPage" :disabled="page === totalPages">Next</button></li>
    </ul>
  </nav>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('jobsList', () => ({
    jobs: [],
    filters: { project_id: '', status: '' },
    page: 1,
    perPage: 20,
    total: 0,
    loading: false,
    
    get totalPages() {
      return Math.ceil(this.total / this.perPage);
    },
    
    async loadJobs() {
      this.loading = true;
      const params = new URLSearchParams({
        ...this.filters,
        limit: this.perPage,
        offset: (this.page - 1) * this.perPage
      });
      
      const res = await fetch(`/admin/api/jobs?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      
      this.jobs = data.jobs;
      this.total = data.total;
      this.loading = false;
    },
    
    nextPage() {
      if (this.page < this.totalPages) {
        this.page++;
        this.loadJobs();
      }
    },
    
    prevPage() {
      if (this.page > 1) {
        this.page--;
        this.loadJobs();
      }
    },
    
    init() {
      this.loadJobs();
    }
  }));
});
</script>
```

### `admin/public/job-detail.html` (Job Detail)

```html
<!-- Include shared layout -->

<main class="container" x-data="jobDetail">
  <div x-show="loading" aria-busy="true">Loading...</div>
  
  <div x-show="!loading && job">
    <!-- Header -->
    <header>
      <h1>Job: <span x-text="job.id"></span></h1>
      <p>
        Project: <strong x-text="job.project_id"></strong> | 
        Workflow: <strong x-text="job.workflow_id"></strong> | 
        Status: <span class="badge" :class="job.status" x-text="job.status"></span>
      </p>
      <p>
        <a :href="job.linear_issue_url" target="_blank" role="button" class="secondary">View in Linear</a>
        <button x-show="job.status === 'failed'" @click="retryJob" class="outline">Retry</button>
        <button x-show="job.status === 'running'" @click="cancelJob" class="outline contrast">Cancel</button>
      </p>
    </header>
    
    <!-- Tabs -->
    <nav>
      <ul>
        <li><a href="#" @click.prevent="tab='plan'" :class="{ 'active': tab === 'plan' }">Plan</a></li>
        <li><a href="#" @click.prevent="tab='artifacts'" :class="{ 'active': tab === 'artifacts' }">Artifacts</a></li>
        <li><a href="#" @click.prevent="tab='logs'" :class="{ 'active': tab === 'logs' }">Logs</a></li>
        <li><a href="#" @click.prevent="tab='usage'" :class="{ 'active': tab === 'usage' }">Usage</a></li>
      </ul>
    </nav>
    
    <!-- Plan Tab -->
    <section x-show="tab === 'plan'">
      <h2>Workflow Steps</h2>
      <template x-for="step in steps" :key="step.id">
        <article>
          <h3 x-text="`${step.step_order}. ${step.skill_id}`"></h3>
          <p>Provider: <strong x-text="`${step.provider} / ${step.model}`"></strong></p>
          <p>Status: <span class="badge" :class="step.status" x-text="step.status"></span></p>
          <p>Tokens: <span x-text="step.prompt_tokens + step.completion_tokens"></span> | 
             Latency: <span x-text="step.latency_ms"></span>ms | 
             Cost: $<span x-text="step.cost_usd.toFixed(4)"></span></p>
        </article>
      </template>
    </section>
    
    <!-- Artifacts Tab -->
    <section x-show="tab === 'artifacts'">
      <h2>Artifacts</h2>
      <template x-if="artifacts.length === 0">
        <p>No artifacts</p>
      </template>
      <ul>
        <template x-for="artifact in artifacts" :key="artifact.id">
          <li>
            <a :href="`/admin/api/artifacts/${artifact.id}`" target="_blank" x-text="artifact.filename"></a>
            (<span x-text="artifact.type"></span>)
          </li>
        </template>
      </ul>
    </section>
    
    <!-- Logs Tab -->
    <section x-show="tab === 'logs'">
      <h2>Logs</h2>
      <div class="log-viewer" x-ref="logViewer">
        <template x-for="log in logs" :key="log.id">
          <div class="log-line" :class="log.level">
            <span x-text="new Date(log.created_at).toLocaleTimeString()"></span> 
            [<span x-text="log.level.toUpperCase()"></span>] 
            <span x-text="log.message"></span>
          </div>
        </template>
      </div>
    </section>
    
    <!-- Usage Tab -->
    <section x-show="tab === 'usage'">
      <h2>Token & Cost Breakdown</h2>
      <table>
        <thead>
          <tr><th>Provider</th><th>Model</th><th>Tokens</th><th>Cost</th></tr>
        </thead>
        <tbody>
          <template x-for="step in steps" :key="step.id">
            <tr>
              <td x-text="step.provider"></td>
              <td x-text="step.model"></td>
              <td x-text="step.prompt_tokens + step.completion_tokens"></td>
              <td>$<span x-text="step.cost_usd.toFixed(4)"></span></td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2"><strong>Total</strong></td>
            <td><strong x-text="totalTokens"></strong></td>
            <td><strong>$<span x-text="totalCost.toFixed(4)"></span></strong></td>
          </tr>
        </tfoot>
      </table>
    </section>
  </div>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('jobDetail', () => ({
    job: null,
    steps: [],
    artifacts: [],
    logs: [],
    tab: 'plan',
    loading: true,
    
    get totalTokens() {
      return this.steps.reduce((sum, s) => sum + s.prompt_tokens + s.completion_tokens, 0);
    },
    
    get totalCost() {
      return this.steps.reduce((sum, s) => sum + s.cost_usd, 0);
    },
    
    async loadJob() {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('id');
      
      const res = await fetch(`/admin/api/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      
      this.job = data.job;
      this.steps = data.steps;
      this.artifacts = data.artifacts;
      this.loading = false;
      
      // Load logs via SSE
      this.connectLogStream(jobId);
    },
    
    connectLogStream(jobId) {
      const es = new EventSource(`/admin/api/logs/tail?job_id=${jobId}`);
      es.onmessage = (e) => {
        const log = JSON.parse(e.data);
        this.logs.push(log);
        this.$nextTick(() => {
          if (this.$refs.logViewer) {
            this.$refs.logViewer.scrollTop = this.$refs.logViewer.scrollHeight;
          }
        });
      };
    },
    
    async retryJob() {
      await fetch(`/admin/api/jobs/${this.job.id}/retry`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      alert('Job queued for retry');
    },
    
    async cancelJob() {
      await fetch(`/admin/api/jobs/${this.job.id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      this.job.status = 'cancelled';
    },
    
    init() {
      this.loadJob();
    }
  }));
});
</script>
```

### `admin/public/rules.html` (Rules Viewer/Editor)

```html
<!-- Include shared layout -->

<main class="container" x-data="rulesEditor">
  <h1>Rules</h1>
  
  <div x-show="loading" aria-busy="true">Loading...</div>
  
  <div x-show="!loading">
    <!-- Global Rules -->
    <section>
      <h2>Global Rules</h2>
      <template x-for="rule in rules" :key="rule.id">
        <details>
          <summary>
            <strong x-text="rule.id"></strong> 
            (priority: <span x-text="rule.priority"></span>) - 
            <span x-text="rule.description"></span>
          </summary>
          <pre x-text="JSON.stringify(rule, null, 2)"></pre>
          <button @click="editRule(rule)" class="secondary">Edit</button>
          <button @click="testRule(rule)" class="outline">Test in Policy Inspector</button>
        </details>
      </template>
    </section>
    
    <!-- Edit Modal -->
    <dialog :open="editingRule !== null">
      <article>
        <h3>Edit Rule</h3>
        <textarea x-model="editedRuleJson" rows="20" style="font-family: monospace;"></textarea>
        <footer>
          <button @click="saveRule" class="primary">Save</button>
          <button @click="editingRule = null; editedRuleJson = ''" class="secondary">Cancel</button>
        </footer>
      </article>
    </dialog>
  </div>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('rulesEditor', () => ({
    rules: [],
    editingRule: null,
    editedRuleJson: '',
    loading: true,
    
    async loadRules() {
      const res = await fetch('/admin/api/config/global', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.rules = data.rules.rules;
      this.loading = false;
    },
    
    editRule(rule) {
      this.editingRule = rule;
      this.editedRuleJson = JSON.stringify(rule, null, 2);
    },
    
    async saveRule() {
      try {
        const rule = JSON.parse(this.editedRuleJson);
        const res = await fetch('/admin/api/config/rules', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rule })
        });
        
        if (res.ok) {
          alert('Rule saved successfully');
          this.editingRule = null;
          this.editedRuleJson = '';
          this.loadRules();
        } else {
          alert('Failed to save rule');
        }
      } catch (e) {
        alert('Invalid JSON: ' + e.message);
      }
    },
    
    testRule(rule) {
      // Navigate to policy inspector with this rule's conditions pre-filled
      const when = rule.when;
      const params = new URLSearchParams({
        task_type: when.task_type?.[0] || '',
        path: when.path_prefix?.[0] || ''
      });
      window.location.href = `/admin/policy.html?${params}`;
    },
    
    init() {
      this.loadRules();
    }
  }));
});
</script>
```

### `admin/public/policy.html` (Policy Inspector)

```html
<!-- Include shared layout -->

<main class="container" x-data="policyInspector">
  <h1>Policy Inspector</h1>
  <p>Test what the router would do for a given scenario</p>
  
  <form @submit.prevent="inspect">
    <label>
      Project ID
      <input type="text" x-model="scenario.project_id" placeholder="my-node-service">
    </label>
    
    <label>
      Task Type
      <select x-model="scenario.task_type">
        <option value="">Select...</option>
        <option value="small_edit">Small Edit</option>
        <option value="file_analysis">File Analysis</option>
        <option value="project_planning">Project Planning</option>
        <option value="refactor_planning">Refactor Planning</option>
        <option value="slice_edit">Slice Edit</option>
      </select>
    </label>
    
    <label>
      File Path (optional)
      <input type="text" x-model="scenario.path" placeholder="src/auth/session.ts">
    </label>
    
    <button type="submit">Dry Run</button>
  </form>
  
  <div x-show="result">
    <h2>Result</h2>
    
    <article>
      <h3>Matched Rules</h3>
      <template x-if="result?.matched_rules?.length === 0">
        <p>No rules matched</p>
      </template>
      <ol>
        <template x-for="rule in result?.matched_rules" :key="rule.id">
          <li>
            <strong x-text="rule.id"></strong> 
            (priority <span x-text="rule.priority"></span>) - 
            <span x-text="rule.description"></span>
          </li>
        </template>
      </ol>
    </article>
    
    <article>
      <h3>Selected Workflow</h3>
      <p><strong x-text="result?.workflow_id || 'None'"></strong></p>
    </article>
    
    <article>
      <h3>Provider & Model</h3>
      <p>Provider: <strong x-text="result?.provider"></strong></p>
      <p>Model: <strong x-text="result?.model"></strong></p>
      <p>Estimated tokens: <strong x-text="result?.estimated_tokens"></strong></p>
      <p>Estimated cost: $<strong x-text="result?.estimated_cost_usd?.toFixed(4)"></strong></p>
    </article>
  </div>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('policyInspector', () => ({
    scenario: { project_id: '', task_type: '', path: '' },
    result: null,
    
    async inspect() {
      const params = new URLSearchParams(this.scenario);
      const res = await fetch(`/admin/api/policy/inspect?${params}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      this.result = await res.json();
    },
    
    init() {
      // Pre-fill from URL params if present
      const params = new URLSearchParams(window.location.search);
      if (params.get('task_type')) this.scenario.task_type = params.get('task_type');
      if (params.get('path')) this.scenario.path = params.get('path');
    }
  }));
});
</script>
```

### `admin/public/usage.html` (Usage & Cost)

```html
<!-- Include shared layout -->

<main class="container" x-data="usageCharts">
  <h1>Usage & Cost</h1>
  
  <!-- Period selector -->
  <label>
    Period
    <select x-model="period" @change="loadUsage">
      <option value="day">Today</option>
      <option value="week">Last 7 days</option>
      <option value="month">Last 30 days</option>
    </select>
  </label>
  
  <!-- Tokens Chart -->
  <section>
    <h2>Tokens by Provider</h2>
    <canvas id="tokensChart" width="400" height="200"></canvas>
  </section>
  
  <!-- Cost Chart -->
  <section>
    <h2>Cost by Provider</h2>
    <canvas id="costChart" width="400" height="200"></canvas>
  </section>
  
  <!-- Top Projects Table -->
  <section>
    <h2>Top Projects by Usage</h2>
    <table>
      <thead>
        <tr><th>Project</th><th>Provider</th><th>Tokens</th><th>Cost</th></tr>
      </thead>
      <tbody>
        <template x-for="row in costByProject" :key="`${row.project_id}-${row.provider}`">
          <tr>
            <td x-text="row.project_id"></td>
            <td x-text="row.provider"></td>
            <td x-text="row.total_tokens.toLocaleString()"></td>
            <td>$<span x-text="row.total_cost.toFixed(2)"></span></td>
          </tr>
        </template>
      </tbody>
    </table>
  </section>
</main>

<script src="/admin/js/charts.js"></script>
<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('usageCharts', () => ({
    period: 'week',
    usage: [],
    costByProject: [],
    tokensChart: null,
    costChart: null,
    
    async loadUsage() {
      const res = await fetch(`/admin/api/usage?period=${this.period}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.usage = data.usage;
      
      const res2 = await fetch('/admin/api/usage/cost', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data2 = await res2.json();
      this.costByProject = data2.usage;
      
      this.renderCharts();
    },
    
    renderCharts() {
      // Group by provider
      const byProvider = {};
      this.usage.forEach(row => {
        if (!byProvider[row.provider]) byProvider[row.provider] = { tokens: 0, cost: 0 };
        byProvider[row.provider].tokens += row.tokens;
        byProvider[row.provider].cost += row.cost;
      });
      
      const providers = Object.keys(byProvider);
      const tokens = providers.map(p => byProvider[p].tokens);
      const costs = providers.map(p => byProvider[p].cost);
      
      // Tokens chart
      if (this.tokensChart) this.tokensChart.destroy();
      this.tokensChart = new Chart(document.getElementById('tokensChart'), {
        type: 'bar',
        data: {
          labels: providers,
          datasets: [{
            label: 'Tokens',
            data: tokens,
            backgroundColor: ['#4caf50', '#2196f3', '#ff9800']
          }]
        }
      });
      
      // Cost chart
      if (this.costChart) this.costChart.destroy();
      this.costChart = new Chart(document.getElementById('costChart'), {
        type: 'pie',
        data: {
          labels: providers,
          datasets: [{
            data: costs,
            backgroundColor: ['#4caf50', '#2196f3', '#ff9800']
          }]
        }
      });
    },
    
    init() {
      this.loadUsage();
    }
  }));
});
</script>
```

### `admin/public/learning.html` (Learning Queue)

```html
<!-- Include shared layout -->

<main class="container" x-data="learningQueue">
  <h1>Learning Queue</h1>
  <p>Review and approve auto-learned rules</p>
  
  <div x-show="loading" aria-busy="true">Loading...</div>
  
  <template x-if="!loading && queue.length === 0">
    <p>No pending rules</p>
  </template>
  
  <template x-for="item in queue" :key="item.id">
    <article>
      <h3>Proposed Rule</h3>
      <p><strong>Condition:</strong> <code x-text="item.condition"></code></p>
      <p><strong>Action:</strong> <code x-text="item.action"></code></p>
      <p><strong>Observed:</strong> <span x-text="item.frequency"></span> times</p>
      <details>
        <summary>Full Rule JSON</summary>
        <pre x-text="item.rule_json"></pre>
      </details>
      <footer>
        <button @click="accept(item.id)" class="primary">Accept</button>
        <button @click="reject(item.id)" class="secondary outline">Reject</button>
      </footer>
    </article>
  </template>
</main>

<script>
document.addEventListener('alpine:init', () => {
  Alpine.data('learningQueue', () => ({
    queue: [],
    loading: true,
    
    async loadQueue() {
      const res = await fetch('/admin/api/learning/queue', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      const data = await res.json();
      this.queue = data.queue;
      this.loading = false;
    },
    
    async accept(id) {
      await fetch(`/admin/api/learning/accept/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      alert('Rule accepted and added to global config');
      this.loadQueue();
    },
    
    async reject(id) {
      await fetch(`/admin/api/learning/reject/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      this.loadQueue();
    },
    
    init() {
      this.loadQueue();
    }
  }));
});
</script>
```

***

## `admin/public/js/app.js` (Shared Alpine helpers)

```js
// Store admin token
if (!localStorage.getItem('admin_token')) {
  const token = prompt('Enter admin token:');
  if (token) localStorage.setItem('admin_token', token);
}

// Global Alpine utilities
document.addEventListener('alpine:init', () => {
  // You can add global Alpine stores or utilities here
  
  Alpine.store('auth', {
    token: localStorage.getItem('admin_token'),
    
    setToken(token) {
      this.token = token;
      localStorage.setItem('admin_token', token);
    },
    
    getHeaders() {
      return {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      };
    }
  });
});

// htmx configuration
document.body.addEventListener('htmx:configRequest', (e) => {
  e.detail.headers['Authorization'] = `Bearer ${localStorage.getItem('admin_token')}`;
});
```

***

## Deployment

### `Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# Create data directory for SQLite
RUN mkdir -p data

EXPOSE 8080

CMD ["node", "src/index.js"]
```

### `fly.toml`

```toml
app = "your-router"
primary_region = "den"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  timeout = "5s"
  path = "/health"

[[mounts]]
  source = "router_data"
  destination = "/app/data"
  initial_size = "1gb"

[env]
  NODE_ENV = "production"
```

### Deploy

```bash
# Set admin token secret
fly secrets set ADMIN_TOKEN=your-secure-token-here

# Deploy
fly deploy

# Open admin
open https://your-router.fly.dev/admin/
```

***

## Phase-by-phase rollout

### Week 1: Foundation

- Set up backend API routes: `/status`, `/jobs`, `/jobs/:id`.
- Create `index.html`, `jobs.html`, `job-detail.html`.
- Deploy to Fly and verify you can see jobs list.

### Week 2: Details & Logs

- Add SSE log streaming.
- Complete job-detail page with tabs.
- Add artifact download.

### Week 3: Config Management

- Build `rules.html` with view/edit.
- Build `policy.html` inspector.
- Test editing a rule and seeing it take effect.

### Week 4: Analytics

- Build `usage.html` with Chart.js.
- Add cost breakdown table.

### Week 5: Control & Learning

- Add retry/cancel job buttons.
- Build `learning.html` for auto-learned rules.
- Test full cycle: agent learns pattern → propose rule → you approve → rule active.

### Week 6: Polish

- Add loading states, error handling, toasts.
- Mobile responsive CSS tweaks.
- Rate limiting on API.
- Dark mode toggle (optional).

***

This gives you a **complete, production-ready Alpine + htmx admin UI** in ~6 weeks part-time, with fast load times (<1s even on Fly cold start), minimal maintenance overhead, and full control over your AI router.

---



