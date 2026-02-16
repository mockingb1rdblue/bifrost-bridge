# Backlog Archive: 2026-02-16

This file contains the details of 68 Linear issues that were canceled to free up active issue space (Bifrost v3 was hitting the 250 active issue limit).

## Summary
- **FLY-### (62 issues)**: Original infrastructure planning from Feb 12. Superseded by the Orchestrator/Manager architecture.
- **[TEST] (6 issues)**: Development test issues created during initial seeding verification.

---

## Infrastructure Planning (FLY-###)

### [FLY-001] Initialize Fly.io Account & CLI (BIF-70)
**Created**: 2026-02-12T19:03:40.327Z
**Description**: 
**P1 | 15min**
Install flyctl, authenticate, verify access
Steps:
1. curl -L https://fly.io/install.sh | sh
2. flyctl auth login
3. flyctl auth whoami

### [FLY-002] Create bifrost-runner App (BIF-71)
**Created**: 2026-02-12T19:03:40.514Z
**Description**: **P1 | 10min**
Run: flyctl apps create bifrost-runner
Deps: FLY-001

### [FLY-003] Create bifrost-events App (BIF-72)
**Created**: 2026-02-12T19:03:40.692Z
**Description**: **P1 | 10min**
Run: flyctl apps create bifrost-events
Deps: FLY-001

### [FLY-004] Configure WireGuard 6PN (BIF-73)
**Created**: 2026-02-12T19:03:40.891Z
**Description**: **P1 | 20min**
Run: flyctl wireguard create
Save to .fly/wireguard.conf
Deps: FLY-001

### [FLY-028] Research Sprites vs Machines (BIF-74)
**Created**: 2026-02-12T19:03:41.069Z
**Description**: **P1 | 60min** 🔥 MONTH 2
Compare state persistence, cold start, costs
Doc: docs/sprites_evaluation.md
Ref: _INBOX/flyio_more_upgrades.md

### [FLY-029] Design Sprite Allocation Strategy (BIF-75)
**Created**: 2026-02-12T19:03:41.227Z
**Description**: **P1 | 45min** 🔥 MONTH 2
Decide: 1 Sprite/repo vs pooled
Doc: docs/sprite_allocation.md
Deps: FLY-028

### [FLY-030] Add Sprite API Client (BIF-76)
**Created**: 2026-02-12T19:03:41.388Z
**Description**: **P1 | 60min** 🔥 MONTH 2
Functions: createSprite(), pauseSprite(), resumeSprite()
File: workers/custom-router/src/sprite-client.ts
Deps: FLY-015

### [FLY-031] Implement Sprite Lifecycle (BIF-77)
**Created**: 2026-02-12T19:03:41.528Z
**Description**: **P1 | 75min** 🔥 MONTH 2
Pause after batch (not shutdown), resume in 1-2s
Preserve: repos, deps, working tree
File: workers/bifrost-runner/src/sprite-lifecycle.ts
Deps: FLY-030

### [FLY-032] Add Repo Clone Detection (BIF-78)
**Created**: 2026-02-12T19:03:41.698Z
**Description**: **P1 | 30min** 🔥 MONTH 2
Check /.sprite/repos/{name}, skip if exists (saves 20s)
File: workers/bifrost-runner/src/repo-manager.ts
Deps: FLY-031

### [FLY-033] Dependency Cache Check (BIF-79)
**Created**: 2026-02-12T19:03:41.840Z
**Description**: **P2 | 45min**
Hash package.json, skip npm install if unchanged (saves 30s)
File: workers/bifrost-runner/src/dep-cache.ts
Deps: FLY-031

### [FLY-034] Sprite Checkpoint Creation (BIF-80)
**Created**: 2026-02-12T19:03:42.050Z
**Description**: **P2 | 60min**
Create checkpoint after batch, keep last 5
Save to /.sprite/checkpoints/
Deps: FLY-031

### [FLY-035] Sprite Health Check (BIF-81)
**Created**: 2026-02-12T19:03:42.214Z
**Description**: **P2 | 45min**
Verify before resume, rollback to checkpoint if corrupted
File: workers/bifrost-runner/src/health-check.ts
Deps: FLY-034

### [FLY-013] Base Dockerfile for Agent (BIF-82)
**Created**: 2026-02-12T19:03:42.382Z
**Description**: **P1 | 30min**
FROM node:20-slim, <100MB
File: workers/bifrost-runner/Dockerfile

