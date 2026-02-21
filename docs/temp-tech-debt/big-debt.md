Here’s a concrete refactor plan focused on speed, robustness, and keeping files small without losing your “systems anarchy” affordances.

## 1. Clarify runtime boundaries

You’ve got three distinct roles interleaved: the Worker Bee runner (HTTP server), the poller/agent, and the external integration clients (Linear, Perplexity, Fly). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)

Plan:

- Create a **“runtimes” layer**: `runner-http/`, `worker-agent/`, `linear-ingestor/`, `sprite-control-plane/`. Each gets a tiny `index.ts` that only wires routes, loads config, and calls into services.
- Move any logic in `index.ts` that is not “parse request + call service” into dedicated service modules (e.g., `RunnerService`, `AgentLoop`, `CommandExecutor`). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)

Outcome: each entrypoint file is ~100–150 lines and purely orchestration, which makes CF deployment and debugging faster and less tangled.

## 2. Decompose the agent into domains

`agent.ts` is doing registry wiring, job execution, swarm semantics, and router I/O in one place. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)

Plan:

- Split into **four modules**:
  - `job-registry.ts`: defines `Job`, `JobResult`, `JobHandler`, and the `registerHandler` / `handlers` map.
  - `job-execution.ts`: `processJob`, `completeJob`, `completeSwarmTask`, `updateSwarmStatus`. No imports of concrete handlers.
  - `agent-loop.ts`: `pollWorker` and `startAgent`, parameterized by `routerUrl`, `apiKey`, `workerId`, `pollInterval`, and a `fetchFn` for testability.
  - `default-handlers.ts`: where you instantiate and register `EchoJobHandler`, `SwarmTaskHandler`, `RunCommandHandler`, etc. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)

Then your runtime entrypoint does: build config → create registry → register default handlers → start loop. This keeps every file under ~300 lines and decouples test boundaries.

## 3. Centralize network robustness

You already have a **NetworkDriver** with backoff, kill-switch, and diagnostics. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)

Plan:

- Treat `NetworkDriver` as the **single way the worker talks to the router and external HTTP** from the agent side.
- Replace raw `fetch` in `agent.ts` (`/v1/worker/poll`, `/v1/queue/complete`, `/v1/swarm/update`) with thin adapter functions that call `NetworkDriver.robustFetch`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
- Move all “banner” logging and failure messaging to `NetworkDriver` and keep agent code focused on semantics (job states, swarm statuses).

Outcome: backoff/kill behavior is consistent and measurable, and you only have one place to tune failure policies or timeouts.

## 4. Harden and slim the Linear ingestion path

`ingestor.ts` is already layered, but it mixes concerns (Linear API use, debouncing, dispatch to router) in one file. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

Plan:

- Split into:
  - `linear-ingestor.ts`: the loop (`startLinearIngestor`, `pollLinear`), with injected dependencies.
  - `linear-dispatch-policy.ts`: the “three layers” logic (local sets, attempt counters, comments, dispatch try/rollback). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
  - `linear-job-parser.ts`: converts an issue (title + description) into `{ jobType, payload }`, including JSON extraction and fallback echo behavior. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
- Push all router calls (`/v1/queue/add`) through a `RouterClient` that uses `NetworkDriver` (same as agent). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
- Add explicit **timeouts and metrics**: measure elapsed time already; standardize logging shape so you can later feed it to a telemetry worker.

This reduces the ingestor file size and makes it easier to test job classification separately from CF/network behavior.

## 5. Extract shared “service clients” for external systems

You already have nice **LinearClient**, **PerplexityClient**, and **FlyClient**, but they live in the same repo as worker code. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts)

Plan:

- Consolidate all external clients under `clients/`:
  - `clients/linear/LinearClient.ts` (your existing one for API/GraphQL). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts)
  - `clients/perplexity/PerplexityClient.ts`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/726144bf-e753-4661-825c-57fa98bf6100/perplexity-client.ts)
  - `clients/fly/FlyClient.ts`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/44881b67-f9d2-4f2b-8129-b65f7ca359c1/fly-client.ts)
- For worker-facing code (handlers, ingestor, sprite manager), depend only on interfaces (e.g., `LinearProjectsPort`, `RouterQueuePort`) that the concrete clients implement.
- Move all **circuit breakers and lockfile logic** into these client modules so your worker code only handles “I got an error: LinearAuthenticationError” not the file I/O. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts)

This improves robustness by containing auth-protection behavior, and keeps worker modules smaller and more focused.

## 6. Normalize and isolate configuration

You have a mix of `process.env` access scattered across files. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)

Plan:

