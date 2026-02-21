# Sluagh Swarm — Autonomy Progress Log

> **Last Updated**: 2026-02-21  
> **Goal**: Get the swarm to autonomously pick up a Linear issue and execute it end-to-end without human intervention.

---

## Original Failure Map (from swarm-unfuck plans)

| # | Symptom | Root Cause | Resolution |
|---|---------|-----------|------------|
| F1 | `RouterDO` 503 on every poll | `checkConfig()` required GitHub keys that weren't seeded | ✅ Fixed |
| F2 | Worker gets 401 on poll | `PROXY_API_KEY` not propagated correctly; wrong env var name used | ✅ Fixed |
| F3 | Infinite orchestration loop | `syncLinearTasks` re-queued same issue after `cleanupOldRecords` wiped completed jobs | ✅ Fixed |
| F4 | `LinearIngestor` dispatch 401 | Wrong env var (`WORKER_API_KEY`) instead of `PROXY_API_KEY` in ingestor/auth/index | ✅ Fixed |
| F5 | `orchestration` jobs crash silently | Missing GitHub creds at runtime → job failed → re-queued infinitely | ✅ Fixed |
| F6 | `run_command` never executed E2E | All upstream blockers prevented job from ever reaching a worker | 🔄 Unverified |

---

## Completed Fixes

### ✅ Fix: PROXY_API_KEY propagation (`worker-bees`)

**Files changed**:
- `workers/worker-bees/src/auth.ts` — `getApiKey()` now reads `process.env.PROXY_API_KEY` (was `WORKER_API_KEY`)
- `workers/worker-bees/src/index.ts` — `/execute` auth check now reads `process.env.PROXY_API_KEY`
- `workers/worker-bees/src/ingestor.ts` — local variable renamed from `WORKER_API_KEY` to `PROXY_API_KEY` for clarity (was already reading from `PROXY_API_KEY` env var, just misleadingly named)
- `workers/worker-bees/src/config/index.ts` — debug log added: `[Config] PROXY_API_KEY loaded: ✅ from env / ❌ using fallback dev-key`

### ✅ Fix: checkConfig() no longer blocks on missing GitHub keys (`router-do.ts`)

`checkConfig()` required list trimmed to only the keys actually needed to serve poll requests:
```
PROXY_API_KEY, LINEAR_API_KEY, LINEAR_WEBHOOK_SECRET, LINEAR_TEAM_ID, GEMINI_API_KEY
```
GitHub keys (`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`) are now validated lazily at runtime inside `processOrchestrationJob()` only when branch creation is actually needed.

### ✅ Fix: Rate limit death spiral removed (`router-do.ts`)

`checkRateLimit()` no longer multiplies refill rate by `healthScore`. The health score is computed for observability metrics only and never throttles internal worker load. Workers can poll freely regardless of queue depth.

### ✅ Fix: Poll endpoint merged — single `POST /v1/worker/poll` (`router-do.ts` + `agent.ts`)

`agent.ts` now uses a single `pollWorker()` function hitting `POST /v1/worker/poll`. The old `pollQueue()` + `pollSwarm()` dual-call pattern (2–4 requests/tick) is gone. `handleWorkerPoll()` on the router atomically returns both a `queueJob` and a `swarmTask` in one response.

### ✅ Fix: LinearIngestor loop prevention — 3-layer guard (`ingestor.ts`)

1. **Layer 1**: In-memory `processedIssueIds` Set — issue IDs added *before* comment posting so re-poll skips immediately even if Linear is down
2. **Layer 2**: Comment lock verification — dispatch only proceeds if `createComment()` returns `success: true`; rollback lock on failure
3. **Layer 3**: Per-issue attempt cap — after 3 failed dispatch attempts, issue permanently added to `processedIssueIds` with an error log

### ✅ Fix: `ingestedIssueIds` persistent storage (`router-do.ts`)

`RouterDO.storage` now includes `ingestedIssueIds: string[]`, persisted in `router_meta`. `syncLinearTasks()` checks this before queuing a new job, so issues whose jobs were cleaned up by `cleanupOldRecords()` can never be re-queued in a future alarm cycle.