### [FLY-014] Add Git & Build Tools (BIF-83)
**Created**: 2026-02-12T19:03:42.636Z
**Description**: **P1 | 20min**
apt-get install git curl build-essential
Deps: FLY-013

### [FLY-015] Add Fly Machines API Client (BIF-84)
**Created**: 2026-02-12T19:03:42.857Z
**Description**: **P2 | 15min**
npm install @flydotio/fly-api
File: workers/custom-router/package.json

### [FLY-016] Implement Machine Spawn (BIF-85)
**Created**: 2026-02-12T19:03:43.008Z
**Description**: **P2 | 60min**
Function: spawnRunner(taskId) → machineId
File: workers/custom-router/src/fly-client.ts
Deps: FLY-015

### [FLY-010] Create Volume for Events (BIF-86)
**Created**: 2026-02-12T19:03:43.170Z
**Description**: **P1 | 15min**
Run: flyctl volumes create ev_store_data --size 1
Deps: FLY-003

### [FLY-011] SQLite Event Schema (BIF-87)
**Created**: 2026-02-12T19:03:43.340Z
**Description**: **P1 | 30min**
Simple events table: id, type, payload, created_at
File: workers/bifrost-events/schema.sql

### [FLY-012] Event Store HTTP API (BIF-88)
**Created**: 2026-02-12T19:03:43.486Z
**Description**: **P1 | 60min**
Endpoints: POST /events, GET /events/:taskId
File: workers/bifrost-events/src/index.ts

### [FLY-013-E] Private-Only Event Access (BIF-89)
**Created**: 2026-02-12T19:03:43.640Z
**Description**: **P2 | 30min**
Restrict listener to .internal addresses
File: workers/bifrost-events/fly.toml

### [FLY-014-E] Deploy Event Store (BIF-90)
**Created**: 2026-02-12T19:03:43.785Z
**Description**: **P1 | 20min**
Run: flyctl deploy
File: workers/bifrost-events/fly.toml

### [FLY-020] Event API Auth (BIF-91)
**Created**: 2026-02-12T19:03:43.957Z
**Description**: **P2 | 30min**
Pre-shared key in FLY_EVENT_SECRET
File: workers/bifrost-events/src/auth.ts

### [FLY-021] Configure Worker Secrets (BIF-92)
**Created**: 2026-02-12T19:03:44.116Z
**Description**: **P1 | 15min**
flyctl secrets set LINEAR_API_KEY=...
Deps: FLY-002

### [FLY-022] Test WireGuard Isolation (BIF-93)
**Created**: 2026-02-12T19:03:44.256Z
**Description**: **P2 | 45min**
Verify runner can talk to events but not public internet
File: scripts/test-isolation.sh

### [FLY-019] Disable SSH on Runners (BIF-94)
**Created**: 2026-02-12T19:03:44.398Z
**Description**: **P3 | 15min**
Restrict access for security
File: workers/bifrost-runner/fly.toml

### [FLY-025] E2E Runner Lifecycle Test (BIF-95)
**Created**: 2026-02-12T19:03:44.593Z
**Description**: **P1 | 90min**
Full loop: Spawn -> Event Check -> Destroy
File: scripts/test-runner-e2e.ts

### [FLY-026] Load Test Event Store (BIF-96)
**Created**: 2026-02-12T19:03:44.755Z
**Description**: **P3 | 45min**
Verify SQLite performance under concurrent writes
File: scripts/bench-events.ts

### [FLY-027] Verify Cost Posture (BIF-97)
**Created**: 2026-02-12T19:03:44.918Z
**Description**: **P1 | 15min**
Check flyctl status, ensure no runaway machines
Run: flyctl status --all

### [FLY-036] Sprite Pooling Registry (BIF-98)
**Created**: 2026-02-12T19:03:45.060Z
**Description**: **P2 | 60min** 🔥 MONTH 2
Maintain map of active sprites and their current state
File: workers/custom-router/src/sprite-pool.ts

### [FLY-037] Queue-Depth Scaling (BIF-99)
**Created**: 2026-02-12T19:03:45.222Z
**Description**: **P3 | 45min** 🔥 MONTH 2
Trigger new sprite if queue > 5 per active sprite
File: workers/custom-router/src/scaler.ts
Deps: FLY-036

### [FLY-038] Autoscaling Cost Guardrails (BIF-100)
**Created**: 2026-02-12T19:03:45.385Z
**Description**: **P1 | 30min**
Hard cap at 10 concurrent machines
File: workers/custom-router/wrangler.toml