- Create a `config.ts` per worker boundary or one shared `config/` with modules:
  - `worker-config.ts` for `ROUTER_URL`, `PROXY_API_KEY`, `WORKER_API_KEY`, `POLL_INTERVAL`, etc. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)
  - `linear-config.ts`, `perplexity-config.ts`, `fly-config.ts`.
- Load and validate env only there; export a typed config object.
- In entrypoints, resolve config once and inject into services/clients.

This removes env lookups from hot paths, makes unit testing trivial, and eliminates subtle differences between Workers and Node runtimes.

## 7. Make handlers composable and small

Handlers like `RunCommandHandler`, `FetchUrlHandler`, `ReviewHandler`, `OrchestratorHandler` are central to behavior, and they’re all wired in `agent.ts`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/14dd13b1-fddf-4778-a42d-4ec1e137589a/FetchUrlHandler.ts)

Plan:

- Define a **HandlerFactory** that takes shared dependencies: logger, router client, LLM client, LinearClient, etc., and returns concrete handler instances.
- Group handlers by domain:
  - `handlers/system/` (run command, fetch URL, file IO/swarm tasks). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/93548c26-6612-40bf-a92e-2d0c4ca7b1cc/RunCommandHandler.ts)
  - `handlers/linear/` (LinearHandler, ingestion-related). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/aee9c473-5f5d-4b05-aedd-3fd4cf3c252c/LinearHandler.ts)
  - `handlers/llm/` (CodingHandler, ReviewHandler, OrchestratorHandler). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cac597a9-dad9-4bc1-8bd6-94b5ab35f708/OrchestratorHandler.ts)
- Keep each handler file under 200–250 lines by:
  - Extracting heavy LLM prompt construction or state machines into separate `services/` modules.
  - Reusing shared utility functions for logging and error shaping.

This is where the “keep TS under 300 lines” heuristic pays off: each handler becomes a small, swappable component.

## 8. Separate resilience and UX messaging

You have **excellent human-readable banners and help text** inside network and Linear logic. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)

Plan:

- Split into:
  - A **resilience core**: numeric limits, backoff formulas, exit conditions. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
  - A **messaging layer**: banners, help instructions, ASCII art.
- Keep the core in generic modules, and route human messages through a `StatusReporter` / `Logger` abstraction that can later feed a dashboard, not just stdout.

This keeps hot-path code minimal and gives you the option to toggle verbosity per environment.

## 9. Converge Node vs Worker execution paths

Some modules assume Node (fs, child_process, http); others are Worker-friendly. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/1c0388c5-3e88-4a65-8c8c-6553ffe97ad5/cli.ts)

Plan:

- Explicitly mark **Node-only** modules (`cli.ts`, filesystem handlers, Linear lockfile client) and **Worker-safe** modules.
- Introduce a small `runtime.ts` or `env.ts` that encapsulates differences (e.g., `isNode`, `isWorker`, different fetch implementations).
- For Cloudflare Workers, ensure every entrypoint relies only on Worker-safe dependencies, with Node-only logic behind a port interface that’s not referenced in Worker builds.

This will avoid random deploy/runtime errors and makes bundling faster because the graph is cleaner.

## 10. Execution roadmap

If you want an incremental path:

1. First pass: create `config/` modules and route all env access through them. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/726144bf-e753-4661-825c-57fa98bf6100/perplexity-client.ts)
2. Second pass: extract `job-registry.ts`, `job-execution.ts`, and `agent-loop.ts` from `agent.ts` and refactor the runner `index.ts` to depend on them. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)
3. Third pass: wire `NetworkDriver` into all router calls and remove direct `fetch` usages in agent/ingestor. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
4. Fourth pass: split ingestor into parser + dispatch policy modules and introduce a `RouterClient`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
5. Fifth pass: move all external clients under `clients/` and wrap them with minimal interfaces for handlers to depend on. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/e3bace95-45d9-4bfa-a042-67aa04e75630/sprite-manager.ts)

If you want, next step I can help you design the exact module graph and naming so the 300-line rule becomes a side effect of the architecture, not another thing to babysit.

---

You can absolutely move toward a mesh later; the trick is to design the module graph now so “mesh” is mostly wiring, not a rewrite.

## Target module graph

Aim for these top-level folders and responsibilities:

| Area            | Modules (examples)                          | Notes |
|----------------|----------------------------------------------|-------|
| Runtime shells | `runtimes/worker-agent`, `runtimes/runner-http`, `runtimes/linear-ingestor` | Each has a tiny `index.ts`.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts) |
| Core agent     | `core/jobs`, `core/agent-loop`, `core/router-client` | Mesh-aware later.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts) |
| Infra/network  | `infra/network-driver`, `infra/config`       | Wrap env + fetch.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts) |
| Integrations   | `clients/linear`, `clients/perplexity`, `clients/fly` | Already present, just organized.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts) |
| Handlers       | `handlers/system`, `handlers/llm`, `handlers/linear` | Each file < 250 lines.  [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts) |

