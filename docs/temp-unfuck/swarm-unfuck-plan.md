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

## Fix 2 — Rate Limit 429s (BLOCKER: worker chokes itself every other poll)

**Problem**: The worker polls `/v1/queue/poll` AND `/v1/swarm/next` every 5 seconds using the same `PROXY_API_KEY`. That's 24 requests/minute from a single key hitting a token bucket that refills at 1 token/sec. The bucket gets saturated and 429s half the calls.

**Root cause in `router-do.ts`**: `checkRateLimit(authKey)` uses the raw `Authorization` header as the bucket key. The worker bee is a trusted internal caller, not a random user.

**Fix in `workers/crypt-core/src/router-do.ts` `fetch()` method**:

Whitelist the internal worker key from rate limiting:

```ts
// After checkConfig(), before checkRateLimit()
const isInternalWorker = authKey === `Bearer ${this.env.PROXY_API_KEY}`;
if (!isInternalWorker && !this.checkRateLimit(authKey)) {
  await this.saveState();
  return new Response('Too Many Requests', { status: 429 });
}
```

This skips rate limiting entirely for the trusted worker bee. External callers still get rate-limited.

**Also update `agent.ts`**: The worker currently polls both `/v1/queue/poll` and `/v1/swarm/next` in the **same 5s tick**, touching the router 4 times per tick (two polls + completing the previous job). Space them apart and **do not poll swarm if queue job was found and is executing**:

In `pollForJob()`:
```ts
async function pollForJob() {
  try {
    const foundQueueJob = await pollQueue();
    if (!foundQueueJob) {
      // Only poll swarm if queue is empty — avoid double-hammering
      await pollSwarm();
    }
  } catch (error: any) {
    // Log cause code for diagnosis, but do not stop the loop
    console.error(`[${WORKER_ID}] Poll error [${error.cause?.code || 'UNKNOWN'}]:`, error.message);
  }
}
```

Make `pollQueue()` and `pollSwarm()` return `boolean` (true = job found and executing).

**Verification**: `fly logs` should show zero `429` errors after redeploy.

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

1. Fix 3 (loop prevention) — most urgent, it's flooding everything right now
2. Fix 2 (rate limit whitelist) — second, because 429s block fix verification
3. Fix 1 (orchestration handler) — now that queue isn't flooding
4. Fix 4 (PR base branch) — quick 1-liner, do it with fix 1

Commit all fixes together in one PR: `feat: swarm orchestration + loop prevention + rate limit fix`.