### [FLY-005] Install flyctl on macOS (BIF-103)
**Created**: 2026-02-12T22:44:06.310Z
**Description**: **P1 | 5min**
curl -L https://fly.io/install.sh | sh

### [FLY-006] Authenticate with Fly.io (BIF-104)
**Created**: 2026-02-12T22:44:06.467Z
**Description**: **P1 | 5min**
flyctl auth login

### [FLY-007] Verify Fly.io Account Access (BIF-105)
**Created**: 2026-02-12T22:44:06.632Z
**Description**: **P1 | 5min**
flyctl auth whoami

### [FLY-008] Create bifrost-runner Fly App (BIF-106)
**Created**: 2026-02-12T22:44:06.777Z
**Description**: **P1 | 5min**
flyctl apps create bifrost-runner --org personal

### [FLY-009] Create bifrost-events Fly App (BIF-107)
**Created**: 2026-02-12T22:44:06.923Z
**Description**: **P1 | 5min**
flyctl apps create bifrost-events --org personal

### [FLY-030-N] Setup WireGuard on Local Machine (BIF-108)
**Created**: 2026-02-12T22:44:07.068Z
**Description**: **P1 | 10min**
flyctl wireguard create personal sea mock1ng-mac-mini

### [FLY-031-N] Test 6PN Private Connectivity (BIF-109)
**Created**: 2026-02-12T22:44:07.227Z
**Description**: **P2 | 15min**
ping _api.internal

### [FLY-032-N] Plan Sprite vs Machine Strategy (BIF-110)
**Created**: 2026-02-12T22:44:07.388Z
**Description**: **P1 | 30min** 🔥 MONTH 2
Compare state persistence and cold start times.

### [FLY-033-N] Design Sprite Allocation Logic (BIF-111)
**Created**: 2026-02-12T22:44:07.545Z
**Description**: **P1 | 30min** 🔥 MONTH 2
1 Sprite per Repo vs Pooled worker strategy.

### [FLY-033] Dependency Cache Check (BIF-112)
**Created**: 2026-02-12T22:44:07.526Z
**Description**: **P2 | 45min**
Hash package.json, skip npm install if unchanged (saves 30s)
File: workers/bifrost-runner/src/dep-cache.ts
Deps: FLY-031

### [FLY-034] Sprite Checkpoint Creation (BIF-113)
**Created**: 2026-02-12T22:44:07.721Z
**Description**: **P2 | 60min**
Create checkpoint after batch, keep last 5
Save to /.sprite/checkpoints/
Deps: FLY-031

### [FLY-035] Sprite Health Check (BIF-114)
**Created**: 2026-02-12T22:44:07.935Z
**Description**: **P2 | 45min**
Verify before resume, rollback to checkpoint if corrupted
File: workers/bifrost-runner/src/health-check.ts
Deps: FLY-034

### [FLY-013] Base Dockerfile for Agent (BIF-115)
**Created**: 2026-02-12T22:44:08.120Z
**Description**: **P1 | 30min**
FROM node:20-slim, <100MB
File: workers/bifrost-runner/Dockerfile

### [FLY-014] Add Git & Build Tools (BIF-116)
**Created**: 2026-02-12T22:44:08.297Z
**Description**: **P1 | 20min**
apt-get install git curl build-essential
Deps: FLY-013

### [FLY-015] Add Fly Machines API Client (BIF-117)
**Created**: 2026-02-12T22:44:08.475Z
**Description**: **P2 | 15min**
npm install @flydotio/fly-api
File: workers/custom-router/package.json

### [FLY-016] Implement Machine Spawn (BIF-118)
**Created**: 2026-02-12T22:44:08.630Z
**Description**: **P2 | 60min**
Function: spawnRunner(taskId) → machineId
File: workers/custom-router/src/fly-client.ts
Deps: FLY-015

### [FLY-010] Create Volume for Events (BIF-119)
**Created**: 2026-02-12T22:44:08.834Z
**Description**: **P1 | 15min**
Run: flyctl volumes create ev_store_data --size 1
Deps: FLY-003

### [FLY-011] SQLite Event Schema (BIF-120)
**Created**: 2026-02-12T22:44:09.036Z
**Description**: **P1 | 30min**
Simple events table: id, type, payload, created_at
File: workers/bifrost-events/schema.sql

### [FLY-012] Event Store HTTP API (BIF-121)
**Created**: 2026-02-12T22:44:09.209Z
**Description**: **P1 | 60min**
Endpoints: POST /events, GET /events/:taskId
File: workers/bifrost-events/src/index.ts