Below is an intermediate-stage plan that keeps today’s router topology and is mesh-ready.

## 1. Normalize runtimes

Goal: each runtime entrypoint does three things: load config, build dependencies, start loop/server.

1. Create `runtimes/worker-agent/index.ts` that:
   - Imports a `buildWorkerAgent()` factory (see next section).
   - Grabs config from `infra/config`.
   - Calls `agent.start()` (which internally sets up handlers and calls the loop). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
2. Shrink the existing `index.ts` into `runtimes/runner-http/index.ts`:
   - Keep only HTTP plumbing and the “execute command” endpoint.
   - Depend on a `RunCommandService` instead of importing handlers directly. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)
3. Create `runtimes/linear-ingestor/index.ts`:
   - Just calls `startLinearIngestor(config)` after building the Linear client and router client. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

Result: each runtime is a thin shell; future mesh nodes are just more shells that reuse the same core.

## 2. Core job system (mesh-ready)

Right now, `agent.ts` mixes job types, registry, and loop. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)

Create a `core/jobs` package:

- `core/jobs/types.ts`:
  - `Job`, `JobResult`, `JobHandler` exactly as you have them now. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- `core/jobs/registry.ts`:
  - `registerHandler`, `handlers` map.
  - No imports of concrete handlers; just types. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- `core/jobs/executor.ts`:
  - `processJob(job, { completeJob, completeSwarmTask, updateSwarmStatus })`.
  - Contains all the swarm-specific behavior you have now, but parameterized by three functions that talk to “whatever coordination plane exists”. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)

Mesh path: when you go mesh, you swap `completeJob` / `completeSwarmTask` implementations from “post to router URL” to “post to local peer / DHT / queue” without touching handler logic.

## 3. Agent loop as a pluggable “transport”

Factor your poller into `core/agent-loop`:

- `core/agent-loop/pollLoop.ts`:
  - A function `createPollLoop({ routerClient, registry, intervalMs })` that returns `start()` and `stop()`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
  - Inside, it does what `pollWorker` does now: POST to `/v1/worker/poll`, decode job(s), call `processJob`, then use the injected completion functions. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- `core/agent-loop/types.ts`:
  - `RouterClient` interface: `poll(workerId)`, `completeJob`, `updateSwarmTask`, `completeSwarmTask`.
  - This is your seam between central router and future mesh protocols.

Intermediate stage: implement `RouterClient` with your current HTTP calls via `NetworkDriver`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
Mesh stage: add `MeshRouterClient` implementing the same interface but talking to peers; runtimes choose which to use based on config.

## 4. Infra: config + network

You already have `NetworkDriver` and scattered env reads. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

1. Add `infra/config.ts`:
   - One function per runtime: `loadWorkerConfig()`, `loadLinearIngestorConfig()`, etc., which do all `process.env` reading and validation. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)
   - Export typed objects: `{ routerUrl, proxyApiKey, workerId, pollInterval }`, etc.
2. Add `infra/network-driver.ts`:
   - Move `NetworkDriver` here unchanged except to remove direct `process.exit` and instead throw well-typed errors (`FatalAuthError`) that runtimes can decide how to handle. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
3. Add `infra/router-client-http.ts`:
   - Implements `RouterClient` by calling `NetworkDriver.robustFetch` on `/v1/worker/poll`, `/v1/queue/complete`, `/v1/swarm/update`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)

Intermediate: the behavior is the same, but all router I/O is behind one interface. That’s exactly what you want for a mesh.

## 5. Handlers as small, DI-ready modules

You already have a nice set of handlers; they just live in the same giant agent context. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/14dd13b1-fddf-4778-a42d-4ec1e137589a/FetchUrlHandler.ts)

1. Group handlers into subfolders:
   - `handlers/system`: `RunCommandHandler`, `FetchUrlHandler`, `SwarmTaskHandler`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/93548c26-6612-40bf-a92e-2d0c4ca7b1cc/RunCommandHandler.ts)
   - `handlers/llm`: `CodingHandler`, `ReviewHandler`, `OrchestratorHandler`, `VerifyHandler`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cac597a9-dad9-4bc1-8bd6-94b5ab35f708/OrchestratorHandler.ts)
   - `handlers/linear`: `LinearHandler` + helpers. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/aee9c473-5f5d-4b05-aedd-3fd4cf3c252c/LinearHandler.ts)
2. Add a `handlers/factory.ts`:
   - `createDefaultHandlers(deps)` that instantiates handlers with injected dependencies (LLM client, Linear client, router client) and registers them with the core registry. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts)
