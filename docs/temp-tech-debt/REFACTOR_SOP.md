# Bifrost Tech Debt — Thin-Sliced Execution Plan

> **Audience**: Any LLM or engineer executing this cold.  
> **Rule**: One slice = one commit. Build passes after every slice. No skipping.  
> **Source doc**: `big-debt.md` in this directory.

---

## Priority Order (Perplexity-confirmed)

Refactor from the bottom up — shared foundations before anything that depends on them:

| Priority | Layer | Why first |
|----------|-------|-----------|
| 1 | **Shared infra / config** | Everything else imports from here; fixing it unblocks all downstream slices |
| 2 | **Webhook handlers** | Narrow scope, entry-point only, easy to isolate and test |
| 3 | **State management** | Core DO persistence — must be solid before orchestration is touched |
| 4 | **Job orchestration** | Builds on state; complex workflows can only be split cleanly once state is isolated |
| 5 | **Swarm task lifecycle** | Depends on both job orchestration and state; Linear/GitHub integration goes here |
| 6 | **LLM routing** | Most dynamic, depends on everything above; isolate last |

---

## Slice 1 — Config centralization (`worker-bees`)

**Goal**: zero `process.env` reads outside `config/index.ts` in worker-bees.

**Files to create/modify**:
- `workers/worker-bees/src/config/index.ts` — already has `ROUTER_URL` and `PROXY_API_KEY`; extend to cover all env vars used across the worker

**Steps**:
1. Open `workers/worker-bees/src/config/index.ts`
2. Add every `process.env.*` that currently appears in `auth.ts`, `index.ts`, `ingestor.ts`, `agent.ts`, `network.ts`
3. Export a single typed `config` object — no runtime logic, just reads + fallbacks
4. In each of those files, replace `process.env.X` with `import { config } from '../config'; config.X`
5. Run `npm run build` in `workers/worker-bees` — must pass clean

**Verify**: `grep -r "process\.env\." workers/worker-bees/src --include="*.ts" | grep -v config/index` → zero results

---

## Slice 2 — Config centralization (`crypt-core`)

**Goal**: zero inline `process.env` reads in `router-do.ts` outside a router config module.

**Files to create**:
- `workers/crypt-core/src/router/config.ts` — exports `buildRouterConfig(env: Env)` returning typed object
- `workers/crypt-core/src/router/dependencies.ts` — exports `buildDependencies(config)` that constructs `LLMRouter`, `LinearClient`, `GitHubClient`, `FlyClient`, `EventStoreClient`, `RateLimitService`

**Steps**:
1. Create `router/config.ts` — one field per env var with types
2. Create `router/dependencies.ts` — move all `new XClient(...)` calls from the `RouterDO` constructor here
3. In `RouterDO` constructor: replace inline client construction with `const config = buildRouterConfig(env); const deps = buildDependencies(config);`
4. Run `npx tsc --noEmit` — must pass clean

---

## Slice 3 — Extract `RouterStateManager` (`crypt-core`)

**Goal**: all Durable Object `storage.put/get/delete` calls live in one file.

**File to create**: `workers/crypt-core/src/router/state-manager.ts`

**Methods to move from `router-do.ts`**:
- `initialize()` / `loadState()` — all `state.storage.get(...)` calls
- `saveState()` — all `state.storage.put(...)` calls
- `cleanupOldRecords()` — delete stale jobs/tasks from storage

**Steps**:
1. Create `state-manager.ts` with a `RouterStateManager` class that takes `state: DurableObjectState` and `storage: RouterState`
2. Cut `loadState`, `saveState`, `cleanupOldRecords` out of `router-do.ts` and paste into the class
3. In `RouterDO`, replace direct calls with `this.stateManager.saveState()` etc.
4. Run `npx tsc --noEmit` — must pass clean

---

## Slice 4 — Extract `MaintenanceService` (`crypt-core`)

**Goal**: `alarm()` delegates to one function; maintenance logic is out of the main DO file.

**File to create**: `workers/crypt-core/src/router/maintenance-service.ts`

**Methods to move**:
- `triggerMaintenance()`
- `maybeTriggerOptimization()`
- The `alarm()` body (Linear sync + processBatch + saveState)

