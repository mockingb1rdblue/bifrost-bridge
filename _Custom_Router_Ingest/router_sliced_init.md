Based on this comprehensive AI router architecture document, I'll break down how to thin-slice this project for completion and prioritize the work effectively.

## Thin-Slicing Strategy

The architecture should be decomposed into **vertical slices** that deliver end-to-end value incrementally, not horizontal layers. Each slice should work completely before moving to the next. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

### Phase 1: Core Infrastructure (MVP Router) - Week 1-2

**Slice 1.1: Basic HTTP Router on Fly.io**
- Single FastAPI/Express app with `/chat` endpoint accepting OpenAI-style requests [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Simple provider routing logic (DeepSeek < 4k tokens, Gemini > 32k) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- In-memory config (hardcoded rules, no database yet)
- Manual token estimation (chars / 4) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Deploy to Fly.io with basic health check
- **Value**: You can call the router from VS Code and get responses

**Slice 1.2: SQLite Logging**
- Add SQLite on Fly volume for basic request/response logging [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Log: job_id, skill_id, provider, model, tokens, latency, outcome
- Simple query endpoint to view recent logs
- **Value**: Observability into what the router is doing

**Slice 1.3: VS Code Extension (Minimal)**
- Single command: "AI: Chat" that posts to router `/chat` [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Hardcoded router URL and API key
- Display response in output panel
- **Value**: End-to-end flow working

### Phase 2: Linear Integration & Project Management - Week 3-4

**Slice 2.1: Linear Sync Skill**
- `linear_sync` skill for create/update/comment on issues [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- GraphQL mutations for basic operations
- Store issue_id with router jobs in SQLite
- **Value**: Work is tracked in Linear automatically

**Slice 2.2: Work Selection Workflow**
- `select_work_slice` skill that queries Linear for next feature + related tech debt [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Implements 70/30 feature/debt capacity rule [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- **Value**: Automatic work balancing without manual triage

**Slice 2.3: Quality Gates**
- Rules that require tests_passed=true before Linear status transitions [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Test execution skill (remote on Fly) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- **Value**: Nothing marked "done" until it actually works

### Phase 3: Smart Planning & Execution - Week 5-6

**Slice 3.1: Perplexity Research Skill**
- Add Perplexity as strategy/research provider [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- `research_planning_perplexity` skill with structured output
- **Value**: External validation and patterns before executing

**Slice 3.2: Project Ingest Workflow**
- `/project/ingest` endpoint [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Workflow: Linear context → Perplexity strategy → DeepSeek plan → Linear provisioning [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- **Value**: New ideas become structured Linear projects in 30 seconds

**Slice 3.3: Code Indexing & IR**
- `index_project` and `build_ir_from_index` skills [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Build dependency graph and token estimates
- Store IR in SQLite
- **Value**: Foundation for smart refactoring

### Phase 4: Advanced Refactoring - Week 7-8

**Slice 4.1: Refactor Pipeline Core**
- `/refactor/start` endpoint [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Slice generation (4-8k token targets) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Sequential slice editing with DeepSeek V3
- **Value**: Can execute multi-file refactors

**Slice 4.2: Parallelization**
- Detect independent slices
- Parallel DeepSeek calls (respect 10k RPM limit) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- **Value**: 5-10x faster refactors

**Slice 4.3: Self-Heal Workflow**
- `/project/self_heal` endpoint [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Friction analysis from logs
- Automated backlog restructuring
- **Value**: Projects stay clean without manual grooming

### Phase 5: Polish & Optimization - Week 9-10

**Slice 5.1: Stack Bibles**
- Load stack configs (Python, Vite/Vitest, Discord, etc.) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Inject stack-specific prompts into LLM calls
- **Value**: Consistent, stack-aware behavior

**Slice 5.2: Admin Dashboard**
- `/admin` UI with job list, effective policy tester, usage charts [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Config editor for rules/workflows
- **Value**: Visibility and control

**Slice 5.3: Auto-Learning**
- Daily log analysis for pattern detection [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
- Suggested rule generation
- Human approval workflow
- **Value**: System improves itself over time

## Prioritization Framework

### Must-Have (Blocks Everything)
1. Basic router + provider selection (Slice 1.1)
2. SQLite logging (Slice 1.2)
3. VS Code integration (Slice 1.3)
4. Linear sync (Slice 2.1)

### High-Value Early Wins
5. Work selection with capacity rules (Slice 2.2) - **This is the "continuous hardening" enforcement** [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
6. Quality gates (Slice 2.3) - **Prevents "move on before it works"** [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)
7. Project ingest (Slice 3.2) - **Massive productivity unlock**

### Force Multipliers
8. Perplexity research (Slice 3.1) - **Strategy validation before expensive execution**
9. IR + refactor pipeline (Slices 3.3, 4.1) - **Enables automated large-scale changes**
10. Parallelization (Slice 4.2) - **10x speed improvement**

### Quality of Life
11. Stack bibles (Slice 5.1) - **Consistency across projects**
12. Admin dashboard (Slice 5.2) - **Observability**
13. Self-heal (Slice 4.3) - **Long-term maintenance**
14. Auto-learning (Slice 5.3) - **Continuous improvement**

## Critical Success Factors

**Token Efficiency** - Every slice must respect the 4-8k token target for slices and use DeepSeek first, Gemini only when necessary. This is your cost control. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

**Linear as Truth** - From Slice 2.1 onward, Linear must be the authoritative state for all work. Never allow router state to diverge. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

**Quality Gates** - Slice 2.3 is non-negotiable - implement early to prevent downstream problems. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

**Remote Execution** - Given corporate constraints, all linting/testing must run on Fly, not locally. Build this into Slice 2.3. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

## What Makes This Different

This isn't a "build the router, then add features" approach. Each slice delivers **complete user value**: by the end of Phase 2, you have automated work selection, Linear tracking, and quality enforcement - a fully functional system that's already useful. Phases 3-5 are optimization and sophistication, not prerequisites. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

The key insight: **start with the control flow (Linear + quality gates + capacity rules) before adding intelligence (Perplexity, IR, learning)**. A dumb router that enforces your process beats a smart router that lets work slip through. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/debca7d6-6019-45a6-b847-be50c6cb271f/paste.txt)

---

Based on the comprehensive requirements document, I'll break down how to thin slice this router system and prioritize it to completion. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

## Thin Slicing Strategy

The system should be built in **vertical slices** that deliver end-to-end value incrementally, not horizontal layers. Each slice gets you from "idea" to "working feature" without building infrastructure you don't immediately need. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 1: Core Router Foundation (Week 1-2)
**Goal: Single working path from VS Code to DeepSeek with basic routing**

- **Slice 1.1**: Minimal FastAPI/Express service on Fly.io with `/chat` endpoint accepting OpenAI-style requests [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 1.2**: Basic token estimation (chars/4) and single-rule routing: <4k → DeepSeek V3, else → Gemini Flash [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 1.3**: Simple VS Code extension with one command: "AI: Chat" that posts to your router [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 1.4**: In-memory request logging (job_id, tokens, provider, outcome) written to SQLite [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: You can highlight code in VS Code, ask a question, and get a DeepSeek response routed through Fly.io with cost <$0.01 per request. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 2: Project Intelligence (Week 3-4)
**Goal: Router understands codebases and can plan refactors**

- **Slice 2.1**: `index_project` skill: walk repo, extract files/sizes/languages, compute token estimates [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 2.2**: `build_ir_from_index` skill: use Gemini to compress large context into JSON IR (modules, symbols, anchors) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 2.3**: `global_plan_deepseek` skill: R1 takes IR + goal → structured plan with slices [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 2.4**: VS Code command "AI: Refactor Project" triggers workflow: index → IR → plan → display in UI [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: You can point at a 50-file repo and get a refactor plan in <60 seconds for ~$0.05. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 3: Linear Integration (Week 5)
**Goal: Linear becomes the state spine**

- **Slice 3.1**: `linear_sync` skill: create issue, update status, post comment via GraphQL [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 3.2**: Workflow step: create Linear issue for any refactor job, link job_id [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 3.3**: Status gate rules: only mark "done" when tests pass + optional human review [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: Every project refactor creates a Linear issue that tracks progress and enforces quality gates. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 4: Execution Engine (Week 6-7)
**Goal: Router can actually apply code changes safely**

- **Slice 4.1**: `slice_and_edit_deepseek` skill: take one slice (4-8k tokens) → DeepSeek V3 → unified diff [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 4.2**: Parallel slice execution with RPM throttling (respect 10k RPM DeepSeek limit) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 4.3**: `run_tests` skill (remote on Fly to bypass corporate lockdown): sync workspace → run tests → capture results [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 4.4**: Apply diffs in VS Code, run tests, update Linear with results [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: Complete feature workflow: idea → plan → edit multiple files → tests pass → Linear marked done, all in <2 minutes. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 5: Strategy Layer (Week 8)
**Goal: Perplexity front-door for complex decisions**

- **Slice 5.1**: `research_planning_perplexity` skill: external research + strategy JSON [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 5.2**: Project ingest workflow: idea → Perplexity strategy → DeepSeek plan → Linear provisioning [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 5.3**: Project self-heal workflow: fetch Linear state → Perplexity diagnosis → restructure [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: New project setup takes 30 seconds and produces a fully structured Linear backlog with milestones and acceptance criteria. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 6: Intelligence Loop (Week 9-10)
**Goal: System learns and optimizes itself**

- **Slice 6.1**: Telemetry analysis: daily job to identify failure patterns from SQLite logs [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 6.2**: Rule suggestion: DeepSeek R1 proposes new rules based on patterns → admin UI for approval [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 6.3**: Auto-optimization: adjust provider mix based on cost vs. success rate over rolling windows [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: Router proposes rule changes after 50+ jobs that demonstrably reduce failures or cost. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

### Phase 7: Stack Bibles & Polish (Week 11-12)
**Goal: Production-ready with stack-specific knowledge**

- **Slice 7.1**: Build skill bibles for your core stacks (Python, Vite/Vitest, Cloudflare, Discord) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 7.2**: Load stack configs, inject prompts/constraints into workflows [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 7.3**: Admin UI: config explorer, job dashboard, usage charts, dry-run mode [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- **Slice 7.4**: Scale-to-zero optimization: 5-min idle timeout, aggressive caching, compiled policy engine [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

**Success metric**: Router scales to zero when idle, wakes in <500ms, handles 20+ parallel jobs without hitting rate limits. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

## Prioritization Rationale

This ordering follows **value delivery** and **risk reduction**:

1. **Phases 1-2 prove the core concept** without external dependencies (no Linear, no Perplexity) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
2. **Phase 3 adds state management** before you have complex execution to track [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
3. **Phase 4 is highest risk** (code changes) so you want solid logging and Linear integration first [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
4. **Phase 5 adds strategic leverage** once tactical execution works [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
5. **Phase 6 is force multiplier** but requires data from phases 1-5 [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
6. **Phase 7 is polish** and can be done incrementally alongside earlier phases [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

## Work Balance: Features + Continuous Hardening

Per the document's guidance on tech debt, allocate **70% feature / 30% hardening** capacity throughout. This means: [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

- During Phase 4 (execution), immediately create tech-debt issues for any shortcuts (e.g., "proper diff conflict resolution," "rollback on test failure") [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- Bundle 1-2 small hardening tasks with each feature slice when they touch the same code [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
- Run `project_self_heal` after Phase 6 to identify accumulated friction before final polish [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

Never schedule a "hardening sprint" — that's an anti-pattern. Instead, treat quality gates (tests, reviews) as **blocking conditions** in your workflows from Phase 3 onward. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

## Success Criteria for "Done"

The system is production-ready when:

1. You can create a new project from an idea in <30 seconds with structured Linear backlog [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
2. Large refactors (20+ files) complete in <2 minutes with verified tests [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
3. Monthly LLM spend stays under $20 even with heavy use (DeepSeek-first routing) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
4. Router proposes useful rule changes after learning from 50+ jobs [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
5. System scales to zero when idle and wakes fast (<500ms cold start) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)
6. All major workflows enforce quality gates via Linear before marking work "done" [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/0980788e-26e9-46cd-a8c4-83a27ef07e86/paste.txt)

This plan gives you a **competent, self-improving AI router** built iteratively with continuous validation, not a big-bang deployment.