3. Keep each handler file under ~250 lines by pushing:
   - Prompt building into `services/prompts/*`.
   - Long decision logic into `services/orchestration/*`.

Mesh: when different nodes have different capabilities, you just give each runtime a different `createHandlers` call.

## 6. Linear ingestor as a first-class worker

Right now ingestor is free-floating. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

1. Split into:
   - `linear/ingestor-loop.ts`: `startLinearIngestor(config, { linearClient, routerClient })` containing the looping and “three attempts then skip” logic. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
   - `linear/job-parser.ts`: everything that transforms an issue into `{ jobType, payload }`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
   - `linear/locker.ts`: the `processedIssueIds`, `issueAttemptCounts`, and comment-based locking. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
2. Change dispatch to go through the same `RouterClient` interface used by the agent:
   - `routerClient.enqueueJob(jobType, payload)` instead of raw fetch to `/v1/queue/add`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

Intermediate: still central router, but Linear ingestion becomes “just another mesh node” as soon as you have distributed routing.

## 7. Mesh-aware choices now vs later

You don’t need to implement mesh yet, but you can avoid painting yourself into a corner:

- Always inject a **“coordination client”** (`RouterClient` today, “MeshCoordinationClient” tomorrow) instead of letting handlers/runtimes call URLs directly. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
- Keep job identity and worker identity explicit: you already have `workerId` and `job.id`; keep those types stable. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- Make **idempotency** first-class: Linear ingestor already has local caches and comments; keep that behavior visible in interfaces so other nodes can implement equivalent semantics. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

## 8. Concrete staged sequence (minimal thrash)

If you want a stepwise implementation order that keeps you shipping:

1. Extract `infra/config` and `infra/network-driver`, and replace env reads in `agent.ts`/`ingestor.ts` with config objects. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
2. Create `core/jobs` (types, registry, executor) and move those parts out of `agent.ts`. Wire `agent.ts` to use them. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
3. Introduce `RouterClient` and `core/agent-loop`; refactor `pollWorker` into it and have `startAgent` just call `createPollLoop(...).start()`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
4. Refactor Linear ingestor to use `RouterClient.enqueueJob` and split parser/locker into separate modules. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
5. Create `handlers/factory.ts`, move handler creation there, and make runtimes call it instead of registering in `agent.ts`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)

At that point, flipping to a mesh is mostly:

- Implementing a `MeshRouterClient`.
- Adding a mesh runtime shell.
- Gradually redirecting some nodes from HTTP router to mesh coordination.

If you tell me which runtime you want to refactor first (worker agent vs ingestor vs HTTP runner), I can outline the exact file names and function signatures to introduce in that slice so you can start cutting without stalling on the mesh design.

---

You can standardize and refactor new and existing workers without seeing them by adopting a project-wide “Worker Contract” and a phased migration playbook.

## 1. Define a Worker Contract

Across all workers, agree on these invariants:

- Every worker has a **tiny entrypoint** (`src/index.ts`) that only:
  - Parses the incoming request.
  - Selects a route or command.
  - Calls into a service module and returns its result. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/b7a32685-be4e-4b47-80c2-8b22aca0d3b1/README.md)
- All **logic lives in services** under `src/services/*` or `src/handlers/*`, with a soft cap of ~300 lines per file.
- Each worker exposes:
  - A `HealthService` (or route) that returns `{status, timestamp, version, role}`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/36405754-6200-41b0-ba40-7d5bb20c00d6/README.md)
  - A consistent error response format (e.g., `{ errorCode, message, details? }`).

Write this Worker Contract down once (in `docs/INTEGRATION_PROTOCOLS.md` or a new `WORKER_CONTRACT.md`) so every worker you add or refactor is aiming at the same shape. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/36405754-6200-41b0-ba40-7d5bb20c00d6/README.md)

## 2. Standardize folder structure and tooling

You already have a standard structure documented; extend it slightly. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/178f2092-a3a3-49be-85e0-b97aeee6a679/package.json)

For each worker repo or subfolder:

- Enforce the same layout:
  - `src/index.ts` – entrypoint only.
  - `src/routes/` – request → service wiring (for Hono/HTTP-style workers). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/48159221-636f-4f08-89a2-2e08b5bb9dcd/index.ts)
  - `src/services/` – domain logic (Linear ingest, orchestration, routing).
  - `src/infra/` – config, network clients, KV/D1 access.
  - `src/handlers/` – discrete job/task handlers (for swarm/agent workers).
- Reuse shared tsconfig and Wrangler patterns:
  - Strict TS, shared types for environment bindings, one `wrangler.toml` per worker. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/e999d954-64a6-4a5f-89c1-23c1cdcd6ef6/wrangler.toml)
- Add a “Worker Template” folder you can copy when you spin up a new worker: minimal entrypoint, health route, config loader, and README.

