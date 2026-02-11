# Router Implementation Plan (Sliced Rollout)

**Status**: Planned  
**Source**: Ingested from Custom Router Agent Plan  
**Strategy**: Thin, vertical slices. Deliver end-to-end value at each step.

---

## Phase 1: Core Router Foundation (MVP)

**Goal**: A single working path from VS Code to DeepSeek via Fly.io.

- [ ] **Slice 1.1: Basic HTTP Router**
    - FastAPI app on Fly.io.
    - Single `/chat` endpoint (OpenAI schema).
    - Hardcoded Policy: If tokens < 4k -> DeepSeek V3, else -> Gemini Flash.
- [ ] **Slice 1.2: Logging**
    - SQLite database on Fly Volume.
    - Log: `timestamp`, `provider`, `tokens`, `cost`.
- [ ] **Slice 1.3: VS Code Integration**
    - Simple extension (or setting in existing tools like `Roo-Cline` or `Continue`).
    - Point `baseURL` to `https://router.fly.dev/v1`.

## Phase 2: Project Intelligence

**Goal**: The router understands the *codebase*, not just the *file*.

- [ ] **Slice 2.1: Project Indexer Skill**
    - Walk repo, build file tree + size map.
    - Estimate token counts per module.
- [ ] **Slice 2.2: Refactor Planner (The Brain)**
    - Send *Index* to DeepSeek R1.
    - Receive *Plan* (JSON list of steps).
- [ ] **Slice 2.3: Slice Execution**
    - Execute *Plan* steps sequentially using DeepSeek V3.

## Phase 3: Linear Integration

**Goal**: Linear becomes the state spine.

- [ ] **Slice 3.1: Linear Sync Skill**
    - Router can Read/Write issues.
- [ ] **Slice 3.2: Quality Gates**
    - Rule: "Only mark Linear Issue 'Done' if `tests_passed=true`."
- [ ] **Slice 3.3: Auto-Project Ingest**
    - Workflow: Idea -> Perplexity Strategy -> DeepSeek Plan -> Linear Project + Backlog.

## Phase 4: Execution Engine & Safety

**Goal**: Safe, automated code changes.

- [ ] **Slice 4.1: Remote Test Runner**
    - Execute `npm test` or `pytest` in Fly ephemeral workspace (bypass corporate lock).
- [ ] **Slice 4.2: Parallel Slicing**
    - Run non-conflicting refactor steps in parallel (Throttle to provider limits).
- [ ] **Slice 4.3: Self-Heal**
    - Analyze failures -> Auto-rollback or Auto-fix.

## Phase 5: Optimization & Polish

**Goal**: A self-improving system.

- [ ] **Slice 5.1: Admin Dashboard**
    - Deploy the `/admin` UI (from 114_Router_Admin_Dashboard.md).
- [ ] **Slice 5.2: Auto-Learning**
    - Analyze logs for patterns.
    - Suggest rule tweaks (e.g., "DeepSeek R1 is failing on huge TS files, switch to Gemini Pro").
- [ ] **Slice 5.3: Stack Bibles**
    - Load specific "Best Practices" prompts for current stack (e.g., "Nutrien Corporate Standards").
