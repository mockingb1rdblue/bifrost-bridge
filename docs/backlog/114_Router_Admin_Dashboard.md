# Router Admin Dashboard

**Status**: Planned  
**Source**: Ingested from Custom Router Agent Plan  
**Goal**: A lightweight, real-time command center for the AI Router.

---

## 1. Scope & Philosophy

- **Mission Control**: Visualize all active and queued jobs.
- **Steerable**: Manually override routing policies per project/task.
- **Transparent**: See exactly *why* a decision was made (Rule X fired, triggering Provider Y).

**Tech Stack**:
- **Backend**: Served from the FastAPI router (`/admin`).
- **Frontend**: Vanilla JS + **htmx** + **Alpine.js**. Ultra-light (<50KB), no build step, fast load on cold start.
- **Auth**: Simple Admin Token (Authorization Header).

---

## 2. Features

### Dashboard (Home)
- **Active Jobs**: Real-time status of running agents.
    - Example: "Refactoring `auth-module` (Step 2/5) - DeepSeek V3"
- **Recent Jobs**: Last 24h history with success/fail indicators.
- **Usage**:
    - Tokens consumed (Bar chart).
    - Estimated cost (Pie chart).

### Job Detail
- **Timeline**: Visual step-by-step of the workflow (Plan -> Slice -> Edit -> Test).
- **Artifacts**: Download diffs, IR JSONs, or execution logs.
- **Live Logs**: SSE stream of the router's internal decision process.
    - "Evaluating Rule #4..."
    - "Routing to Gemini Flash due to context size > 32k..."

### Policy Inspector & Editor
- **Rules Editor**: View valid global rules (JSON). Edit inline to tweak thresholds.
- **Dry Run Tester**:
    - Input: "Refactor this file..."
    - Output: "Would route to DeepSeek R1 (Reasoning Heavy)."
- **Approvals Queue**: View pending "Learned Rules" proposed by the system.
    - "Accept": Promote to production.
    - "Reject": Discard.

### Background Agent Controls
- **Queue Status**: See pending background tasks.
- **Manual Pause**: "Stop All Background Work" (Panic button).
- **Budget Alerts**: Visual warning when approaching daily $ caps.

---

## 3. Implementation Phasing

### Phase 1: Core Infra (Week 1)
- `/admin/api/status` endpoint.
- Basic HTML skeleton served at `/admin`.
- Job Listing table (htmx dynamic load).

### Phase 2: Visibility (Week 2)
- Job Detail view.
- Log streaming (SSE).

### Phase 3: Control (Week 3)
- Policy Editor.
- Dry Run Inspector.

### Phase 4: Polish (Week 4)
- Dark Mode.
- Mobile responsive layout.