This gives you a uniform skeleton even before you touch the existing code.

## 3. Introduce shared infra modules

Create a small shared library (monorepo package or local `libs/` directory) that all workers depend on:

- `@bifrost/config`:
  - Typed loaders for env/config: `loadWorkerConfig`, `loadLinearConfig`, `loadMeshConfig`, etc., instead of ad-hoc `process.env` in each worker. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
- `@bifrost/network`:
  - Your `NetworkDriver` generalized for Workers and Node, with consistent backoff, timeouts, and error types. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/6fc878b6-252b-44a5-8018-9e77173984f4/network.ts)
- `@bifrost/clients`:
  - Linear, Perplexity, Fly clients with the same interfaces across workers. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/76a0a628-b1fd-4e10-adb9-d13279420929/linear-client.ts)
- `@bifrost/observability`:
  - Logging interface + structured event types (e.g., `NetworkFailure`, `AuthCircuitOpened`, `JobCompleted`).

Plan: as you refactor each worker, replace its local helpers with these shared modules. That shrinks each worker and centralizes “hard” logic like resilience and auth safety.

## 4. Normalize how workers express capabilities

To keep mesh-ready and reduce tech debt, define a common “capabilities descriptor” concept:

- Each worker has a small `src/worker-manifest.ts` that describes:
  - Worker `id`, `role` (ingestor, router, executor, proxy, etc.).
  - Supported “verbs” or job types (e.g., `run_command`, `fetch_url`, `orchestration`, `linear_ingest`). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)
  - Constraints (rate limits, external APIs used).
- The control plane (or a future mesh directory service) reads these manifests to know which worker does what.

This forces you to think of workers as nodes with typed capabilities, which will make later mesh routing mostly a data problem, not a code audit.

## 5. Per-worker refactor recipe

When you touch any existing worker (including ones I haven’t seen), follow the same high-level steps:

1. **Catalog current behavior**  
   - List routes/endpoints and cron triggers.
   - List external dependencies (APIs, KV, D1, queues).
   - Identify long files (>300 lines) and cross-cutting concerns.

2. **Extract configuration**  
   - Move all `process.env` / `env` access into a `config` module using the shared `@bifrost/config`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
   - Make entrypoint and services accept a typed config object.

3. **Split entrypoint from logic**  
   - Keep `index.ts` as thin routing + health.
   - Move logic into:
     - `services/*` (for HTTP + CF Workers).
     - `core/loop` + `handlers/*` (for long-running agents). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/41a74131-d998-4339-b763-675637890c29/index.ts)

4. **Wire network via shared driver**  
   - Replace raw `fetch` with `NetworkDriver` or a small `ApiClient` that uses it, so all backoff/kill behavior is consistent. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)

5. **Carve out discrete handlers/services**  
   - For anything “do X with external system Y”, create a handler/service file with a single responsibility.
   - If a file does more than two of: parse, coordinate jobs, call external APIs, apply business rules, split it.

6. **Add tests or at least smoke checks**  
   - For workers with critical behavior (Linear ingest, swarm orchestration), write at least high-level tests that exercise services without the Worker runtime.

Apply that same recipe to each worker in turn; you don’t need to see the code in advance because the steps are invariant.

## 6. Global alignment and tech-debt burn-down

To systematically reduce tech debt across all workers:

- Maintain a **worker inventory** document:
  - For each worker: role, status, code health score (0–3), file size violations, “uses shared lib? yes/no”.
- Set a **refactor threshold**:
  - When touching a worker for new features or bugfixes, bring it to at least health score 2: config extracted, entrypoint slim, shared network client used.
- Schedule a **rolling alignment**:
  - Week N: align all “ingestor-style” workers.
  - Week N+1: align all “agent/executor” workers.
  - Week N+2: align all “proxy/router” workers.

That way you get convergence without a freeze.

## 7. Mesh-aware decisions to bake in now

Even without building the mesh yet, enforce these design rules as you refactor:

- Workers never **hardcode other workers’ URLs**; they depend on an abstract client (`RouterClient`, `MeshDirectory`, etc.) from shared libs that uses config to route. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/e999d954-64a6-4a5f-89c1-23c1cdcd6ef6/wrangler.toml)
- Job and worker identity are always explicit fields (`workerId`, `jobId`, `taskId`) and never inferred from URLs or paths. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- Coordination concerns (who owns “truth” for job state) are expressed via interfaces, not util functions embedded in workers.

If you want, next we can turn this into a checklist you can paste into `docs/SYSTEM_ARCHITECTURE.md` and use as a “Worker Refactor SOP” for yourself or any future collaborators.

---

Here’s a concise “Worker Refactor SOP” you can drop into your docs.