### [FLY-013-E] Private-Only Event Access (BIF-122)
**Created**: 2026-02-12T22:44:09.367Z
**Description**: **P2 | 30min**
Restrict listener to .internal addresses
File: workers/bifrost-events/fly.toml

### [FLY-014-E] Deploy Event Store (BIF-123)
**Created**: 2026-02-12T22:44:09.538Z
**Description**: **P1 | 20min**
Run: flyctl deploy
File: workers/bifrost-events/fly.toml

### [FLY-020] Event API Auth (BIF-124)
**Created**: 2026-02-12T22:44:09.690Z
**Description**: **P2 | 30min**
Pre-shared key in FLY_EVENT_SECRET
File: workers/bifrost-events/src/auth.ts

### [FLY-021] Configure Worker Secrets (BIF-125)
**Created**: 2026-02-12T22:44:09.834Z
**Description**: **P1 | 15min**
flyctl secrets set LINEAR_API_KEY=...
Deps: FLY-002

### [FLY-022] Test WireGuard Isolation (BIF-126)
**Created**: 2026-02-12T22:44:09.974Z
**Description**: **P2 | 45min**
Verify runner can talk to events but not public internet
File: scripts/test-isolation.sh

### [FLY-019] Disable SSH on Runners (BIF-127)
**Created**: 2026-02-12T22:44:10.113Z
**Description**: **P3 | 15min**
Restrict access for security
File: workers/bifrost-runner/fly.toml

### [FLY-025] E2E Runner Lifecycle Test (BIF-128)
**Created**: 2026-02-12T22:44:10.263Z
**Description**: **P1 | 90min**
Full loop: Spawn -> Event Check -> Destroy
File: scripts/test-runner-e2e.ts

### [FLY-026] Load Test Event Store (BIF-129)
**Created**: 2026-02-12T22:44:10.405Z
**Description**: **P3 | 45min**
Verify SQLite performance under concurrent writes
File: scripts/bench-events.ts

### [FLY-027] Verify Cost Posture (BIF-130)
**Created**: 2026-02-12T22:44:10.547Z
**Description**: **P1 | 15min**
Check flyctl status, ensure no runaway machines
Run: flyctl status --all

### [FLY-036] Sprite Pooling Registry (BIF-131)
**Created**: 2026-02-12T22:44:10.713Z
**Description**: **P2 | 60min** 🔥 MONTH 2
Maintain map of active sprites and their current state
File: workers/custom-router/src/sprite-pool.ts

### [FLY-037] Queue-Depth Scaling (BIF-132)
**Created**: 2026-02-12T22:44:10.893Z
**Description**: **P3 | 45min** 🔥 MONTH 2
Trigger new sprite if queue > 5 per active sprite
File: workers/custom-router/src/scaler.ts
Deps: FLY-036

### [FLY-038] Autoscaling Cost Guardrails (BIF-133)
**Created**: 2026-02-12T22:44:11.059Z
**Description**: **P1 | 30min**
Hard cap at 10 concurrent machines
File: workers/custom-router/wrangler.toml

---

## Development Test Issues ([TEST])

### [TEST] Multi-Agent Handoff (BIF-140)
**Created**: 2026-02-13T18:26:02.695Z
**Description**: Test the orchestration to execution handoff. success: Jules plans and Worker-Bee executes successfully.

### [TEST] Latency Optimization (BIF-139)
**Created**: 2026-02-13T18:26:02.103Z
**Description**: Test infrastructure-level changes. success: Cache hits logged in metrics.

### [TEST] Security Audit (BIF-138)
**Created**: 2026-02-13T18:26:01.337Z
**Description**: Test the swarm's ability to handle dependencies. success: PR created for dependency fixes.

### [TEST] Metadata Routing (BIF-137)
**Created**: 2026-02-13T18:26:00.828Z
**Description**: Verify the orchestrator prioritizes high-priority tasks. success: Task checked out before lower priority tasks.

### [TEST] Swarm Resilience 1 (BIF-136)
**Created**: 2026-02-13T18:26:00.251Z
**Description**: Verify the swarm handles task failure correctly. success: Issue marked as swarm:blocked upon failure.

### [TEST] Swarm Resilience 2 (BIF-135)
**Created**: 2026-02-13T18:23:31.042Z
**Description**: Verify the swarm handles task failure correctly. success: Issue marked as swarm:blocked upon failure.