**Steps**:
1. Create `MaintenanceService` class accepting `stateManager`, `swarmSyncService`, `jobService` as deps
2. Expose a single `runMaintenance()` method
3. In `RouterDO.alarm()`: `await this.maintenanceService.runMaintenance();`
4. Run `npx tsc --noEmit`

---

## Slice 5 — Extract `JobService` (`crypt-core`)

**Goal**: all `/v1/queue/*` and `/v1/worker/poll` logic lives outside `router-do.ts`.

**File to create**: `workers/crypt-core/src/router/job-service.ts`

**Methods to move**:
- `handleQueueAdd(request)`
- `handleQueuePoll(request)`
- `handleQueueComplete(request)`
- `handleWorkerPoll(request)`
- `processBatch(batchSize?)`
- `processOrchestrationJob(job)`
- `executeRunnerTask(job)`

**Steps**:
1. Create `JobService` class with deps injected: `stateManager`, `linearClient`, `githubClient`, `flyClient`, `events`, `llmRouter`
2. Move methods into class; update `this.storage` references to `this.stateManager.storage`
3. In `RouterDO.fetch()`, replace inline calls with `await this.jobService.handleQueueAdd(request)` etc.
4. Run `npx tsc --noEmit`

---

## Slice 6 — Extract `SwarmService` + `SwarmSyncService` (`crypt-core`)

**Goal**: swarm task lifecycle and Linear sync are out of the main DO.

**Files to create**:
- `workers/crypt-core/src/router/swarm-service.ts` — handles `/v1/swarm/*` routes, task create/update/complete, `completeAndMergeTask`
- `workers/crypt-core/src/router/swarm-sync-service.ts` — `syncLinearTasks()` and `seedTestIssues()`

**Steps**:
1. Create `SwarmService` with state + Linear + GitHub deps; move swarm CRUD methods
2. Create `SwarmSyncService` with Linear + state deps; move `syncLinearTasks`, `seedTestIssues`
3. Wire `MaintenanceService` to call `swarmSyncService.syncLinearTasks()`
4. In `RouterDO.fetch()` replace swarm route handlers with service delegates
5. Run `npx tsc --noEmit`

---

## Slice 7 — Extract webhook handlers (`crypt-core`)

**Goal**: signature verification + payload parsing live in dedicated files, not the main DO.

**Files to create**:
- `workers/crypt-core/src/router/webhooks/linear-webhook-handler.ts` — `verifyLinearSignature`, parse body, call `JobService` / `SwarmService`
- `workers/crypt-core/src/router/webhooks/github-webhook-handler.ts` — `verifyGitHubSignature`, parse body, call `SwarmService`

**Steps**:
1. Cut `handleWebhook` and `handleGitHubWebhook` from `router-do.ts` into respective files
2. Update imports in `RouterDO.fetch()` to call `new LinearWebhookHandler(...).handle(request)`
3. Run `npx tsc --noEmit`

---

## Slice 8 — Extract `LLMService` + `RateLimitService` (`crypt-core`)

**Goal**: all LLM routing and rate limit token math is isolated.

**Files to create**:
- `workers/crypt-core/src/router/rate-limit-service.ts` — token bucket logic only; no HTTP knowledge
- `workers/crypt-core/src/router/llm-service.ts` — `routeLLM()`, `handleV2Chat()`, prompt optimization loading

**Steps**:
1. Create `RateLimitService` — extract `checkRateLimit` math from `router-do.ts`
2. Create `LLMService` — extract `routeLLM`, `handleV2Chat`, `handleLLMChat`, event-based prompt optimization
3. Update `RouterDO.fetch()` to delegate `/v2/chat` and `/v1/llm/chat` to `LLMService`
4. Update `RouterDO` to call `this.rateLimitService.check(authKey)` instead of inline
5. Run `npx tsc --noEmit`

---

## Slice 9 — Decompose `agent.ts` (`worker-bees`)

**Goal**: agent.ts is split into 4 focused modules, each under 300 lines.

**Files to create**:
- `workers/worker-bees/src/core/job-registry.ts` — `Job`, `JobResult`, `JobHandler`, `registerHandler`, `handlers` map
- `workers/worker-bees/src/core/job-executor.ts` — `processJob`, `completeJob`, `completeSwarmTask`, `updateSwarmStatus`
- `workers/worker-bees/src/core/agent-loop.ts` — `createPollLoop({ routerClient, registry, intervalMs })`
- `workers/worker-bees/src/core/router-client.ts` — `RouterClient` interface + HTTP implementation using `NetworkDriver`