## Worker Refactor SOP

This SOP standardizes how we design, refactor, and align all Bifrost / Aegis workers to reduce tech debt and keep the system mesh-ready.

### 1. Worker Contract

Every worker must:

- Have a **tiny entrypoint** (`src/index.ts`) that only:
  - Parses the incoming request (or event).
  - Selects a route/command.
  - Calls a service/handler and returns its result.
- Expose a **health endpoint** or equivalent that returns at least: `{ status, timestamp, version, role }`.
- Use a **consistent error envelope** (e.g., `{ errorCode, message, details? }`) for non-2xx responses.
- Keep all **business logic** outside the entrypoint, in `services/` or `handlers/`, with a soft cap of ~300 lines per file.

### 2. Standard Structure

Each worker follows this structure (or equivalent in a monorepo):

- `src/index.ts` – entrypoint (routing, no logic).
- `src/routes/` – request → service wiring (for HTTP-style workers).
- `src/services/` – domain logic (ingestion, orchestration, transformation).
- `src/handlers/` – job/task handlers (for swarm/agent workers).
- `src/infra/` – config, network, storage, external clients.
- `wrangler.toml` – deployment config.
- `README.md` – worker-specific purpose, env vars, and endpoints.

New workers should be created from a template that already conforms to this structure.

### 3. Use Shared Libraries

Workers should avoid bespoke helpers and instead depend on shared modules (monorepo package or `libs/`):

- `@bifrost/config` – typed env/config loaders per worker role.
- `@bifrost/network` – shared `NetworkDriver` and HTTP client behavior (timeouts, backoff, kill switches).
- `@bifrost/clients` – standardized clients for Linear, LLMs, Fly, etc.
- `@bifrost/observability` – logging interface and structured event types.

Refactors should replace local env reads and direct `fetch` calls with these shared modules.

### 4. Capabilities Manifest

Each worker defines a small manifest module describing:

- `id` and `role` (e.g., `linear-ingestor`, `swarm-agent`, `proxy-gateway`).
- Supported **capabilities** (job types, verbs, endpoints).
- External dependencies (APIs, KV/D1, queues).

This manifest is the source of truth for the control plane and future mesh directory.

### 5. Per-Worker Refactor Steps

When refactoring any worker:

1. **Inventory**  
   - List routes, event triggers, and external dependencies.  
   - Identify long files (>300 lines) or mixed concerns.

2. **Extract configuration**  
   - Move all env access into a `config` module using `@bifrost/config`.  
   - Inject config into services and entrypoints instead of reading env inline.

3. **Split entrypoint from logic**  
   - Keep `index.ts` limited to routing and health.  
   - Move logic into `services/` or `handlers/` with clear boundaries.

4. **Route network through shared infra**  
   - Replace raw `fetch` with shared network clients (`NetworkDriver` or `ApiClient` wrappers).  
   - Ensure consistent timeout, retry, and error semantics.

5. **Carve out focused modules**  
   - Split files that mix parsing, orchestration, external I/O, and business rules.  
   - Each module should have a single primary responsibility.

6. **Add smoke tests or checks**  
   - At minimum, test core services/handlers without the Worker runtime.  
   - Confirm health endpoint and error envelope behavior.

### 6. Alignment and Tech-Debt Tracking

Maintain a **Worker Inventory** document with, for each worker:

- Role, status, and owner.
- Health score (0–3), e.g.:
  - 0 – legacy, no contract.
  - 1 – config extracted or entrypoint slim, not both.
  - 2 – config + entrypoint + shared network client.
  - 3 – fully aligned with shared libs and manifest.
- Notes on remaining debt (e.g., “monolithic handler”, “direct env reads”).

Rule of thumb: whenever a worker is touched for new work, bring it to at least **health 2** as part of that change.

### 7. Mesh-Aware Principles

To stay mesh-ready without building the mesh yet:

- Workers **never** hardcode other workers’ URLs; they depend on abstract clients (router/coordination interfaces) implemented in shared infra.
- Job and worker identity are always explicit fields, not implied by URLs or hostnames.
- Coordination and state transitions (job completion, task updates) are encapsulated behind interfaces, not scattered util calls.

This SOP is the baseline; any new worker or significant refactor should start by aligning with these rules before adding new behavior.

---

You can treat `RouterDO` as its own mini service with clear subdomains, then carve it up around those seams while keeping one Durable Object class.

## 1. Identify RouterDO subdomains

From the current `RouterDO` you essentially have these responsibilities in one file: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)

