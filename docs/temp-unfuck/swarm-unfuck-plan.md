# Swarm Unfuck Plan — 4 Surgical Fixes

> Any LLM executing this should complete each fix, commit, push to `hee-haw`, and verify via `fly logs -a sluagh-swarm` before moving to the next. No manual steps. No backoff. Self-heal or die trying.

---

## Fix 1 — `OrchestratorHandler` (BLOCKER: all queue jobs dropped)

**Problem**: Every job in the queue is type `orchestration`. There is no handler registered for this type. The worker picks them up, logs `No handler for job type: orchestration`, and marks them `completed` — nothing runs.

**File to create**: `workers/worker-bees/src/handlers/OrchestratorHandler.ts`

**What it must do**:
1. Accept a job with type `orchestration`
2. Read `job.payload.steps` — an array of sub-job descriptors, each with `{ type, payload }`
3. Execute each step **sequentially** by calling the existing handler registry
4. Log each step's result with `[Orchestrator][step N/M] ✅ success` or `❌ failed: <reason>`
5. If any step fails: log it, mark the orchestration as failed with a `firstFailedStep` field, and **stop** — do not continue to later steps
6. If all steps succeed: return `{ success: true, data: { stepsCompleted: N, results: [...] } }`
7. If `job.payload.linearIssueId` is present: post a comment to Linear with the final result (success or failure) via `LinearHandler`'s `create_comment` action

**Register it in `agent.ts`** after the other handlers:
```ts
import { OrchestratorHandler } from './handlers/OrchestratorHandler';
registerHandler(new OrchestratorHandler(handlers));
```

Pass `handlers` registry as a constructor arg so it can dispatch to existing handlers without circular deps.

**Verification**: Seed a test orchestration job via `/jobs` endpoint with:
```json
{
  "type": "orchestration",
  "payload": {
    "title": "Test Orchestration",
    "steps": [
      { "type": "echo", "payload": { "message": "step 1" } },
      { "type": "echo", "payload": { "message": "step 2" } }
    ]
  }
}
```
Expect `fly logs` to show `[Orchestrator][step 1/2] ✅` then `[Orchestrator][step 2/2] ✅`.

---

## Fix 2 — Rate Limit Death Spiral (BLOCKER: system rate-limits itself into the ground)

**Invariant**: the system must NEVER hit rate limits under legitimate internal load. If it does, the whole system is broken — not the caller.

**Root cause A — health score death spiral in `router-do.ts` `checkRateLimit()`**:

```ts
// Current (broken)
const effectiveRefillRate = baseRefillRate * healthScore;
// When pendingJobs >= 100 → healthScore = 0.1 → refill = 0.1 tokens/sec
// → 429s → more errors → worse health score → never recovers
```

The health score multiplier on the refill rate is backwards. When the system is under load is exactly when the worker needs to poll freely. Rate limiting is for bad actors, not internal load.

**Fix A**: Remove `calculateHealthScore()` from the rate limit refill path. The score stays for metrics only.

**File**: `workers/crypt-core/src/router-do.ts`, function `checkRateLimit()`

```ts
// Remove this line:
const effectiveRefillRate = baseRefillRate * healthScore;

// Replace with:
const effectiveRefillRate = baseRefillRate; // health score is observability only, never load-shedding
```

---

**Root cause B — two poll requests per tick, same key, same bucket**

The worker makes `POST /v1/queue/poll` + `GET /v1/swarm/next` every 5s = 24 requests/minute from one key. Structural fix: merge into one endpoint.

**Add to `router-do.ts`**:

```ts
case '/v1/worker/poll':
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  return await this.handleWorkerPoll(request);
```

```ts
private async handleWorkerPoll(request: Request): Promise<Response> {
  const { workerId } = (await request.json()) as any;

  const queueJob = Object.values(this.storage.jobs)
    .filter(j => j.status === 'pending')
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0] ?? null;
  if (queueJob) { queueJob.status = 'processing'; queueJob.assignedTo = workerId; queueJob.startedAt = Date.now(); }

  const swarmTask = Object.values(this.storage.swarmTasks)
    .filter(t => t.status === 'pending')
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0] ?? null;
  if (swarmTask) { swarmTask.status = 'in_progress'; swarmTask.assignedTo = workerId; swarmTask.startedAt = Date.now(); }

  if (queueJob || swarmTask) await this.saveState();
  return new Response(JSON.stringify({ queueJob, swarmTask }), { headers: { 'Content-Type': 'application/json' } });
}
```

**Update `agent.ts`**: Replace `pollQueue()` + `pollSwarm()` with single `pollWorker()`:

```ts
async function pollWorker() {
  const response = await fetch(`${ROUTER_URL}/v1/worker/poll`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ workerId: WORKER_ID }),
  });
  if (!response.ok) {
    console.error(`[${WORKER_ID}] Worker poll ${response.status} | ${await response.text()}`);
    return;
  }
  const { queueJob, swarmTask } = await response.json() as any;
  if (queueJob) {
    console.log(`[${WORKER_ID}] 🍯 Queue job: ${queueJob.id} (${queueJob.type})`);
    await processJob(queueJob);
  }
  if (swarmTask) {
    console.log(`[${WORKER_ID}] 🏴‍☠️ Swarm task: ${swarmTask.id} (${swarmTask.type})`);
    await processJob({ id: swarmTask.id, type: swarmTask.type, payload: { ...swarmTask, isSwarm: true } });
  }
  if (!queueJob && !swarmTask) console.log(`[${WORKER_ID}] 💤 No work`);
}
```

Replace `setInterval(pollForJob, POLL_INTERVAL)` → `setInterval(pollWorker, POLL_INTERVAL)`. Delete `pollQueue()`, `pollSwarm()`, `pollForJob()`.

**Result**: 1 request/tick instead of 2–4. With Fix 3 stopping the ingestor flood, `pendingJobs` drops below 50, health score returns to 1.0, and the system never hits rate limits again.

**Verification**: `fly logs` must show zero `429` after redeploy. Empty queue shows `💤 No work`, not errors.

---

## Fix 3 — Loop Prevention (BLOCKER: ingestor re-queues same issue forever)

**Problem**: `LinearIngestor.pollLinear()` prevents re-processing by checking for a `🐝 Swarm Processing` comment. **But the comment is written to Linear API, which is rate-limited and sometimes fails silently.** If the comment POST fails (or the Linear API is down), the same issue gets re-queued every 10 seconds forever with no way to stop.

**Three-layer fix — all in `ingestor.ts`**:

### Layer 1: Local processed-ID cache
```ts
const processedIssueIds = new Set<string>();
```
Add the issue ID to this set **before** posting the comment. Skip it immediately on next poll if it's in the set. This is the fastest guard and works even if Linear is down.

### Layer 2: Verify comment POST succeeded before dispatching
```ts
const commentRes = await linear.createComment({ issueId: issue.id, body: '🐝 **Swarm Processing**...' });
if (!commentRes.success) {
  console.error(`[LinearIngestor] Could not lock issue ${issue.id} — skipping dispatch to avoid duplicate`);
  continue; // Do NOT dispatch if we can't write the lock
}
```

### Layer 3: Cap retries per issue
Track attempt counts per issue ID. If an issue has been attempted 3 times without dispatch succeeding, move it to `processedIssueIds` permanently and log:
```
[LinearIngestor] ❌ Issue <id> failed 3 dispatch attempts — permanently skipping
```

### Layer 4: Mark Linear issue `Done` on successful job completion
In `completeSwarmTask()` in `agent.ts`, if `job.payload.linearIssueId` is set, call:
```ts
await updateLinearIssueDone(job.payload.linearIssueId);
```
This changes the Linear state to `Done`, which filters it out of the `In Progress` query automatically. Implement `updateLinearIssueDone()` using the `LINEAR_API_KEY` env var and Linear GraphQL mutation `issueUpdate`.

**Verification**: After a job completes, `fly logs` must NOT show `[LinearIngestor] Picked up issue: <same title>` again. The Linear issue must show `Done` state.

---

## Fix 4 — PR Base Branch (MINOR: swarm PRs target wrong branch)

**File**: `workers/worker-bees/src/handlers/CodingHandler.ts`, line ~211

**Change**:
```ts
// Before
base: 'main'

// After
base: 'hee-haw'
```

`hee-haw` is the default branch for all repos. Any PR targeting `main` will be silently ignored or cause merge conflicts.

**Verification**: Trigger a coding task. The resulting PR must target `hee-haw`.

---

## Detailed Logging Requirements (apply across all fixes)

Every handler and every async operation must emit structured logs in this format:

```
[Component][operation] ✅/❌ <human-readable result> | jobId=<id> step=<N/M> elapsed=<ms>ms
```

Specifically:
- `OrchestratorHandler`: log before and after every sub-step with elapsed time
- `pollQueue` / `pollSwarm`: log the HTTP status received for every poll (not just errors)
- `LinearIngestor`: log issue ID + title + dispatch attempt count on every pick-up
- `completeSwarmTask`: log full success/failure payload (truncated to 500 chars)

**Do NOT use generic `console.error(error.message)` alone — always include context** (jobId, issueId, handler name, step number).

---

## Execution Order

1. Fix 3 (loop prevention) — most urgent, stops the ingestor flood that causes everything else
2. Fix 2 (rate limit death spiral) — remove health-score multiplier + merge poll endpoints
3. Fix 1 (orchestration handler) — now that queue isn't flooding, real jobs can run
4. Fix 4 (PR base branch) — quick 1-liner, do it with fix 1

Commit all fixes together in one PR: `feat: swarm orchestration + loop prevention + rate limit fix`.