**Steps**:
1. Create `job-registry.ts` — type defs + registry map (no handler imports)
2. Create `job-executor.ts` — move `processJob` and completion helpers; deps injected as arguments
3. Create `router-client.ts` — move all `fetch('/v1/worker/poll')`, `fetch('/v1/queue/complete')` calls behind an interface, using `NetworkDriver`
4. Create `agent-loop.ts` — `startAgent` becomes `createPollLoop(...).start()`
5. Update `agent.ts` to just call `createPollLoop` — should shrink to ~50 lines
6. Run `npm run build` in `workers/worker-bees`

---

## Slice 10 — Split LinearIngestor (`worker-bees`)

**Goal**: `ingestor.ts` is split into parser + locker + loop; dispatch goes through `RouterClient`.

**Files to create**:
- `workers/worker-bees/src/linear/job-parser.ts` — converts issue (title + description) → `{ jobType, payload }`
- `workers/worker-bees/src/linear/locker.ts` — `processedIssueIds`, `issueAttemptCounts`, comment-based lock logic
- `workers/worker-bees/src/linear/ingestor-loop.ts` — `startLinearIngestor(config, { linearClient, routerClient })` containing only the loop

**Steps**:
1. Create `job-parser.ts` — move title-tag detection and JSON extraction from `ingestor.ts`
2. Create `locker.ts` — move the Set, attempt counter, and rollback logic
3. Create `ingestor-loop.ts` — move `pollLinear` and the main loop; inject deps
4. Replace `ingestor.ts` with a thin re-export that wires deps and calls `startLinearIngestor`
5. Replace `fetch('/v1/queue/add')` with `routerClient.enqueueJob(jobType, payload)`
6. Run `npm run build` in `workers/worker-bees`

---

## Slice 11 — Handler grouping + `HandlerFactory` (`worker-bees`)

**Goal**: handlers organized by domain; no handler registration in `agent.ts`.

**Folder moves**:
- `src/handlers/system/` → `RunCommandHandler.ts`, `FetchUrlHandler.ts`
- `src/handlers/llm/` → `CodingHandler.ts`, `ReviewHandler.ts`, `OrchestratorHandler.ts`, `VerifyHandler.ts`
- `src/handlers/linear/` → `LinearHandler.ts`
- `src/handlers/factory.ts` → `createDefaultHandlers(deps)` that registers all of the above

**Steps**:
1. Create folder structure, move files (update import paths)
2. Create `factory.ts` with `createDefaultHandlers(deps)` that calls `registerHandler` for each
3. In runtime entrypoint: call `createDefaultHandlers(deps)` instead of inline handler registration
4. Run `npm run build`

---

## Slice 12 — Worker manifests + Health endpoints

**Goal**: every worker has a manifest and returns `{ status, timestamp, version, role }` on `/health`.

**Files to create/modify**:
- `workers/worker-bees/src/worker-manifest.ts`
- `workers/crypt-core/src/worker-manifest.ts`
- Health route in each worker's entrypoint reading from its manifest

**Steps**:
1. Create `worker-manifest.ts` per worker — `id`, `role`, `capabilities[]`, `version`
2. Ensure `/health` (or health check equivalent) returns `{ status: 'ok', timestamp, version, role }` from manifest
3. Build + verify

---

## Done State

After all 12 slices:
- `router-do.ts` is 400–600 lines (thin facade + constructor wiring)
- `agent.ts` is ~50 lines (creates poll loop, done)
- `ingestor.ts` is ~30 lines (wires deps, starts loop)
- Zero `process.env` reads outside `config/` modules
- Every worker has a `/health` route and a manifest
- `npx tsc --noEmit` and `npm run build` both pass clean across all workers

---

## Worker Health Inventory

Maintain this table; update after each slice shipped:

| Worker | Role | Health Score | Notes |
|--------|------|:---:|-------|
| `crypt-core` | RouterDO / orchestrator | 0 | Monolithic, 2200 lines |
| `worker-bees` | Agent executor / ingestor | 0 | Mixed concerns in agent.ts + ingestor.ts |

> **Health scores**: 0 = legacy | 1 = config extracted or slim entrypoint | 2 = config + slim entry + shared network | 3 = fully aligned with shared libs + manifest