- State lifecycle: load/save state, delete legacy blob, manage alarms and maintenance.
- Job orchestration: queue/add jobs, poll workers, mark jobs complete, batching.  
- Swarm tasks: create/update tasks, sync with Linear/GitHub, track ingested issues.
- LLM routing: rate limiting, provider selection, prompt optimization, metrics.  
- Webhooks and auth: Linear and GitHub webhook verification and ingestion.  
- Integrations: Linear client, GitHub client, Fly runner control, EventStore usage.

That’s why it’s so long. The plan is to keep one DO class but move each of those concerns into targeted modules, so `router-do.ts` becomes a thin façade.

## 2. Target shape for router-do.ts

End state for `router-do.ts`:

- Defines `Env` and the `RouterDO` class. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
- In the constructor:
  - Initializes dependencies (LLM router, Linear/GitHub/Fly clients, EventStore, governance stub). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/49a5a85f-a85a-4c81-8b58-609f3134dcf1/events.ts)
  - Calls a `RouterStateManager` to restore state.
- Implements the DO surface:
  - `fetch(request)` – route to submodules based on method/path.
  - `alarm()` – delegate to a `MaintenanceService`.
- Delegates all real work to services, e.g. `jobService.handleQueueAdd()`, `swarmService.handleSwarmUpdate()`, `llmService.handleChatV2()`, etc.

The router file ideally ends up in the 400–600 line range instead of 79k characters, with all logic moved out to services.

## 3. Extract core state and maintenance

Create a dedicated “state and maintenance” layer:

- `router/state-manager.ts`:
  - Responsible for:
    - Deleting the legacy `router_state` blob safely. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
    - Loading jobs, tasks, metrics, rate limits, recent errors, circuitBreakers, ingestedIssueIds from storage keys. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
    - Saving back metadata and per-job/per-task keys.
  - Provides simple methods: `loadState()`, `saveState(partial?)`, `updateJob(job)`, `updateSwarmTask(task)`, etc.
- `router/maintenance-service.ts`:
  - Handles `alarm()` logic: `syncLinearTasks`, `processBatch`, `triggerMaintenance`, and any house-keeping (error trimming, rate-limit cleanup). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
  - Exposes a single `runMaintenance()` that `alarm()` calls.

This isolates Durable Object storage semantics and background work from request routing and LLM orchestration.

## 4. Factor out job orchestration

Right now, job add/poll/complete behavior plus batching is buried in `RouterDO`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)

Create a job orchestration module:

- `router/job-service.ts`:
  - Knows about the `RouterStateManager`.
  - Implements:
    - `enqueueJob(requestBody)` and returns created job.
    - `pollWorker(workerId)` and returns the next job(s).
    - `completeJob(jobId, result)` and updates state plus metrics.
    - `processBatch()` if you’re doing batch job execution in the DO. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
  - Emits events via `EventStoreClient` for job lifecycle transitions (`JOB_CREATED`, `JOB_COMPLETED`, etc.). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/49a5a85f-a85a-4c81-8b58-609f3134dcf1/events.ts)

Then the DO’s `fetch` just switches on `/v1/queue/add`, `/v1/queue/poll`, `/v1/queue/complete` and forwards to this service.

## 5. Separate swarm task lifecycle

Swarm tasks (SluaghSwarmTask) have their own lifecycle and integration hooks (Linear, GitHub, Fly). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/f2eb23a8-91af-4336-bb81-c7f99c5a8421/linear.ts)

Create:

- `router/swarm-service.ts`:
  - Responsible for:
    - Creating and updating swarm tasks using `SluaghSwarmTaskCreateSchema` / `UpdateSchema`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cbfe0769-c2da-4a18-b748-561cc650831a/schemas.ts)
    - Recording engineering logs and status.
    - Handling `/v1/swarm/update`, `/v1/swarm/status`, and any sync endpoints.
- `router/swarm-sync-service.ts`:
  - Holds `syncLinearTasks` and any GitHub/Fly sync code. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/f2cd26f5-bceb-4286-89ed-32d1f439da3e/fly.ts)
  - Talks to `LinearClient`, `GitHubClient`, and `FlyClient` but not to the Worker DO directly.
  - Called by maintenance and/or explicit endpoints.

This keeps swarm-specific complexity out of the main router file and localizes integration logic.

## 6. Isolate LLM routing and rate limiting

LLM routing already uses `LLMRouter` and an `LLMConfig`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)

Introduce:

- `router/llm-service.ts`:
  - Contains:
    - `routeLLM(request: RoutingRequest): Promise<LLMResponse>` including:
      - Loading optimized prompts from `EventStoreClient` state (`global-optimization`). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/49a5a85f-a85a-4c81-8b58-609f3134dcf1/events.ts)
      - Applying any prompt transforms.
      - Calling the underlying `LLMRouter`.
      - Recording provider-level metrics and tokens used. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
    - `handleV2Chat(request)` for `/v2/chat` style endpoints, including validation with `JobPayloadSchema` or similar. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cbfe0769-c2da-4a18-b748-561cc650831a/schemas.ts)