### ✅ Fix: `sluagh:ready` → `sluagh:active` label swap on ingest (`router-do.ts`)

After queuing a job, `syncLinearTasks()` swaps the issue label from `sluagh:ready` to `sluagh:active`. This prevents the issue from appearing in future `listIssuesByLabel('sluagh:ready')` queries even if the persistent cache is ever wiped.

### ✅ Fix: `[run_command]` issues routed as `runner_task` not `orchestration` (`router-do.ts`)

`syncLinearTasks()` now inspects the issue title. Issues tagged `[run_command]` are queued as `runner_task` type with the command parsed from the JSON description block. All other issues remain `orchestration` type.

### ✅ Fix: GitHub null-guard in `processOrchestrationJob` (`router-do.ts`)

`GitHubClient` is only instantiated when all three creds (`GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_INSTALLATION_ID`) are present. Without creds, orchestration jobs continue through planning/LLM steps and log a warning rather than crashing.

### ✅ Fix: `OrchestratorHandler` created and registered (`worker-bees`)

`workers/worker-bees/src/handlers/OrchestratorHandler.ts` created. Handles `orchestration` job type by running `steps[]` sequentially via the handler registry. Posts Linear comments on step success/failure. Registered in `agent.ts` as `registerHandler(new OrchestratorHandler(handlers))`.

### ✅ Fix: PR base branch corrected (`CodingHandler.ts`)

`createPullRequest()` now targets `base: 'hee-haw'` — the default branch for all repos in this project.

### ✅ Fix: `updateLinearIssueDone` on queue job completion (`router-do.ts`)

`handleQueueComplete()` now calls `linear.getStateIdByName('Done')` + `updateIssue({ stateId })` when a `run_command` or `runner_task` job completes successfully and has a `linearIssueId`. Orchestration jobs are excluded — they close through `completeAndMergeTask()` after the PR review chain.

Also added `'run_command'` to the `Job.type` union in `types.ts` to match the type string used by `agent.ts` when dispatching ingestor jobs.

---

## Current System Flow (End-to-End)

```
Linear Issue (sluagh:ready label + In Progress state)
       ↓
LinearIngestor [pollLinear @ 10s]
  → Picks up issue, adds processedIssueIds lock
  → Creates "🐝 Swarm Processing" comment
  → POST /v1/queue/add → RouterDO
       ↓
RouterDO [syncLinearTasks @ every alarm]
  → Checks ingestedIssueIds + existing jobs
  → Routes: [run_command] → runner_task | otherwise → orchestration
  → Swaps label: sluagh:ready → sluagh:active
  → Saves job to Durable Object storage
       ↓
Worker Bee [pollWorker @ 5s → POST /v1/worker/poll]
  → RouterDO returns highest-priority pending job
  → Worker executes via registered handler
  → POST /v1/queue/complete → RouterDO
       ↓
RouterDO [handleQueueComplete]
  → Posts result comment to Linear
  → run_command/runner_task: marks issue Done ✅
  → orchestration: hands off to swarmTask → coding → verify → review → merge
```

---

## What Still Needs Verification

| Step | How to Verify |
|------|--------------|
| Router 200 on poll | `curl -X POST http://localhost:8787/v1/worker/poll -H "Authorization: Bearer $PROXY_API_KEY" -H "Content-Type: application/json" -d '{"workerId":"debug"}'` |
| E2E `run_command` job | Seed a `[SWARM] [run_command] echo hello` issue → watch worker logs for `✅ Job completed` → confirm Linear issue moves to Done |
| Orchestration with GitHub creds | Seed real GitHub App secrets → queue orchestration issue → confirm branch + plan created |

---

## What's Not Yet Done

- **Real GitHub App credentials** not seeded to Cloud Vault — orchestration jobs skip branch creation
- **E2E smoke test** for `run_command` → worker pick-up → Linear Done not yet run against live environment
- **Flood protection** (`processBatch` emergency brake for >20 pending orchestration jobs) — deprioritized since F3A/F3B prevent floods