- `router/rate-limit-service.ts`:
  - Implements `checkRateLimit(key)` using `RouterState.rateLimits` and env overrides. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
  - Responsible only for token bucket math and metrics; no knowledge of LLM specifics.
  - LLM service calls this before routing, with keys like `llm:${provider}` or `user:${id}`.

This way, if you later want to move rate limiting to `GovernanceDO` or a mesh-aware policy engine, you swap out the rate-limit service without touching the router’s HTTP surface.

## 7. Move webhook logic to dedicated modules

Webhook handlers are another major source of length. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)

Create:

- `router/webhooks/linear-webhook-handler.ts`:
  - Verifies Linear signatures (`verifyLinearSignature`). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
  - Validates body with `LinearWebhookSchema`. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cbfe0769-c2da-4a18-b748-561cc650831a/schemas.ts)
  - Converts webhook payloads into job/swarm operations via `JobService` / `SwarmService`.
- `router/webhooks/github-webhook-handler.ts`:
  - Verifies GitHub signature (`verifyGitHubSignature`). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
  - Validates body with `GitHubActionSchema`.
  - Calls appropriate swarm or job operations.

Then, in `RouterDO.fetch`:

- For `/webhooks/linear` and `/webhooks/github`, you just dispatch to these handlers.
- This keeps HTTP path routing visible without burying signature logic in the main DO file.

## 8. Centralize configuration and dependency wiring

Right now, `Env` is defined in `router-do.ts` and you instantiate everything inline. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/4d7ef9bc-7e19-4efe-9dea-afd1147e7175/wrangler.toml)

Refine this into:

- `router/config.ts`:
  - Validates required env keys and default values (`RATE_LIMIT_*`, `EVENTS_URL`, etc.). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/4d7ef9bc-7e19-4efe-9dea-afd1147e7175/wrangler.toml)
  - Provides types for LLM, Linear, GitHub, Fly, Events, Governance.
  - Exposes `buildRouterConfig(env: Env)` that returns a typed config object.
- `router/dependencies.ts`:
  - Contains a `buildDependencies(config)` function that constructs:
    - `LLMRouter`, `EventStoreClient`, `FlyClient`, `LinearClient`, `GitHubClient`, `RateLimitService`, etc. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/af3ec18a-affd-49e6-8222-ce3de58f425c/github.ts)
  - Keeps all “new XClient” calls out of the main DO class.

Then `RouterDO.constructor` becomes a small wiring function that calls `buildRouterConfig(env)` and `buildDependencies(config)` and passes those into the various services.

## 9. Restructure router-do.ts’s fetch and alarm

Once the services exist, refactor `RouterDO`’s methods:

- `fetch(request)`:
  - Parse URL and method once.
  - Short top-level switch:
    - `/health`, `/metrics`, `/jobs`, `/swarm`, `/v2/chat`, `/webhooks/*`, internal maintenance paths.
  - Delegate to appropriate service methods.
  - Ensure all responses pass through a small helper to attach CORS and common headers.
- `alarm()`:
  - Only logs, then calls `maintenanceService.runMaintenance()`.

Keep any inline handlers (like `/health` or read-only `/metrics`) extremely thin and stateless; use `RouterStateManager` to read metrics.

## 10. Concrete step order

To avoid getting lost in a massive diff, you can refactor in this sequence:

1. Extract `RouterStateManager` and `MaintenanceService`, move all storage/maintenance logic there, keep method signatures the same. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
2. Extract `JobService` (enqueue, poll, complete, batch) and switch `/v1/queue/*` endpoints to use it. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
3. Extract `LLMService` and `RateLimitService`, then redirect `/v2/chat` and LLM routes. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
4. Extract `SwarmService` and `SwarmSyncService`, shift `/v1/swarm/*` code into them and adjust maintenance. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/f2eb23a8-91af-4336-bb81-c7f99c5a8421/linear.ts)
5. Extract `LinearWebhookHandler` and `GitHubWebhookHandler`, point `/webhooks/*` to them. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/cfd7bc4c-0eaf-4afc-b3cf-ac0b825d64f7/router-do.ts)
6. Finally, introduce `router/config` and `router/dependencies` to clean up constructor wiring. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/dafd687b-85f9-4b21-aa95-bbeb2f5bbfce/index.ts)

Each step can be done with minimal behavioral change, and you can run your existing tests (`events.test.ts`, vitest config) after each slice. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/75681c10-fa76-4ae8-aaf3-589bfee51f9f/vitest.config.ts)

If you’d like, next we can design the exact list of service modules and their responsibilities in a short table you can paste as a TODO into the repo to track progress against this plan.