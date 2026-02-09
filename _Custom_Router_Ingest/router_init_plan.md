You’re in a good spot for what you want: Tier‑1 DeepSeek + Gemini is enough budget to justify a small router on Fly.io, with auto‑optimization driven by usage telemetry rather than you hand‑tuning every project. [burnwise](https://www.burnwise.io/ai-pricing/deepseek)

## High‑level architecture

You run a tiny HTTP service (FastAPI/Express/etc.) on Fly.io that exposes a single `/chat` endpoint with an OpenAI‑style schema. VS Code talks only to this endpoint (via either an “OpenAI‑compatible” extension or a thin custom extension), so you never point VS Code directly at DeepSeek/Gemini. Inside the router, you implement: (a) a policy layer that picks DeepSeek vs Gemini based on task type and estimated token footprint, and (b) a usage tracker that records tokens and per‑model spend, then slowly adjusts those policies using simple heuristics (e.g., “if monthly DeepSeek cost > X, bias more to Gemini Flash”). [aifreeapi](https://aifreeapi.com/en/posts/gemini-api-pricing-and-quotas)

Concretely, that means if you highlight a small function and ask for a refactor, the router chooses DeepSeek chat; if you send a huge file + tests + docs, it routes to Gemini Flash/Pro because its per‑M‑token price is almost as low and the context window is forgiving. Over time, the router learns you almost never hit Gemini RPM/TPM ceilings on Tier 1 (hundreds of RPM, 1–2M TPM), so it can be more aggressive about sending big jobs there without you thinking about “quota micro‑management.” [aifreeapi](https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier)

## Why Fly.io over Cloudflare here

Cloudflare Workers technically works fine as a router, but every LLM call becomes: VS Code → Cloudflare → provider, and Cloudflare’s own request caps / pricing will start to matter once you’re making hundreds or thousands of calls per day. Fly.io gives you a small always‑on instance where the limiting factor is your outbound provider spend, not per‑request billing on the proxy itself, which aligns with your “optimize tokens, not HTTP calls” goal. You also get local disk or a tiny SQLite/Redis sidecar for usage logs, which makes auto‑optimization easier than trying to wedge it into KV/durable objects. [gocodeo](https://www.gocodeo.com/post/creating-custom-llm-based-workflows-in-vscode-for-domain-specific-use-cases)

## VS Code integration pattern

To make this usable without ceremony per project, you treat the router as “one fake OpenAI”: same base URL, same `chat/completions` style, one API key. Many generic VS Code assistants let you specify a custom base URL for an OpenAI‑compatible API; if you can’t find one you like, a 100‑line custom extension that registers a `yourAssistant.chat` command and posts the current file/selection to your router is straightforward. Once that’s wired, every project uses the same commands (`Ask router about selection`, `Generate tests`, etc.), and you never touch model‑specific config in VS Code again; all the policy lives on Fly. [github](https://github.com/microsoft/semantic-kernel/issues/4601)

If you want, next step we can sketch the actual routing rules (pseudo‑code) for: “small edits → DeepSeek chat, medium reasoning → DeepSeek R1, long context or multimodal → Gemini Flash/Pro,” plus how to log and auto‑rebalance based on your real token burn patterns.

---

You can treat this as two layers: a routing policy for “everyday” coding, and a batch refactor pipeline for large projects. Here’s a concrete plan you can implement.

## 1. Core routing strategy (per request)

At the router level, every request gets normalized to an OpenAI‑style `chat/completions` call and tagged with a few cheap features: task type, estimated prompt tokens, interactive vs batch. You can infer these from the prompt and payload size.

Policy sketch:

- If estimated prompt + expected output < 4k tokens and the user message looks like “explain / refactor / debug / write tests” for a specific selection or small file → DeepSeek V3 (cheap, strong coding).  
- If prompt size is between ~4k and ~32k tokens or you detect “analyze this file and its tests / multiple related files” → DeepSeek R1 or Gemini 2.0/3 Flash (depending on which you prefer for reasoning vs speed).  
- If prompt size > 32k or includes cross‑cutting architecture / docs / multi‑file context → Gemini Pro / Flash with larger context window.

You can implement this with a simple rules function:

- Compute approximate tokens as `chars / 4` and round.  
- If `tokens > 80_000`, chunk (see section 3).  
- If `tokens < 4_000` → DeepSeek V3.  
- Else if `tokens < 32_000` → DeepSeek R1.  
- Else → Gemini Flash/Pro.

Include a per‑minute counter in memory or Redis so you never exceed about 70–80% of the 10k RPM you have available; if you’re approaching that, temporarily bias toward fewer, larger calls (batching) and queue non‑interactive workloads.

## 2. Auto‑optimization based on usage

Add a tiny telemetry layer in the router:

- For each call, log: timestamp, model, prompt tokens, completion tokens, latency, and a rough task label (`"small_edit"`, `"file_analysis"`, `"project_refactor"`, `"chat"`).  
- Maintain rolling stats per model over the last hour/day/month: tokens and estimated cost using published per‑1M‑token prices for DeepSeek Tier 1 and Gemini paid API. [deepseek](https://deepseek.care/blog/deepseek-api-cost)

Then implement two basic feedback rules that run once every N requests or every few minutes:

- If monthly DeepSeek tokens > your “comfortable budget” and Gemini utilization is low → shift thresholds so more medium‑sized tasks go to Gemini Flash.  
- If RPM utilization for a provider regularly exceeds, say, 70% of allowed RPM, increase chunk sizes (see refactor pipeline) or route non‑urgent tasks to the other provider.

You don’t need ML here; simple thresholds and moving averages give you a self‑tuning router.

## 3. Large project refactor pipeline

For big refactors, treat it as a batch job with three phases: indexing, planning, execution. The goal is to slice context into narrow, model‑friendly chunks so DeepSeek does most of the work, and Gemini only handles genuinely global reasoning.

### 3.1 Indexing and slicing

When you start a “project refactor” from VS Code, send the repo path and high‑level goal to a `/refactor/start` endpoint on the router. The router:

1. Walks the repo and builds an index:
   - Extracts file paths, sizes, and language.  
   - Builds a simple call graph / dependency map where possible (e.g., static analysis for imports/exports, function references).  
   - Computes token estimates per file and per logical unit (e.g., class, module).

2. Groups files into “slices” with tight cohesion and limited size:
   - A slice is usually one main file plus its immediate neighbors (tests, interfaces, closely related modules).  
   - Target each slice to stay under, say, 6–8k tokens of prompt so DeepSeek V3 or R1 can handle it efficiently.  
   - For cross‑cutting changes (like renaming a core type used everywhere), create dedicated slices for each major subsystem rather than one massive prompt.

Store this index (e.g., SQLite on Fly, or small in‑memory structure if the repo isn’t huge) with a refactor job ID.

### 3.2 Planning with a “global brain”

Before editing anything, run a planning step with a global model:

- Use Gemini Pro or DeepSeek R1 with a summarized view of the project:  
  - Include only high‑level signatures (file names, top‑level classes/functions, major modules) and a short sample from each – not full bodies.  
  - Prompt it to produce a refactor plan: ordered list of steps, each step referencing slices by ID and describing the changes (e.g., “Step 3: Update all `UserSession` usages in `auth/*` and `api/*` to new interface, then adjust tests.”).

The output is a structured JSON plan (list of steps, each with slice IDs and instructions). You store that alongside the index.

This way, one “global” call consumes a manageable chunk of tokens, and you don’t repeatedly push the entire codebase.

### 3.3 Executing slices with narrow context

For each plan step:

1. Pull the slice’s files and context from the index.  
2. Build a narrow prompt:
   - System: project goal and current step from the plan.  
   - Context: only the files in this slice, with minimal comments when possible.  
   - Task: “Modify these files to apply step N, keeping behavior consistent with existing tests.”

3. Send to DeepSeek V3 (or R1 if it’s more reasoning heavy).  
4. Apply patch: the router returns unified diffs or full file contents, which your VS Code integration applies to the workspace.

You can run slices sequentially for safety or parallelize them with a per‑minute token budget so you don’t exceed DeepSeek’s 10k RPM cap. For purely mechanical edits, you can aggressively parallelize; for steps that may conflict, process slices that share dependencies in order.

### 3.4 Verification

After each step or after the whole batch:

- Run tests (router can trigger `npm test`, `pytest`, etc. via a CI or an agent you trust).  
- If failures occur, collect logs and re‑prompt a model with only the failing slice plus errors, again keeping context narrow.

This verification loop doesn’t need Gemini unless you’re debugging complex failures; DeepSeek is usually enough.

## 4. Using it from VS Code

To keep it frictionless:

- Have a single VS Code command “AI: Project Refactor” that just hits `/refactor/start` with the current workspace root and a user‑provided description of the goal.  
- Track progress in a side panel: show the plan steps and mark them as pending/running/done.  
- For regular usage, your existing `Ask assistant about selection` and `Generate tests` commands just call `/chat`, which uses the routing policy from section 1.

Once configured, you never switch models manually in VS Code: your router inspects input size and task type, checks recent token burn and RPM, and picks the cheapest feasible lane that won’t push you into rate‑limit hell.

If you want, I can next sketch concrete JSON schemas and a rough FastAPI routing function that does: token estimation → model choice → log and adjust thresholds, plus an example slice definition format for the refactor pipeline.

---

Here’s a minimal, concrete way to model both skills so they plug into your router’s workflows and logging.

## Perplexity research skill

### Skill definition

```json
{
  "id": "research_planning_perplexity",
  "kind": "llm",
  "description": "External research and strategy suggestions using Perplexity.",
  "provider": "perplexity",
  "model": "sonar-reasoning",
  "endpoint": "https://api.perplexity.ai/chat/completions",
  "inputs": ["goal", "constraints", "project_context"],
  "outputs": ["research_summary_id"],
  "options": {
    "max_tokens": 1500,
    "temperature": 0.3
  }
}
```

### Request/response shapes

Router → Perplexity (OpenAI‑style):

```json
POST /chat/completions
{
  "model": "sonar-reasoning",
  "messages": [
    {
      "role": "system",
      "content": "You are a senior engineer. Given the goal and context, outline patterns, risks, and a stepwise strategy in compact bullet points and JSON."
    },
    {
      "role": "user",
      "content": "Goal: migrate from in-memory sessions to JWT.\nConstraints: zero downtime, legacy clients.\nProject context: Node/TS monolith, Express, custom auth middleware."
    }
  ],
  "temperature": 0.3,
  "max_tokens": 1500
}
```

Router internal normalized output (what you store):

```json
{
  "research_summary_id": "res_001",
  "goal": "migrate from in-memory sessions to JWT",
  "raw_text": "…Perplexity's answer…",
  "structured": {
    "patterns": [
      "Introduce JWT utilities as a separate module.",
      "Use middleware for verification."
    ],
    "risks": [
      "Token revocation",
      "Clock skew"
    ],
    "suggested_steps": [
      "Add JWT module",
      "Dual-run sessions + JWT",
      "Cut over and remove sessions"
    ]
  },
  "meta": {
    "provider": "perplexity",
    "model": "sonar-reasoning",
    "created_at": "2026-02-09T20:15:00Z"
  }
}
```

Your workflows then take `research_summary_id` and feed `structured.suggested_steps` into DeepSeek R1’s planning prompt.

## Linear sync skill

### Skill definition

```json
{
  "id": "linear_sync",
  "kind": "http",
  "description": "Create or update Linear issues for router jobs.",
  "provider": "linear",
  "endpoint": "https://api.linear.app/graphql",
  "inputs": ["action", "project_id", "job_id", "title", "body", "issue_id", "labels", "status"],
  "outputs": ["issue_id"],
  "options": {
    "auth_env_var": "LINEAR_API_KEY"
  }
}
```

### Example GraphQL operations

Create issue:

```json
POST /graphql
{
  "query": "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
  "variables": {
    "input": {
      "teamId": "team-uuid",
      "title": "Refactor auth: migrate sessions to JWT",
      "description": "Job: job_789\nGoal: ...\nPlan: ...\nRouter logs: https://router.fly.dev/admin/jobs/job_789",
      "labels": ["refactor", "auth"],
      "priority": 2
    }
  }
}
```

Router‑normalized output:

```json
{
  "issue_id": "lin_123",
  "identifier": "AUTH-42",
  "url": "https://linear.app/your-org/issue/AUTH-42",
  "meta": {
    "project_id": "my-node-service",
    "job_id": "job_789",
    "action": "create",
    "created_at": "2026-02-09T20:18:00Z"
  }
}
```

Update issue (e.g., on success/failure of refactor job):

```json
POST /graphql
{
  "query": "mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id state } } }",
  "variables": {
    "id": "lin_123",
    "input": {
      "description": "Updated description with latest plan/results…",
      "state": "completed"
    }
  }
}
```

## How they fit into workflows/rules

Workflow snippet using both:

```json
{
  "id": "node_monolith_refactor",
  "steps": [
    {
      "id": "index",
      "skill": "index_project",
      "next": "build_ir"
    },
    {
      "id": "build_ir",
      "skill": "build_ir_from_index",
      "next": "research"
    },
    {
      "id": "research",
      "skill": "research_planning_perplexity",
      "inputs_from": {
        "goal": "workflow_input.goal",
        "constraints": "workflow_input.constraints",
        "project_context": "project_metadata"
      },
      "next": "global_plan"
    },
    {
      "id": "global_plan",
      "skill": "global_plan_deepseek",
      "inputs_from": {
        "ir_id": "build_ir.ir_id",
        "goal": "workflow_input.goal",
        "research_summary_id": "research.research_summary_id"
      },
      "next": "create_linear_issue"
    },
    {
      "id": "create_linear_issue",
      "skill": "linear_sync",
      "inputs": {
        "action": "create",
        "project_id": "workflow_input.project_id",
        "job_id": "workflow.job_id",
        "title": "Refactor: {{ workflow_input.goal }}",
        "body": "Plan: {{ global_plan.plan_id }}\nLogs: {{ workflow.logs_url }}",
        "labels": ["refactor", "router"],
        "status": "todo"
      },
      "next": "slice_and_edit_loop"
    }
  ]
}
```

Global rule example to enforce Linear logging on “corporate” projects:

```json
{
  "id": "corporate_projects_require_linear",
  "scope": "global",
  "priority": 80,
  "when": {
    "project_tag": ["corporate"],
    "task_type": ["project_refactor", "large_change"]
  },
  "then": {
    "require_workflow_step": "create_linear_issue"
  }
}
```

That gives you:

- Perplexity as a structured research/planning skill whose output feeds DeepSeek/Gemini.  
- Linear as a side‑effect skill to synchronize refactor jobs with your project management.  
- Both wired into your existing skills/workflows/rules system, with the router logging each invocation the same way as any other skill.

---

Yes, you can fold those constraints into this system, but not by literally hosting “portable npx/PowerShell” on Fly; instead, you turn them into **remote skills** that give you similar outcomes without fighting local lockdowns.

## What else to build into the router

You can add a few high‑leverage capabilities:

### 1. Remote command/execution skills

You can’t fix locked‑down corporate Windows from Fly, but you can move blocked workflows server‑side:

- **“npx‑like” skill:** a skill that runs CLIs in a container on Fly and returns results (lint, format, test, codegen).  
  - Example skills: `run_npm_script`, `run_codegen`, `run_tests_remote`.  
  - These run in your Fly app or a sidecar container that mounts a repo snapshot (pushed from VS Code or fetched from Git) and executes the commands there, then streams logs back.

- **“PowerShell‑like” skill:** if you have scripts that were normally run in PowerShell (deployment helpers, maintenance, etc.), you can port them to Node/Python/bash and expose them as router skills instead of local PS scripts.

Locally, VS Code just issues “run tests” / “run lint” via the router, and the router executes them in its own environment, sidestepping locked‑down npx/PowerShell on the corporate Windows image.

### 2. Repo sync and ephemeral workspace

To make remote execution work:

- Add a `sync_project` skill:
  - For personal projects, you might push via git; for corporate repos, you can push a tarball/zip from VS Code to the router over HTTPS.  
  - The router unpacks into a temp directory and tags it with `project_id + commit_hash`.

Then execution skills take `workspace_id` instead of assuming local disk, so they can run commands against that snapshot.

### 3. Policy‑aware “tool planner” on top of skills

Once you have:

- LLM skills (DeepSeek, Gemini, Perplexity),  
- External skills (Linear, Perplexity),  
- Remote command skills (tests, lint, codegen),

you can add a meta‑planner skill:

- `orchestrate_change` skill (DeepSeek R1) that, given a goal and the available skills list, decides which skills to chain (e.g., plan → edit slices → run tests → update Linear).  
- It uses the same rules/workflow system, but you give it introspection into “which skills exist and what they accept,” so it can propose new workflows semi‑automatically.

### 4. Corporate‑safe artifact store

You can add a small artifact store in the router (Fly volume or S3‑compatible bucket) with skills like:

- `save_artifact` / `get_artifact` for logs, plans, diffs, test reports.  
- Rules can then say “for corporate projects, always store diff + test report as artifacts, and link them in Linear.”

This means even if local disk is constrained, you have a persistent, external record of what your agents did.

***

So: you don’t literally run “portable npx.exe” or PowerShell on Fly, but you **encode the workflows they represent** as remote skills—command runners, codegen, tests—and let the router orchestrate them with the same rules/workflows framework you’re already designing.

---

Two big things to plan for: **governance/observability** and **escape hatches/extensibility**.

## Governance and observability

You want to see and steer this thing like a small production system, not just a helper.

Build in:

- A **job dashboard**: list recent jobs (per project), their plan, steps, provider mix, and outcomes, with links to logs and artifacts. This becomes your single pane of glass for “what did my agents touch this week.”  
- **Diff and test visibility**: for each slice, store the unified diff and test results as artifacts and link them from the dashboard and Linear issues. Being able to quickly audit “what changed when the agent refactored X” is huge.  
- **Cost and usage view**: simple charts/text stats per provider (DeepSeek/Gemini/Perplexity) over time with token and cost estimates, so you can see if a new rule or workflow quietly doubled spend. Use the log schema you already have to drive this.  

Plan for at least basic role separation later: e.g., you as “admin” can change global rules; a future collaborator might only adjust per‑project configs.

## Escape hatches and extensibility

You’re deliberately building a system that will surprise you; you need ways to override and extend without surgery.

Scope in:

- **Manual override modes** in VS Code: for any request, be able to choose “force DeepSeek,” “force Gemini,” or “bypass workflows, just chat.” That’s your safety valve when the policy engine is wrong but you don’t want to rewrite rules mid‑flow.  
- A **“dry run” mode** for workflows: run through planning and slice selection, but stop before applying patches; instead, show planned edits/tests/Linear updates in the UI so you can approve or tweak.  
- A **plugin/skill registry**: treat skills as pluggable modules (even just loading JSON from a `skills.d` directory). When future you wants to add “call Jira” or “hit some weird internal REST API,” you can drop in a new skill definition and a small handler without touching core routing logic.  
- **Versioned policies**: include a `version` on rules/workflows and store old versions; log which version was active for each job. That gives you a way to roll back a bad policy change and to understand “this refactor went sideways because v3 of the workflow was too aggressive.”

If you build with those in mind, you get a router that can grow with you: you can keep layering in new providers, corporate workarounds, and learned rules without turning the whole thing into a monolith you’re afraid to touch.

---

You can fold Linear, Jules, and optional Cursor into this as first‑class citizens of the router and treat Linear as the **state spine** for everything. [linear](https://linear.app/docs/assigning-issues)

## Linear as source of truth

Model Linear explicitly in your router:

- Every **project** in your router config can map to a Linear **team** or **project** ID (or both), plus default labels/status for work created there. [morgen](https://www.morgen.so/blog-posts/linear-project-management)
- Each router **job** (refactor, feature, batch fix) has an optional `linear_issue_id`; workflows can enforce “create or attach to Linear issue before doing anything big.”

You extend the `linear_sync` skill:

- Support `create`, `update`, `comment`, `transition`, and `assign`.  
- Use Linear’s assignment and delegation model so you can assign to yourself, a teammate, or an **agent** (Jules, Cursor) as the “worker” while you remain primary assignee. [linear](https://linear.app/docs/private-teams)

Example `linear_sync` actions:

```json
{
  "action": "create_and_assign",
  "assignee": "user:you",
  "agent": "agent:jules", 
  "team_id": "team-uuid",
  "labels": ["refactor", "router"],
  "status": "todo"
}
```

## Jules integration

Jules gives you an external coding agent that already knows how to work with repos and issue trackers. [linearb](https://linearb.io/integrations/google-jules)

In the router:

- Add a `jules_session` skill that can:
  - Create a Jules **session** bound to a repo/source and a Linear issue.  
  - Post activities (instructions, status) and poll for results.  

You wire it so that for some issues (by label/team), the router workflow is:

1. `linear_sync` create issue in the right team with a description of the goal.  
2. `jules_session` start a Jules session, giving:
   - Repo URL / source.  
   - The Linear issue ID.  
   - A concise plan from your router (DeepSeek/Perplexity).  
3. Optionally, let Jules do more of the code changes, while your router:
   - Monitors progress via Jules APIs.  
   - Updates Linear issue with activity logs.  
   - Still runs verification steps (tests, etc.) and enforces your global rules.

You can also plug Jules into your skills/workflows layer as an alternative to “router‑local refactor” for some projects or teams.

## Optional Cursor API lane

If/when Cursor exposes a useful automation API (or even just “custom API key” plus Cursor‑side workflows), you treat it like another agent:

- Define a `cursor_task` skill that:
  - Attaches to a Cursor workspace / project.  
  - Sends a structured task (goal, context, maybe relevant files) to Cursor.  
  - Receives back diffs or branch info.

In terms of Linear:

- Your router can automatically **assign** Linear issues to the “Cursor agent” or a human owner, based on team or label rules. [linear.docs.lagu](https://linear.docs.lagu.na/misc/assigning-issues-to-others)
- You can also use Linear Automations to route issues with “cursor” label to a specific team or agent, and your router respects that mapping when deciding who to call. [linear](https://linear.app/integrations/ai-clients)

So for example:

- Team “Platform” project: default agent is “Jules”; router uses `jules_session`.  
- Team “Product” project: default agent is your router itself using DeepSeek/Gemini.  
- Some experiments: issues labeled “cursor” get routed to `cursor_task` instead, and the router mostly just tracks and verifies.

## Putting it together

In your workflows, “Linear as source of truth” becomes explicit:

- Every major operation (refactor, feature) either **starts from** a Linear issue or **creates one and assigns** it appropriately.  
- The router’s job ID is always linked to a Linear issue ID.  
- Decisions about whether to use your router’s own DeepSeek/Gemini skills, Jules, or (optionally) Cursor are encoded in rules keyed on:
  - Linear team / project,  
  - Labels,  
  - Assignee/agent fields.

This keeps your whole AI agent mesh coherent: Linear is the ledger, the router is the brain, Jules/Cursor/LLMs are interchangeable hands.

---

You can absolutely bake all of that in. The pattern is: Perplexity as front‑door strategist, DeepSeek/Gemini as planners/executors, and Linear as the living spec and state machine for every project. [endgrate](https://endgrate.com/blog/using-the-linear-api-to-get-issues-(with-javascript-examples))

## New project / idea ingestion

When you start a new project or major idea, you run a “Project Ingest” workflow that always begins with Perplexity and ends with a structured Linear plan.

From VS Code or a small UI, you trigger `/project/ingest` with:

- Raw idea text.  
- Initial scope/constraints.  
- Target Linear team/project (or “auto‑pick”).

The workflow:

1. **Project/issue context build:** the router pulls any existing Linear issues for that project/team, plus basic metadata: current milestones, priorities, and statuses. [morgen](https://www.morgen.so/blog-posts/linear-project-management)
2. **Perplexity strategy call:** `research_planning_perplexity` gets:
   - Idea, constraints, and the Linear snapshot.  
   - Prompted: “Given current scope and these issues, what’s the best way to structure this project into milestones and tasks?”  
3. **Strategy → plan conversion (DeepSeek):** DeepSeek R1 turns the Perplexity output into a normalized plan:
   - Milestones with goals.  
   - Issues under each milestone with dependencies, labels, and acceptance criteria.  
4. **Linear provisioning:** `linear_sync`:
   - Creates or updates the main project/epic.  
   - Creates child issues for each plan item, setting:
     - Status (e.g., “todo”),  
     - Priority, labels, and tags,  
     - Long descriptions containing enough context for someone to complete the task from scratch, including acceptance tests. [linear](https://linear.app/docs/assigning-issues)
   - Links issues to the correct milestones and relationships (blocks/blocked‑by).  

Result: every new project or idea becomes a properly structured Linear tree, grounded in Perplexity’s strategy and DeepSeek’s structured plan, before any code is touched.

## Existing projects “self‑healing” and restructuring

For existing projects, you run a periodic or on‑demand “Project Restructure” workflow.

Trigger `/project/self_heal` with:

- Project ID (router + Linear).  
- Current goals or pain points.

The workflow:

1. **Scope snapshot:** the router:
   - Pulls recent Linear issues (open/closed), status distribution, and milestone progress. [morgen](https://www.morgen.so/blog-posts/linear-project-management)
   - Optionally builds a code IR for the repo (modules, change anchors, risks) as before.  
2. **Perplexity diagnosis:** ask Perplexity:
   - “Given this issue structure and these goals, how should we restructure work? What’s redundant, missing, mis‑prioritized?”  
3. **DeepSeek restructuring plan:** DeepSeek R1 converts that into:
   - Merges/splits of issues,  
   - New milestones or phases,  
   - Explicit refactor/cleanup tasks,  
   - A suggested new ordering, preserving dependencies.  
4. **Linear reconcile:** `linear_sync`:
   - Updates statuses, priorities, labels, and descriptions.  
   - Creates new “self‑healing” issues where needed (e.g., “Consolidate redundant auth tickets”).  
   - Closes or de‑prioritizes dead work, but only when the plan says so and tests/code state support it.  

You can run this occasionally or tie it to big events (e.g., after a major refactor job).

## Thin slicing for token efficiency

Yes: you use the same “slice” concept in both code and project planning.

At the project level:

- Perplexity + DeepSeek define **work slices**: coherent chunks of effort (a few related issues) that can be tackled end‑to‑end with limited context.  
- The router:
  - Groups Linear issues into such slices, keyed on scope (same module, same feature, same milestone).  
  - For each slice, you treat “context” as:
    - A small IR of the relevant code +  
    - The subset of related Linear issues.  

At the code level:

- Within each work slice, you only send the relevant files + IR + slice issues to DeepSeek/Gemini, instead of the whole repo and whole backlog.  
- This keeps LLM calls in manageable token ranges while still honoring the project structure.

Your rules can enforce this:

- “For planning and execution, always operate at slice granularity; never send the entire project backlog or codebase unless explicitly requested.”

## Linear as live status and gatekeeper

You can enforce “don’t move on until it really worked” by making Linear both the **gate** and the **log**.

For each refactor/feature issue:

1. Router workflow sets it to “in progress” and logs planned steps in the description and comments.  
2. During execution:
   - After each step, the router:
     - Posts a comment summarizing what changed (branch/commit, files, tests).  
     - Updates a custom field or label (e.g., “agent‑status: step‑2/5”).  
3. Verification:
   - Run tests and checks; if anything fails:
     - Comment with failures.  
     - Keep status in “in progress” or set to a designated “blocked/failing” state. [linear](https://linear.app/docs/private-teams)
4. Only when:
   - All planned steps are completed,  
   - Tests pass,  
   - (Optionally) manual review is marked “accepted,”  

does the workflow transition the issue to “done” or your equivalent, via `linear_sync`. The router rules can insist:

> “For labeled issues [refactor, migration, core], only transition to done when tests_passed=true AND human_review_accepted=true.”

Because your router always works through Linear, you get:

- Constant updates (comments, statuses, labels) as the single source of truth.  
- A clear trail for auditing.  
- Automatic prevention of “move on prematurely.”

All of this nests cleanly into the config structure you already have: add a “project_ingest” and “project_self_heal” workflow, tighten your `linear_sync` skill, and add rules that require issue status + tests + review before status transitions.

---

Here’s the full, end‑to‑end plan as a concrete architecture you can implement and extend.

***

## 1. Core stack and deployment

You run a **router service** on Fly.io that exposes:

- `/chat` – OpenAI‑style chat for day‑to‑day coding.  
- `/refactor/*` – project‑wide refactor endpoints.  
- `/project/*` – project ingest / self‑heal endpoints.  
- `/admin/*` – config and audit UI.

The router is an HTTP app (Node or FastAPI) listening on an internal port (e.g., 8080) with Fly Machines configured for **autostop/autostart** so it can scale to zero. [fly](https://fly.io/docs/launch/autostop-autostart/)

Fly configuration:

- `auto_stop_machines = "stop"`  
- `auto_start_machines = true`  
- `min_machines_running = 0` [fly](https://fly.io/docs/blueprints/autoscale-machines/)

Inside the app:

- Maintain an idle timer (e.g., 15 minutes) that `process.exit(0)`s on inactivity. [jacobparis](https://www.jacobparis.com/content/fly-autoscale-to-zero)
- Provide a `/sleep` endpoint to shut down on demand.  

VS Code talks **only** to the router over HTTPS.

***

## 2. Providers and roles

You treat models and tools as providers with distinct roles:

- **DeepSeek (Tier 1):**  
  - R1: global reasoning, refactor/architecture planning. [api-docs.deepseek](https://api-docs.deepseek.com/quick_start/pricing)
  - Chat/V3: tactical coding, small/medium multi‑file edits. [burnwise](https://www.burnwise.io/ai-pricing/deepseek)

- **Gemini API (paid):**  
  - Flash/Pro: large‑context sweeps, cross‑file analysis, multimodal, big repo understanding. [aifreeapi](https://www.aifreeapi.com/en/posts/gemini-api-pricing-and-quotas)

- **Perplexity API:**  
  - Research and strategy: “What is the best way to do X given this backlog/code shape?”  

- **Linear API:**  
  - Source of truth for projects: issues, statuses, priorities, labels, milestones, teams. [morgen](https://www.morgen.so/blog-posts/linear-project-management)

- **Optional agents (Jules, Cursor):**  
  - External executors for some issues; router delegates work and keeps Linear in sync. [linear](https://linear.app/integrations/ai-clients)

All providers are accessed from the router; Cloudflare Workers can be kept purely as edge shims if needed.

***

## 3. Config: rules, workflows, skills

You define three main config types as JSON/TOML:

### 3.1 Global rules

Global rules apply to all projects:

- Preferred provider/model per task type and token range.  
- Guardrails (e.g., “no auto‑edits in infra paths,” “only mark done when tests+review pass”).  
- Linear conventions (e.g., “corporate projects must have issues for any large refactor”).

Example:

- `prefer_deepseek_small_edits`  
- `use_r1_for_planning`  
- `avoid_infra_edits` [canopywave](https://canopywave.com/blog/why-use-deepseek-api-features-costs-and-a-real-comparison)

### 3.2 Per‑project config

Each repo has a `router.config.json`:

- `project_id`  
- language/framework metadata  
- `default_workflow` id (e.g., `node_monolith_refactor`)  
- project‑specific rules (e.g., legacy modules read‑only).  

You also store:

- Linear team/project IDs to map `project_id` → Linear.  
- Project tags (e.g., `["corporate"]`) to drive rules.

### 3.3 Skills

Skills are atomic capabilities:

- LLM skills (DeepSeek, Gemini, Perplexity).  
- External API skills (Linear sync, Jules session, Cursor task).  
- Router internal skills (index repo, build IR, run tests, sync project to Fly).

Each skill definition includes:

- `id`, `kind`, `provider`/`entrypoint`, `inputs`, `outputs`.  
- Optional `prompt_template_id` for LLM calls.

Key skills:

- `index_project` – walk repo, build file/dependency map, estimate tokens.  
- `build_ir_from_index` – build compact IR (modules, symbols, anchors, risks).  
- `global_plan_deepseek` – DeepSeek R1 multi‑step plan.  
- `slice_and_edit_deepseek` – DeepSeek chat edits a slice.  
- `large_context_analysis_gemini` – Gemini Flash/Pro to produce IR from big contexts. [api-docs.deepseek](https://api-docs.deepseek.com/quick_start/pricing)
- `research_planning_perplexity` – external research & strategy skill. [endgrate](https://endgrate.com/blog/using-the-linear-api-to-get-issues-(with-javascript-examples))
- `linear_sync` – create/update/comment/assign/transition Linear issues. [linear](https://linear.app/docs/assigning-issues)
- `jules_session` – start/manage Jules work sessions for an issue. [linearb](https://linearb.io/integrations/google-jules)
- `cursor_task` (optional) – delegate specific issues to Cursor as an external agent.  
- `run_tests` – run tests remotely on synced workspace.  
- `sync_project` – push repo snapshot to Fly ephemeral workspace.

***

## 4. Workflows

Workflows compose skills into multi‑step procedures.

### 4.1 New project / idea ingest

Workflow `project_ingest`:

1. **Pull Linear context** (`linear_sync` diagnostic mode):  
   - Fetch existing issues/milestones for team/project; build a backlog snapshot. [morgen](https://www.morgen.so/blog-posts/linear-project-management)

2. **Perplexity strategy** (`research_planning_perplexity`):  
   - Input: idea text, constraints, Linear snapshot (summary).  
   - Output: patterns, risks, suggested milestones and chunks.

3. **DeepSeek plan** (`global_plan_deepseek`):  
   - Turn Perplexity’s output into a structured plan:  
     - Milestones,  
     - Issues per milestone,  
     - Dependencies, priorities, acceptance criteria.

4. **Linear provisioning** (`linear_sync`):  
   - Create/ensure main project/epic.  
   - Create issues for each plan item:  
     - Attach to milestones and team.  
     - Set status (e.g., `todo`), priority, labels/tags (e.g., `refactor`, `agent`).  
     - Long descriptions with context sufficient to complete from scratch.

5. **Optional agent assignment**:  
   - Based on rules:  
     - Some issues assigned to you,  
     - Some to “agent:jules” or “agent:router” or “agent:cursor”. [linear](https://linear.app/docs/private-teams)

Linear becomes the starting structure for the project.

### 4.2 Existing project self‑heal / restructure

Workflow `project_self_heal`:

1. **Linear snapshot**:  
   - Fetch open/closed issues, milestones, current statuses, and tags for the project/team. [linear](https://linear.app/docs/assigning-issues)

2. **Perplexity diagnosis**:  
   - “Given this structure and goals, what should be merged, split, reprioritized? What work patterns improve flow?”  

3. **DeepSeek restructuring plan**:  
   - Proposed: merges/splits, new milestones/stages, new cleanup/refactor tickets, ordering by impact and dependencies.

4. **Linear reconcile** (`linear_sync`):  
   - Close or de‑prioritize stale work.  
   - Create “meta” issues (e.g., “Consolidate auth tickets”, “Refactor legacy core”).  
   - Adjust statuses and priorities.  
   - Attach updated descriptions/acceptance criteria.

You can run this on demand or periodically.

### 4.3 Project refactor pipeline

Workflow `node_monolith_refactor` (adapted per language):

1. `index_project` → `build_ir_from_index` – code structure snapshot.  
2. Optional `research_planning_perplexity` – external patterns/risks.  
3. `global_plan_deepseek` – multi‑step refactor plan referencing IR anchors.  
4. `linear_sync` – create/update the driving Linear issue, add plan summary.  
5. `slice_and_edit_loop` – for each slice:  
   - Narrow prompt (IR + slice files + relevant issues).  
   - DeepSeek V3 edits.  
6. `run_tests` – remote tests.  
7. `linear_sync` – update issue status/comments.

Thin slicing is applied:

- Slices keep prompts under ~6–8k tokens (or whatever target you choose), increasing token efficiency.  
- Wide context operations (Gemini Flash/Pro) only run at IR‑building or global planning stages. [canopywave](https://canopywave.com/blog/why-use-deepseek-api-features-costs-and-a-real-comparison)

***

## 5. Policy engine and auto‑learning

### 5.1 Per‑request policy resolution

For each incoming call (from VS Code or internal workflows):

1. Identify `project_id`, `task_type`, relevant paths/files, and approximate token size.  
2. Load global rules + skills + workflows.  
3. Load project config + rules.  
4. Merge into an **effective policy** (rules sorted by priority, workflow selection, and skill overrides).  
5. Execute the selected workflow or direct skill call under that policy (provider, model, guardrails).

Manual overrides (from VS Code):

- Force provider/model ([DeepSeek, Gemini, Perplexity]) for a given request.  
- Bypass workflows (“raw chat mode”).

### 5.2 Logging and learning

Each skill invocation writes a log including:

- Job/workflow/skill IDs.  
- Provider, model, tokens, latency.  
- Rule IDs in effect.  
- Outcome (success/partial/failure, error summaries).  
- Human feedback (e.g., patch accepted/rejected).  

Periodic “maintenance” skill analyzes logs and:

- Identifies recurring failure→fix patterns (e.g., certain paths need DeepSeek R1 + manual review rather than V3 auto‑edit).  
- Proposes new or updated rules as JSON snippets.  

You review and accept rules via the admin UI; new rules take effect while old versions remain stored for rollback.

***

## 6. Linear as hard gate and live ledger

Linear is the **source of truth**:

- Every significant job is attached to a Linear issue.  
- Workflows can require “issue exists and is in status X” before doing anything.  
- Status transitions are governed by rules:

Example rule:

- For issues labeled `["refactor", "core"]`:
  - Must pass tests (`tests_passed=true`).  
  - Must have human review accepted (`human_review=true`).  
  - Only then may `linear_sync` transition status to `done/complete`. [linear](https://linear.app/docs/private-teams)

During execution:

- Router posts comments after each major step with:  
  - Summary of changes.  
  - Links to artifacts (diffs, IR, logs).  
  - Current step progress.  

At completion:

- Router updates issue status, labels, and description with final state and verification details.

***

## 7. Admin and observability

The router exposes `/admin` endpoints and UI:

- Config views: show global rules, workflows, skills; per‑project configs.  
- “Effective policy” inspector: given `project_id` + `task_type` + optional path, show which rules and workflow/skills would be used.  
- Job dashboard: list recent jobs by project, with status, provider mix, and links to Linear issues and artifacts.  
- Usage/cost: high‑level token and cost estimates per provider over time. [aifreeapi](https://aifreeapi.com/en/posts/gemini-api-pricing-and-quotas)

You can also:

- Enable “dry run” for workflows: show planned steps/diffs/tests in UI before applying patches.  
- Add role distinctions later (admin vs project‑only control).

***

## 8. Optional remote execution / corporate workarounds

To work around locked‑down Windows (blocked PowerShell/npx):

- Add `sync_project` to send a snapshot of the repo to Fly.  
- Add `run_command`/`run_tests`/`run_npm_script` skills that operate in the Fly workspace.  

Your workflows call these remote skills instead of local scripts, so:

- Lint, tests, codegen, etc. all run in your own environment.  
- Linear issues and router logs reflect remote commands and their outputs.

***

This plan gives you:

- A central router brain on Fly.  
- Linear as the authoritative project ledger.  
- Perplexity as the strategic front door for new ideas and restructuring.  
- DeepSeek/Gemini for planning and execution, thin‑sliced for token efficiency.  
- Jules/Cursor as optional external hands for particular teams or projects.  
- A policy/learning layer that lets the whole system get smarter over time without losing control or observability.

---

Here's the fully optimized version—lean, fast, and designed to evolve without technical debt.

***

## 1. Architecture

### Single fast service on Fly.io

- **One app**, not microservices: router + skills + policy engine in a single process (Node/Bun or FastAPI)—simpler ops, lower latency, less network hop tax.
- **Scale‑to‑zero with aggressive idle:** 5‑minute idle timeout instead of 15; Fly wakes it in ~200–500ms on first request, so you only pay for actual work. [fly](https://fly.io/docs/launch/autostop-autostart/)
- **In‑memory caching:** global rules, workflows, skills loaded once at startup and cached; project configs cached with a 30‑second TTL or invalidated on explicit `/admin/reload`.
- **SQLite on Fly volume for logs/artifacts:** single‑file DB, no external Postgres; fast writes, simple queries, easy backups, and zero-config replication if you ever need multi-region.

***

## 2. Providers and routing

### Ruthless cost minimization

- **DeepSeek first, always:** DeepSeek Tier 1 is your default for 90%+ of work; it's cheap ($0.14–0.55/M tokens cached) and strong on code. [api-docs.deepseek](https://api-docs.deepseek.com/quick_start/pricing)
- **Gemini only when absolutely necessary:** for prompts > 32k tokens or explicitly multimodal/cross‑cutting; otherwise you're paying more for no gain. [aifreeapi](https://www.aifreeapi.com/en/posts/gemini-api-pricing-and-quotas)
- **Perplexity for strategy only, not execution:** treat it like an expensive consultant; call once per project phase, cache the strategy, then let DeepSeek/Gemini execute for weeks without re‑asking.
- **Linear batched updates:** don't post a comment on every tiny step; batch updates per major milestone (e.g., one comment per slice completion, not per file edit). [linear](https://linear.app/docs/assigning-issues)

### Smart routing thresholds

- < 4k tokens → DeepSeek V3.
- 4k–32k tokens, needs reasoning → DeepSeek R1.
- \> 32k tokens or explicit wide-context task → Gemini Flash.
- Research/external patterns → Perplexity, max once per job or phase.

Track rolling 1‑minute token counts per provider; if approaching rate limits, queue non‑interactive tasks instead of failing.

***

## 3. Config as data, compiled once

### Three static files

- `rules.global.json`  
- `workflows.json`  
- `skills.json`

On startup, **compile** them into an in‑memory decision tree:

- Rules indexed by `(task_type, path_prefix, tags)` for O(1) lookups.
- Workflows indexed by `applies_if` patterns.
- Skills indexed by `id`.

Project configs live in repos as `router.config.json`; on first use, they're pulled, merged with globals, and cached.

No database queries per request; policy resolution is just fast hash lookups and priority sorts.

***

## 4. Workflows optimized for minimum LLM calls

### Project ingest (new ideas)

```
1. linear_sync: fetch backlog summary (one API call, returns JSON).
2. research_planning_perplexity: single call with idea + backlog → structured strategy JSON.
3. global_plan_deepseek: R1 call with strategy → milestone/issue tree.
4. linear_sync: batch-create all issues in one GraphQL mutation (or minimal mutations).
```

Result: **3 LLM calls, 2–3 Linear API calls** → fully structured project in Linear, ready to work.

### Project self‑heal

```
1. linear_sync: fetch issues/milestones.
2. research_planning_perplexity: diagnosis + restructure strategy.
3. global_plan_deepseek: restructure plan.
4. linear_sync: batch-update statuses/priorities/descriptions.
```

Result: **2 LLM calls, 2 Linear API calls** → project re‑aligned without manual planning.

### Large refactor

```
1. index_project (local/fast).
2. build_ir_from_index (local).
3. Optional: research_planning_perplexity (if new domain/risk).
4. global_plan_deepseek: R1 with IR → slice plan.
5. linear_sync: create issue + plan summary.
6. Loop over slices (parallelized where safe):
   - DeepSeek V3 edit (thin slice, 4–8k tokens each).
7. run_tests (batched or per-slice).
8. linear_sync: one final comment with results + status transition.
```

Result: **1–2 planning calls + N slice calls (parallelized)** → refactor done, Linear updated once at end, not spammed.

***

## 5. Thin slicing and token efficiency

### Code slices

- Target: **4–8k tokens per slice** (prompt + expected output).
- Slice = 1 main file + immediate neighbors (tests, types, closely related modules).
- Build slices from the dependency graph during `index_project`; store slice metadata (file list, token estimate, module) in the IR.

### Context compression

- When Gemini reads a huge context, it outputs a **compact IR** (modules, symbols, anchors, risks) as JSON, typically 2–5k tokens.
- All subsequent planning and editing steps use only the IR, not raw files, unless executing a specific slice.
- This means one expensive Gemini call can "unlock" dozens of cheap DeepSeek calls.

### Parallelization

- Independent slices (no shared dependencies) execute in parallel.
- You batch-send up to, say, 5 DeepSeek calls at once (limited by your 10k RPM on Tier 1), not sequentially. [burnwise](https://www.burnwise.io/ai-pricing/deepseek)

***

## 6. Linear as the state machine

### Minimal, high-signal updates

Rules enforce:

- Create issue for any job (refactor, feature, fix).
- Post **one comment per workflow stage**, not per step:
  - "Planning complete: 5 slices identified."
  - "Editing complete: 12 files changed, tests pending."
  - "Verified: all tests passed, ready for review."
- Only transition status when:
  - Tests passed (`tests_passed=true`).
  - Human review accepted OR rule says auto-approve for this label/team.

This keeps Linear clean and actionable, not a verbose log dump. [linear](https://linear.app/integrations/ai-clients)

### Issue structure as forcing function

Every Linear issue description includes:

- **Goal** (1–2 sentences).
- **Acceptance criteria** (bulleted, testable).
- **Context**: links to IR, related issues, docs.
- **Agent/owner** assignment (you, Jules, Cursor, or "router"). [linear](https://linear.app/docs/assigning-issues)

The router uses this as the spec; if it's missing or vague, the workflow can refuse to proceed or call Perplexity to clarify before executing.

***

## 7. Auto‑learning loop (optimized)

### Passive capture

Every skill invocation writes a single row to SQLite:

- Columns: `job_id, skill_id, provider, model, prompt_tokens, completion_tokens, latency_ms, outcome, rule_ids_json, human_feedback`.

No complex event streaming; just append‑only log.

### Active learning (batched)

Once per day (or on‑demand via `/admin/learn`):

1. Query SQLite for patterns:
   - High‑failure skills.
   - Rules involved in failures.
   - Repetitive fix sequences.
2. Send summary to DeepSeek R1 or Perplexity:
   - "Propose new rules or workflow tweaks to prevent these patterns."
3. Return JSON snippets of candidate rules.
4. You review in `/admin` UI and click "Accept" or "Reject."

Accepted rules are appended to `rules.global.json` with a new `version`, and the in‑memory cache is invalidated; next request uses the updated policy.

***

## 8. Admin UI (minimal but powerful)

Single‑page app served from `/admin`:

- **Config explorer**: view/edit rules, workflows, skills as JSON in‑browser.
- **Effective policy tester**: enter `project_id + task_type + path` → see which rules match, which workflow runs, which provider/model chosen.
- **Job dashboard**: table of recent jobs with:
  - Linear issue link.
  - Status (planning/editing/testing/done/failed).
  - Provider token usage.
  - Artifacts (IR, diffs, logs).
- **Usage chart**: simple bar chart of tokens/cost per provider per day (rendered from SQLite aggregates).
- **Suggested rules queue**: list of auto‑learned rule candidates awaiting approval.

Built with plain HTML + htmx or a lightweight React bundle; no heavy framework, fast load even on Fly cold start.

***

## 9. VS Code integration (zero ceremony)

### One extension, four commands

- **AI: Chat** → `POST /chat` (OpenAI‑style, router picks provider).
- **AI: Refactor Project** → `POST /refactor/start` with workspace root + goal.
- **AI: New Project** → `POST /project/ingest` with idea text.
- **AI: Self‑Heal Project** → `POST /project/self_heal`.

Extension config (one‑time):

- Router base URL: `https://your-router.fly.dev`
- API key (stored in VS Code secrets).

No per‑project model selection; all policy lives server‑side.

Optional: add a status bar widget showing current job progress and Linear issue link.

***

## 10. Corporate workarounds (lean and hidden)

### Remote execution without drama

- Add `sync_project` skill: VS Code sends tarball to router, unpacked to `/tmp/project_<id>`.
- Add `run_tests`, `run_lint`, `run_codegen` skills that execute in that temp workspace.
- Router streams logs back over HTTP (chunked transfer or SSE).

From Linear/VS Code perspective, these look like any other skill; the fact they're running remotely is invisible.

Optional Cloudflare shim:

- If corporate firewall requires "approved" hostnames, deploy a tiny Worker at `https://tools.yourcorp.internal` that proxies to Fly. [developers.cloudflare](https://developers.cloudflare.com/workers/platform/pricing/)
- All auth/logic stays on Fly; Worker is a 10‑line passthrough.

***

## 11. What this looks like in practice

### Day 1: New feature idea

1. You type idea into VS Code command palette: "Add OAuth2 provider support."
2. Router calls Perplexity: "Best way to add OAuth2 to this Express app given current auth structure?"
3. Perplexity returns strategy; DeepSeek R1 turns it into 8 issues across 2 milestones.
4. Linear now has: epic, milestones, issues with full context, assigned to you or router agent.
5. Total time: ~30 seconds. Total cost: ~$0.02.

### Day 5: Large refactor

1. You pick a Linear issue: "Migrate session auth to JWT."
2. VS Code → router → workflow:
   - Index + IR (5 seconds).
   - DeepSeek R1 plan (10 seconds).
   - 6 slices edited in parallel by DeepSeek V3 (20 seconds).
   - Remote tests run (15 seconds).
   - Linear updated: "Done, 14 files changed, all tests passed."
3. Total time: ~50 seconds. Total cost: ~$0.10.

### Month 3: Self‑healing

1. You notice backlog feels messy; run "Self‑Heal Project."
2. Perplexity + DeepSeek restructure: merge 4 redundant tickets, split 1 mega-ticket, create 2 cleanup tasks.
3. Linear now reflects reality; you work from the updated structure.
4. Total time: ~20 seconds. Total cost: ~$0.03.

***

## 12. What's different from the unoptimized version

| Aspect | Initial plan | Optimized |
|--------|-------------|-----------|
| Deployment | Router + possible microservices | Single fast app, SQLite local |
| Idle time | 15 minutes | 5 minutes; aggressive sleep |
| Provider calls | "Use Gemini often" | DeepSeek 90%, Gemini only when needed |
| Linear updates | Per-step comments | Batched per stage |
| Policy resolution | Database lookups | In-memory compiled decision tree |
| Slice size | Vague "reasonable" | Hard target: 4–8k tokens |
| Parallelization | Sequential by default | Parallel slices where safe |
| Learning | Continuous analysis | Batched daily, human-approved |
| Admin UI | "Built-in" (vague) | Minimal SPA, < 100 KB, fast on cold start |
| VS Code | Multiple model configs | One endpoint, zero per-project config |

Result: **faster, cheaper, simpler to operate, and easier to extend** without adding complexity.

***

This is the plan optimized for **competence over compliance**: you get an AI mesh that thinks strategically (Perplexity), plans efficiently (DeepSeek R1), executes cheaply (DeepSeek V3), scales context when necessary (Gemini), keeps Linear as truth, learns from mistakes, and costs you ~$5–20/month in LLM spend even under heavy use—all while running on Fly's free/cheap tier and waking only when you need it.

---

You’ll get the best results if agents treat **features and tech debt as one unified stream of work**, with explicit rules about when to invest in hardening instead of separate “debt mode” vs “feature mode.” [metamindz.co](https://metamindz.co.uk/post/technical-debt-vs-feature-development-what-to-prioritize)

## Backlog model in Linear

Use a single Linear backlog where **every item is a first‑class issue**, whether it’s a feature, refactor, or bug. You tag tech‑debt items with labels like `tech-debt`, `refactor`, `hygiene`, and group larger efforts into dedicated “Tech Debt” or “Quality” projects on the roadmap. This avoids the classic anti‑pattern where a separate debt backlog is ignored in favor of “real work.” [beyondthebacklog](https://beyondthebacklog.com/2024/01/15/balancing-technical-debt/)

## Capacity and when to harden

The healthy pattern for both humans and agents is **continuous repayment with explicit capacity**, not big hardening sprints. [agilepainrelief](https://agilepainrelief.com/blog/antipattern-hardening-sprint/)

In practice, that looks like:

- Reserve around **20–30%** of iteration capacity for tech debt and refactoring tied to current work, and keep the rest for new features. [nucamp](https://www.nucamp.co/blog/coding-bootcamp-full-stack-web-and-mobile-development-how-to-balance-technical-debt-and-new-feature-development)
- Require that any shortcut taken for a feature immediately spawns a linked Linear issue describing the debt and a suggested payback window. [linkedin](https://www.linkedin.com/pulse/three-strategies-fitting-refactoring-your-sprints-mike-cohn)
- Let your router’s rules enforce: “When an agent picks up a feature, it must also pull in related `tech-debt` issues that block or undermine that feature, up to the reserved capacity.”

You still can schedule occasional “release/hardening” work, but treat big hardening sprints as a **last resort** or maturity step, not the default; they’re widely considered an agile anti‑pattern because they hide quality problems and delay feedback. [swreflections.blogspot](http://swreflections.blogspot.com/2013/01/hardening-sprints-what-are-they-do-you.html)

## Agent‑friendly workflow from Linear

For **feature cranking**:

- Agents pull from a Linear **project/roadmap** that mixes features and tech‑debt issues, ordered by impact and risk. [build.plumhq](https://build.plumhq.com/how-we-use-linear/)
- For each feature issue, the router:  
  - Looks up linked debt/cleanup tickets in the same area (label, component, or dependency graph).  
  - Bundles a small subset into the same “work slice” if they’re cheap and high‑leverage.  
  - Keeps within the 20–30% debt budget for that cycle. [linkedin](https://www.linkedin.com/advice/0/youre-juggling-technical-debt-new-feature-pbqoe)

For **hardening as you go**:

- Whenever agents touch a module, they’re allowed (and encouraged) to do **local refactors that keep tests green** and reduce obvious debt, whether or not a separate ticket exists, as long as they stay inside the tech‑debt capacity for that slice. [reddit](https://www.reddit.com/r/ExperiencedDevs/comments/1j089je/how_do_you_get_tech_debt_into_a_sprint_when/)
- Larger structural changes always flow through explicit tech‑debt issues with acceptance criteria and are planned like features, not “stealth refactors.” [konghq](https://konghq.com/blog/learning-center/reducing-technical-debt)

This gives you “continuous hardening” without pausing feature flow.

## When to trigger bigger debt work

You can codify **tripwires** for when agents should propose or prioritize heavier tech‑debt work:

- Velocity in a given area drops or cycle time worsens, and many issues cite the same subsystem.  
- Bugs cluster around the same module or pattern.  
- Agents repeatedly log “friction” comments for the same files (e.g., “difficult to change because of X/Y”).

Those signals are what you feed into Perplexity/DeepSeek for “self‑heal” planning: “Given this backlog and friction pattern, how should we restructure and what debt should we pay now vs later?” [utkrusht](https://utkrusht.ai/blog/tackle-huge-technical-debt)

So the answer isn’t “feature now, harden later,” but “**feature and harden in small slices every cycle, with clear caps and explicit rules**,” and only fall back to dedicated hardening blocks when the system tells you you’re underwater.

---

You can encode this “features + continuous hardening” pattern directly into your router so agents automatically balance feature work, tech debt, and self‑healing using Linear as the spine. [metamindz.co](https://metamindz.co.uk/post/technical-debt-vs-feature-development-what-to-prioritize)

## 1. Linear backlog model for the router

Have the router treat Linear as a unified queue, but with structure the agents understand:

- Every issue has a **type** label: `feature`, `bug`, `tech-debt`, `refactor`, `hygiene`. [beyondthebacklog](https://beyondthebacklog.com/2024/01/15/balancing-technical-debt/)
- Related issues are linked by:
  - Components/labels (e.g., `auth`, `billing`),  
  - Relationships (`blocks/blocked-by`),  
  - Shared “work slice” tags.

In your router config:

- For each project, define which Linear teams/projects it maps to, and which labels mark tech debt vs feature work. [morgen](https://www.morgen.so/blog-posts/linear-project-management)
- Define a per‑project **capacity rule**, e.g.:

  ```json
  {
    "id": "capacity_feature_vs_debt",
    "when": { "project_id": "my-node-service" },
    "then": {
      "feature_capacity": 0.7,
      "tech_debt_capacity": 0.3
    }
  }
  ```

The router reads this when building a “work slice” so it never lets agents silently do 100% features.

## 2. Work selection workflow: feature + debt bundle

Define a `select_work_slice` skill that your router uses whenever an agent starts new work:

1. Query Linear for the next N **feature** issues ordered by your roadmap (priority/impact). [build.plumhq](https://build.plumhq.com/how-we-use-linear/)
2. For the chosen feature, fetch:
   - Linked `tech-debt`/`refactor` issues with matching components/labels.  
   - Any “friction markers” from past logs (e.g., repeated failures, slow changes) in that area.  
3. Choose a small bundle:
   - 1 primary feature issue.  
   - 0–2 small tech‑debt issues that:
     - Are in the same area,  
     - Fit within the 30% capacity for this cycle,  
     - Are high leverage (e.g., remove obvious friction). [nucamp](https://www.nucamp.co/blog/coding-bootcamp-full-stack-web-and-mobile-development-how-to-balance-technical-debt-and-new-feature-development)

Your router then passes this **work slice** into the plan/execution workflows you already have:

```json
{
  "slice_issues": {
    "feature": ["ISSUE-123"],
    "tech_debt": ["ISSUE-456"]
  }
}
```

## 3. Continuous hardening inside each slice

In the refactor/feature workflow (e.g., `node_monolith_refactor`):

- Treat local cleanups as **allowed by default** if they:
  - Stay within the tech‑debt capacity for the slice (tracked by estimated effort/size).  
  - Don’t change external behavior (tests must pass).  

Rules enforce:

- If the agent touches a module and sees obvious inline debt (e.g., duplicated logic, dead code), it may refactor as part of the slice **without creating a separate issue**, as long as tests remain green. [linkedin](https://www.linkedin.com/pulse/three-strategies-fitting-refactoring-your-sprints-mike-cohn)
- If refactor scope would exceed a threshold (too many files, too much change in a risky module), the agent:
  - Stops and proposes a new `tech-debt` issue in Linear via `linear_sync` instead of doing a giant stealth refactor. [konghq](https://konghq.com/blog/learning-center/reducing-technical-debt)

Implementation in your router:

- Extend the plan step with a `max_refactor_scope` constraint (e.g., max changed files or tokens).  
- If exceeded, call `linear_sync` to create a “refactor X” issue and link it to the current feature.

## 4. Tripwire rules for bigger tech‑debt projects

Use your router’s logs + Linear to trigger “self‑heal” workflows when local hardening isn’t enough.

Have a nightly or weekly `analyze_friction` job that:

1. Scans router logs for:
   - High failure rates on specific modules/paths.  
   - Repeated “too hard to change” comments or large diffs for simple requests.  
   - Long cycle times for certain labels. [linkedin](https://www.linkedin.com/advice/0/youre-juggling-technical-debt-new-feature-pbqoe)
2. Correlates with Linear data:
   - Many open issues in the same area,  
   - Lots of `tech-debt` issues postponed or ignored.  
3. Calls Perplexity/DeepSeek:
   - “Given this pattern of failures and backlog, what tech‑debt themes should we elevate?”  
4. Creates or updates **larger tech‑debt epics** in Linear via `linear_sync`:
   - E.g., “Refactor legacy auth layer,” with its own plan and child issues.

Your router rules can then increase tech‑debt capacity for that project temporarily (e.g., 50/50 feature/debt) while that epic is active.

## 5. Status and quality gates enforced by the router

Tie your workflows to Linear statuses and quality checks so agents don’t “move on” prematurely:

- For `feature` and `tech-debt` issues with labels like `core`, enforce in rules:

  ```json
  {
    "id": "core_issues_quality_gate",
    "when": {
      "labels": ["core"],
      "issue_type": ["feature", "tech-debt"]
    },
    "then": {
      "require_tests_passed": true,
      "require_human_review": true,
      "forbid_statuses": ["done", "released"] 
    }
  }
  ```

- In workflows, before calling `linear_sync` to move an issue to “done”:
  - Check that tests passed in the router logs.  
  - Check that a human (you) acknowledged the changes (VS Code extension sends a simple “approve” signal).  

This is how you guarantee “worked 100% before moving on” without manually policing everything. [linear](https://linear.app/docs/assigning-issues)

## 6. Agents’ decision logic from Linear

When an agent (via the router) picks up work:

1. Router selects a slice (feature + limited debt).  
2. Router builds IR (code structure) and context from:
   - Codebase slices,  
   - The selected Linear issues (goal + acceptance criteria). [steelsync](https://www.steelsync.io/blog/creating-a-strategic-roadmap-with-linear)
3. DeepSeek/Perplexity use that IR + issues to:
   - Design the combined plan,  
   - Decide which refactors are safe to do now versus which to spin off as a `tech-debt` issue.

This way, the agent sees the **current project scope and goals** directly in Linear terms and doesn’t over‑optimize micro‑level code at the expense of roadmap reality. [youtube](https://www.youtube.com/watch?v=-k002Ey24O8)

## 7. Self-heal workflow integrated

You already have a `project_self_heal` workflow. To optimize the feature/tech‑debt balance:

- Run it when:
  - Friction analysis crosses thresholds, or  
  - Milestones slip repeatedly due to quality problems.

`project_self_heal`:

- Re‑structures the Linear roadmap (merging/splitting issues, promoting certain debt to higher priority). [forbes](https://www.forbes.com/councils/forbestechcouncil/2025/07/02/how-to-tackle-tech-debt-without-slowing-innovation/)
- Adjusts capacity rules (e.g., temporarily 50/50) for this project in your router config.  
- Creates a “Tech Debt Initiative” epic the router can treat as its own project when selecting work slices.

Agents keep working from Linear, but selection and planning now reflect that **hardening is temporarily more important** until the epic criteria are met.

***

So with your router:

- Feature and tech‑debt work come from the same Linear backlog.  
- The router automatically bundles small, local debt into feature slices.  
- Larger debt is created as explicit epics when local hardening hits tripwires.  
- Capacity rules (20–30% by default) are enforced by the router when selecting work.  
- Quality gates and status transitions live in rules + workflows, so Linear only shows “done” once the system actually proved it.

That gives you agents that **crank features and harden as they go**, in a way that’s measurable, tunable, and always visible in Linear.

---

Yes, a “skill bible” per stack is exactly the right move, and it fits your router model cleanly.

## What the skill bible is

For each stack, you keep a **living JSON/YAML catalog** of:

- Canonical **skills** (lint, test, build, deploy, migrate, debug).  
- Preferred **tools/commands** per skill (e.g., `vitest` vs `jest`, `ruff` vs `flake8`).  
- **Prompts/templates** the LLM should use when reasoning about that stack.  
- **Constraints** (e.g., “never touch prod Redis,” “Cloudflare Worker bundles must stay under X KB”).  

Your router loads this “bible” alongside global rules and project config. When it sees `stack: "vite-react"` or `stack: "python-cloudflare"`, it knows exactly which skills are valid and how to use them.

Example structure:

```json
{
  "stack_id": "node-vite-vitest",
  "skills": {
    "lint": { "command": "pnpm lint", "tool": "eslint", "fix_supported": true },
    "test": { "command": "pnpm test", "tool": "vitest", "coverage": "pnpm test --coverage" },
    "build": { "command": "pnpm build", "tool": "vite" }
  },
  "prompts": {
    "refactor": "You are working in a Vite + Vitest + React codebase...",
    "test": "Write Vitest tests using describe/it and expect..."
  },
  "constraints": {
    "eslint_config_files": [".eslintrc.cjs", "eslint.config.mjs"],
    "max_test_runtime_seconds": 120
  }
}
```

Each project’s `router.config.json` just points to one or more stack IDs.

## Where linting should run

Given your corporate constraints, **linting and tests should run on Fly.io**, not locally:

- Local: blocked `npx`, locked‑down PowerShell, brittle corporate environment.  
- Fly: reproducible, under your control, easy to cache dependencies, no corporate gatekeeping.

Pattern:

- VS Code → router: “run lint on this slice/project.”  
- Router uses `sync_project` to ensure an up‑to‑date snapshot on Fly.  
- Router runs `pnpm lint` / `eslint` / `pytest` / `vitest` in that workspace and streams back results.  

You can still have a **lightweight local lint** for super‑quick feedback if available, but treat it as best‑effort; the router’s remote lint/test is the source of truth.

## Example stack bibles you mentioned

### Gemini (genai) stack

Skill bible `stack_gemini_api`:

- Skills:
  - `gemini_chat`, `gemini_large_context`, `gemini_multimodal`.  
- Config:
  - Available models (`gemini-2.0-flash`, `2.5-pro`), context limits, pricing hints.  
- Prompts:
  - Templates for “analyze large codebase and produce IR,” “API usage examples in Python/TS.”

The router uses this whenever a project says it relies heavily on Gemini for certain tasks.

### Python stack

`stack_python`:

- Skills:
  - `lint` → `ruff` or `flake8`.  
  - `test` → `pytest`.  
  - `format` → `black` / `ruff format`.  
- Commands:
  - `python -m pytest`, `ruff check .`, etc.  
- Prompts:
  - “Use pytest style tests, not unittest,” etc.

### Cloudflare + JS/TS

`stack_cloudflare_workers`:

- Skills:
  - `deploy_worker`, `preview_worker`, `lint_worker`.  
- Commands:
  - `npx wrangler deploy`, `wrangler dev` (on Fly‑side workspace where `npx` isn’t blocked).  
- Constraints:
  - Worker bundle limits, KV/R2 usage patterns, etc.

### ESLint / Vite / Vitest

These fit into a `node-vite-vitest` bible as above:

- `lint` → `eslint` command and config locations.  
- `test` → `vitest` with options.  
- `build` → `vite` build command.  
- Prompts → tell DeepSeek/Gemini exactly how tests and builds are organized.

### Discord API

`stack_discord_bot`:

- Skills:
  - `register_commands`, `start_bot`, `simulate_event`.  
- Commands:
  - `pnpm dev` or `python bot.py`.  
- Constraints:
  - Rate limits, token safety (“never log the bot token”).

### Redis + SQLite

`stack_redis_sqlite`:

- Skills:
  - `run_migrations`, `snapshot_db`, `seed_db`, `redis_flush_dev_only`.  
- Commands:
  - `python manage.py migrate`, custom scripts, or SQL files.  
- Constraints:
  - “Only connect to DEV/TEST endpoints from router,” “never run destructive ops without explicit flag.”

## How the router uses the bibles

1. Project config declares stacks:

```json
{
  "project_id": "my-node-service",
  "stacks": ["node-vite-vitest", "redis-sqlite", "gemini-api"]
}
```

2. On startup, router loads all stack bibles and maps stack IDs → skills/prompts/constraints.

3. For any workflow:

- When planning, DeepSeek/Perplexity get **stack prompts** injected so they reason in the right idioms.  
- When executing, skills are chosen from the relevant stacks (e.g., `lint` uses ESLint + commands defined there).  
- Constraints from stacks (like “don’t touch prod Redis”) are baked into rules so agents can’t violate them.

4. You maintain and extend the bibles over time:

- Add new tools (e.g., Playwright tests) by adding skills to the relevant stack.  
- Update prompts once when you learn a better pattern; all workflows benefit.

So yes: build a skill bible per stack, run lint/tests on Fly.io as the canonical path, and have the router wire stack‑specific skills/prompts/constraints into every plan and execution step. This keeps your agents **stack‑aware, consistent, and resistant to corporate environment nonsense** while still being easy to evolve.

---

Here are comprehensive skill bibles for each stack you mentioned.

***

## 1. Gemini API Stack

`stack_gemini_api.json`:

```json
{
  "stack_id": "gemini-api",
  "version": "1.0.0",
  "description": "Google Gemini API for LLM tasks, multimodal, and large context work",
  "skills": {
    "gemini_chat": {
      "description": "Standard chat/completion for coding tasks",
      "provider": "gemini",
      "models": ["gemini-2.0-flash", "gemini-1.5-flash"],
      "default_model": "gemini-2.0-flash",
      "context_window": 1000000,
      "recommended_max_tokens": 32000,
      "pricing_per_1m": {
        "input": 0.15,
        "output": 0.60
      }
    },
    "gemini_large_context": {
      "description": "Wide-context analysis for full subsystems",
      "provider": "gemini",
      "models": ["gemini-1.5-pro", "gemini-2.0-flash"],
      "default_model": "gemini-2.0-flash",
      "context_window": 2000000,
      "recommended_max_tokens": 100000,
      "pricing_per_1m": {
        "input": 1.25,
        "output": 5.00
      }
    },
    "gemini_multimodal": {
      "description": "Process images, diagrams, screenshots",
      "provider": "gemini",
      "models": ["gemini-2.0-flash"],
      "default_model": "gemini-2.0-flash",
      "supported_formats": ["png", "jpg", "webp", "pdf"],
      "max_image_size_mb": 20
    },
    "build_ir_gemini": {
      "description": "Build intermediate representation from large codebase",
      "provider": "gemini",
      "model": "gemini-2.0-flash",
      "output_format": "structured_json"
    }
  },
  "prompts": {
    "refactor": "You are an expert software engineer working with Google Gemini's API. Focus on generating clean, maintainable code. Always preserve existing tests and behavior unless explicitly asked to change them.",
    "large_context_analysis": "You are analyzing a large codebase. Your goal is to produce a compact intermediate representation (IR) in JSON format with: modules, key symbols, dependencies, change anchors, and risks. Be concise but complete.",
    "multimodal": "You are analyzing visual content (diagram, screenshot, UI mockup). Describe structure, identify components, and suggest code patterns that match the visual design."
  },
  "constraints": {
    "rate_limits": {
      "rpm": 2000,
      "tpm": 4000000
    },
    "best_practices": [
      "Use Flash models for speed and cost; Pro only when reasoning depth matters",
      "For context > 100k tokens, always request structured/compressed output",
      "Enable caching for repeated context (saves cost)",
      "Never send PII or credentials in prompts"
    ]
  },
  "common_patterns": {
    "ir_extraction": {
      "prompt_template": "Analyze this codebase and produce JSON with: {modules: [...], symbols: [...], dependencies: [...], change_anchors: [...], risks: [...]}",
      "expected_token_range": [50000, 150000]
    }
  }
}
```

***

## 2. Python Stack

`stack_python.json`:

```json
{
  "stack_id": "python",
  "version": "1.0.0",
  "description": "Python development with modern tooling",
  "skills": {
    "lint": {
      "command": "ruff check .",
      "tool": "ruff",
      "fix_supported": true,
      "fix_command": "ruff check --fix .",
      "config_files": ["ruff.toml", "pyproject.toml"],
      "alternatives": {
        "flake8": "flake8 .",
        "pylint": "pylint **/*.py"
      }
    },
    "format": {
      "command": "ruff format .",
      "tool": "ruff",
      "check_command": "ruff format --check .",
      "alternatives": {
        "black": "black .",
        "autopep8": "autopep8 --in-place --recursive ."
      }
    },
    "test": {
      "command": "pytest",
      "tool": "pytest",
      "coverage": "pytest --cov=. --cov-report=term-missing",
      "watch": "pytest-watch",
      "parallel": "pytest -n auto",
      "config_files": ["pytest.ini", "pyproject.toml"]
    },
    "type_check": {
      "command": "mypy .",
      "tool": "mypy",
      "config_files": ["mypy.ini", "pyproject.toml"],
      "alternatives": {
        "pyright": "pyright"
      }
    },
    "security_scan": {
      "command": "bandit -r .",
      "tool": "bandit"
    },
    "dependency_check": {
      "command": "pip-audit",
      "tool": "pip-audit"
    },
    "run_script": {
      "command": "python -m {module}",
      "description": "Run Python module or script"
    }
  },
  "prompts": {
    "refactor": "You are an expert Python developer. Follow PEP 8 style. Use type hints. Prefer dataclasses and modern Python 3.10+ features. Write pytest-style tests with descriptive names.",
    "test": "Write pytest tests using describe/it style with pytest-describe or nested functions. Use fixtures for setup. Mock external dependencies. Aim for 80%+ coverage on new code.",
    "api": "Use FastAPI for REST APIs, Pydantic for validation. Structure: routers, schemas, services, models. Use async/await for I/O.",
    "data": "Use pandas for data manipulation, polars for performance. Type DataFrames with pandera schemas when possible."
  },
  "constraints": {
    "python_version": ">=3.10",
    "forbidden_imports": ["os.system", "eval", "exec"],
    "best_practices": [
      "Always use virtual environments",
      "Pin dependencies in requirements.txt or pyproject.toml",
      "Use pathlib, not os.path",
      "Prefer f-strings over .format() or %",
      "Handle exceptions explicitly, avoid bare except"
    ]
  },
  "common_patterns": {
    "fastapi_endpoint": {
      "template": "@router.get('/path')\nasync def handler(dep: Annotated[Service, Depends(get_service)]):\n    return await dep.method()"
    },
    "pytest_fixture": {
      "template": "@pytest.fixture\ndef resource():\n    # setup\n    yield obj\n    # teardown"
    }
  }
}
```

***

## 3. Cloudflare Stack

`stack_cloudflare.json`:

```json
{
  "stack_id": "cloudflare-workers",
  "version": "1.0.0",
  "description": "Cloudflare Workers, Pages, KV, R2, D1",
  "skills": {
    "deploy_worker": {
      "command": "wrangler deploy",
      "tool": "wrangler",
      "preview": "wrangler dev",
      "config_files": ["wrangler.toml", "wrangler.json"]
    },
    "tail_logs": {
      "command": "wrangler tail",
      "tool": "wrangler"
    },
    "kv_operations": {
      "list": "wrangler kv:key list --namespace-id={id}",
      "get": "wrangler kv:key get {key} --namespace-id={id}",
      "put": "wrangler kv:key put {key} {value} --namespace-id={id}",
      "delete": "wrangler kv:key delete {key} --namespace-id={id}"
    },
    "d1_operations": {
      "execute": "wrangler d1 execute {db_name} --command='{sql}'",
      "migrations": "wrangler d1 migrations apply {db_name}"
    },
    "r2_operations": {
      "list": "wrangler r2 object list {bucket}",
      "get": "wrangler r2 object get {bucket}/{key}",
      "put": "wrangler r2 object put {bucket}/{key} --file={file}"
    },
    "pages_deploy": {
      "command": "wrangler pages deploy {directory}",
      "tool": "wrangler"
    }
  },
  "prompts": {
    "worker": "You are writing a Cloudflare Worker. Use modern ES modules syntax. Keep bundle size minimal (<1MB). Workers run on V8 isolates with limited CPU time (10-50ms typical). Use env bindings for KV, R2, D1. Always handle errors and return proper Response objects.",
    "api": "Structure Workers as: route handler → business logic → data layer (KV/D1/R2). Use Hono or itty-router for routing. Return JSON with proper status codes and headers.",
    "storage": "KV for key-value (eventually consistent), D1 for relational (SQLite), R2 for large objects. KV has 1MB value limit. D1 queries must be fast (<50ms). R2 is S3-compatible."
  },
  "constraints": {
    "bundle_size_limit_mb": 1,
    "cpu_time_limit_ms": 50,
    "memory_limit_mb": 128,
    "best_practices": [
      "Use edge caching with Cache API",
      "Minimize cold start time: avoid large dependencies",
      "Use env bindings, never hardcode secrets",
      "Set proper CORS headers for API workers",
      "Use wrangler.toml for config, not inline",
      "Test locally with wrangler dev before deploy"
    ],
    "forbidden": [
      "Filesystem access (not available)",
      "Long-running compute (use Durable Objects or move to Fly)",
      "Unhandled promise rejections"
    ]
  },
  "common_patterns": {
    "fetch_handler": {
      "template": "export default {\n  async fetch(request, env, ctx) {\n    return new Response('Hello');\n  }\n}"
    },
    "kv_cache": {
      "template": "const cached = await env.MY_KV.get(key);\nif (cached) return cached;\nconst fresh = await fetchData();\nawait env.MY_KV.put(key, fresh, {expirationTtl: 3600});\nreturn fresh;"
    }
  }
}
```

***

## 4. ESLint Stack

`stack_eslint.json`:

```json
{
  "stack_id": "eslint",
  "version": "1.0.0",
  "description": "ESLint for JavaScript/TypeScript linting",
  "skills": {
    "lint": {
      "command": "eslint .",
      "tool": "eslint",
      "fix_supported": true,
      "fix_command": "eslint . --fix",
      "config_files": [
        ".eslintrc.js",
        ".eslintrc.cjs",
        ".eslintrc.json",
        "eslint.config.js",
        "eslint.config.mjs"
      ],
      "cache": "eslint . --cache"
    },
    "lint_specific": {
      "command": "eslint {files}",
      "description": "Lint specific files or patterns"
    }
  },
  "prompts": {
    "fix": "You are fixing ESLint errors. Preserve code behavior. Follow the project's ESLint config. Common fixes: add semicolons, fix spacing, add missing types, handle unused vars.",
    "config": "Configure ESLint for this project. Use flat config (eslint.config.js) for ESLint 9+. Extend recommended presets. Add TypeScript support with @typescript-eslint if needed. Configure for the framework (React, Vue, etc)."
  },
  "constraints": {
    "best_practices": [
      "Use flat config format (eslint.config.js) for ESLint 9+",
      "Extend recommended presets: eslint:recommended, @typescript-eslint/recommended",
      "Use prettier for formatting, ESLint for code quality",
      "Run with --cache to speed up repeated runs",
      "Fix auto-fixable issues before manual review"
    ]
  },
  "common_presets": {
    "typescript": "@typescript-eslint/eslint-plugin",
    "react": "eslint-plugin-react",
    "vue": "eslint-plugin-vue",
    "prettier": "eslint-config-prettier"
  },
  "common_patterns": {
    "flat_config": {
      "template": "import js from '@eslint/js';\nexport default [\n  js.configs.recommended,\n  {\n    rules: {\n      'no-unused-vars': 'warn'\n    }\n  }\n];"
    }
  }
}
```

***

## 5. Fly.io Stack

`stack_flyio.json`:

```json
{
  "stack_id": "flyio",
  "version": "1.0.0",
  "description": "Fly.io deployment and operations",
  "skills": {
    "deploy": {
      "command": "fly deploy",
      "tool": "flyctl",
      "config_files": ["fly.toml", "Dockerfile"],
      "options": {
        "remote_build": "fly deploy --remote-only",
        "local_build": "fly deploy --local-only",
        "no_cache": "fly deploy --no-cache"
      }
    },
    "logs": {
      "command": "fly logs",
      "tail": "fly logs --tail",
      "app_specific": "fly logs -a {app_name}"
    },
    "scale": {
      "machines": "fly scale count {count}",
      "vm_size": "fly scale vm {size}",
      "memory": "fly scale memory {mb}"
    },
    "machine_operations": {
      "list": "fly machine list",
      "stop": "fly machine stop {machine_id}",
      "start": "fly machine start {machine_id}",
      "destroy": "fly machine destroy {machine_id}"
    },
    "secrets": {
      "set": "fly secrets set {KEY}={value}",
      "list": "fly secrets list",
      "unset": "fly secrets unset {KEY}"
    },
    "volumes": {
      "list": "fly volumes list",
      "create": "fly volumes create {name} --size {gb}",
      "delete": "fly volumes delete {id}"
    },
    "ssh": {
      "command": "fly ssh console",
      "sftp": "fly ssh sftp"
    }
  },
  "prompts": {
    "deploy": "You are deploying to Fly.io. Ensure Dockerfile is optimized: use multi-stage builds, minimize layers, use .dockerignore. Configure fly.toml with services, health checks, and autoscaling. Set secrets via fly secrets, never in code.",
    "scale": "Fly Machines can scale to zero. Configure auto_stop_machines and auto_start_machines in fly.toml. Use min_machines_running=0 for cost savings. Cold start is ~200-500ms.",
    "storage": "Use Fly Volumes for persistent data (SQLite, uploads). Volumes are local to one region. For multi-region, use external DB (Postgres, Tigris, S3)."
  },
  "constraints": {
    "best_practices": [
      "Use Fly Machines, not legacy Apps V1",
      "Configure health checks on [http_service]",
      "Set internal_port correctly in fly.toml",
      "Use fly secrets for sensitive data",
      "Enable autoscaling: auto_stop/auto_start",
      "Keep Docker images small (<500MB if possible)",
      "Use regions close to users/data"
    ],
    "forbidden": [
      "Storing secrets in fly.toml or Dockerfile",
      "Running production without health checks",
      "Forgetting to set internal_port"
    ]
  },
  "common_patterns": {
    "fly_toml_basic": {
      "template": "[http_service]\n  internal_port = 8080\n  auto_stop_machines = \"stop\"\n  auto_start_machines = true\n  min_machines_running = 0\n\n[[http_service.checks]]\n  grace_period = \"10s\"\n  interval = \"30s\"\n  method = \"GET\"\n  timeout = \"5s\"\n  path = \"/health\""
    },
    "dockerfile_node": {
      "template": "FROM node:20-alpine AS base\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nEXPOSE 8080\nCMD [\"node\", \"index.js\"]"
    }
  }
}
```

***

## 6. Discord API Stack

`stack_discord_api.json`:

```json
{
  "stack_id": "discord-api",
  "version": "1.0.0",
  "description": "Discord bot and API development",
  "skills": {
    "start_bot": {
      "command": "node bot.js",
      "tool": "node",
      "alternatives": {
        "python": "python bot.py",
        "with_pm2": "pm2 start bot.js"
      }
    },
    "register_commands": {
      "command": "node deploy-commands.js",
      "description": "Register slash commands with Discord API"
    },
    "test_bot": {
      "command": "node test-bot.js",
      "description": "Test bot interactions locally or in dev guild"
    }
  },
  "prompts": {
    "bot": "You are building a Discord bot. Use discord.js (Node) or discord.py (Python). Structure: commands/, events/, utils/. Use slash commands, not prefix commands. Handle interactions properly: defer if processing takes >3s, edit reply when done. Always validate permissions.",
    "commands": "Slash commands: define with SlashCommandBuilder, register globally or per-guild. Provide name, description, options. Handle autocomplete for dynamic options. Use embeds for rich responses.",
    "events": "Listen to events: interactionCreate, messageCreate, guildMemberAdd, etc. Use event handlers in separate files. Load dynamically in main bot file."
  },
  "constraints": {
    "rate_limits": {
      "global": "50 requests/second",
      "per_resource": "5 requests/5 seconds (varies by endpoint)"
    },
    "best_practices": [
      "Use intents sparingly (only what you need)",
      "Never log or expose bot token",
      "Use ephemeral replies for sensitive info",
      "Defer interaction if processing >3s",
      "Handle errors gracefully, reply to user",
      "Use guild-specific commands for testing",
      "Store minimal data, respect user privacy"
    ],
    "forbidden": [
      "Storing bot token in code or public repos",
      "Spamming users or channels",
      "Ignoring rate limits (use built-in queuing)",
      "Using user tokens (bots only)"
    ]
  },
  "common_patterns": {
    "slash_command": {
      "template": "const { SlashCommandBuilder } = require('discord.js');\n\nmodule.exports = {\n  data: new SlashCommandBuilder()\n    .setName('ping')\n    .setDescription('Replies with Pong!'),\n  async execute(interaction) {\n    await interaction.reply('Pong!');\n  }\n};"
    },
    "event_handler": {
      "template": "module.exports = {\n  name: 'interactionCreate',\n  async execute(interaction) {\n    if (!interaction.isChatInputCommand()) return;\n    // handle command\n  }\n};"
    },
    "embed": {
      "template": "const { EmbedBuilder } = require('discord.js');\nconst embed = new EmbedBuilder()\n  .setTitle('Title')\n  .setDescription('Description')\n  .setColor(0x0099FF);\nawait interaction.reply({ embeds: [embed] });"
    }
  },
  "libraries": {
    "nodejs": "discord.js",
    "python": "discord.py",
    "other": "discordgo (Go), serenity (Rust)"
  }
}
```

***

## 7. Vite + Vitest Stack

`stack_vite_vitest.json`:

```json
{
  "stack_id": "vite-vitest",
  "version": "1.0.0",
  "description": "Vite build tool and Vitest testing",
  "skills": {
    "dev": {
      "command": "vite",
      "tool": "vite",
      "description": "Start dev server with HMR"
    },
    "build": {
      "command": "vite build",
      "tool": "vite",
      "preview": "vite preview",
      "config_files": ["vite.config.js", "vite.config.ts"]
    },
    "test": {
      "command": "vitest",
      "tool": "vitest",
      "watch": "vitest --watch",
      "coverage": "vitest --coverage",
      "ui": "vitest --ui",
      "run": "vitest run",
      "config_files": ["vitest.config.js", "vitest.config.ts"]
    },
    "lint": {
      "command": "eslint . --ext .js,.jsx,.ts,.tsx",
      "fix": "eslint . --ext .js,.jsx,.ts,.tsx --fix"
    },
    "format": {
      "command": "prettier --write .",
      "check": "prettier --check ."
    }
  },
  "prompts": {
    "test": "Write Vitest tests. Use describe/it/test syntax. Use expect for assertions. Mock with vi.mock(). Test component behavior, not implementation. Use testing-library for React/Vue. Aim for meaningful tests, not 100% coverage.",
    "build": "Configure Vite for production: minify, tree-shake, code-split. Use dynamic imports for route-based splitting. Optimize assets: images, fonts. Configure base path if not serving from root.",
    "component": "Build components with modern patterns: hooks (React), composition API (Vue), script setup (Vue 3). Keep components small and focused. Use TypeScript for props/types."
  },
  "constraints": {
    "best_practices": [
      "Use Vite's fast HMR during dev",
      "Configure aliases in vite.config for clean imports",
      "Use env variables via import.meta.env",
      "Run tests in watch mode during TDD",
      "Use vitest UI for debugging tests",
      "Enable coverage to track test quality",
      "Use happy-dom or jsdom for DOM tests"
    ]
  },
  "common_patterns": {
    "vite_config": {
      "template": "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  resolve: {\n    alias: {\n      '@': '/src'\n    }\n  }\n});"
    },
    "vitest_config": {
      "template": "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({\n  test: {\n    globals: true,\n    environment: 'jsdom',\n    setupFiles: './test/setup.ts'\n  }\n});"
    },
    "vitest_test": {
      "template": "import { describe, it, expect } from 'vitest';\nimport { render, screen } from '@testing-library/react';\nimport Component from './Component';\n\ndescribe('Component', () => {\n  it('renders correctly', () => {\n    render(<Component />);\n    expect(screen.getByText('Hello')).toBeInTheDocument();\n  });\n});"
    }
  }
}
```

***

## 8. Redis + SQLite Stack

`stack_redis_sqlite.json`:

```json
{
  "stack_id": "redis-sqlite",
  "version": "1.0.0",
  "description": "Redis for caching/sessions, SQLite for embedded DB",
  "skills": {
    "redis_cli": {
      "command": "redis-cli",
      "tool": "redis-cli",
      "ping": "redis-cli ping",
      "get": "redis-cli GET {key}",
      "set": "redis-cli SET {key} {value}",
      "flush_dev": "redis-cli FLUSHDB"
    },
    "redis_operations": {
      "description": "Programmatic Redis ops via client library"
    },
    "sqlite_query": {
      "command": "sqlite3 {db_file} \"{sql}\"",
      "tool": "sqlite3",
      "dump": "sqlite3 {db_file} .dump",
      "schema": "sqlite3 {db_file} .schema"
    },
    "sqlite_migrations": {
      "description": "Run migrations via custom script or ORM"
    },
    "backup_sqlite": {
      "command": "sqlite3 {db_file} \".backup {backup_file}\"",
      "description": "Create SQLite backup"
    },
    "seed_db": {
      "description": "Seed database with initial/test data"
    }
  },
  "prompts": {
    "redis": "Redis is for ephemeral data: caching, sessions, rate limiting, job queues. Use simple data structures: strings, hashes, lists, sets. Set TTLs on keys. Use pipelining for multiple ops. Never store critical data only in Redis (it's volatile).",
    "sqlite": "SQLite is an embedded SQL database. Perfect for: local dev, small apps, single-region data, edge deployments (Fly.io). Use migrations for schema changes. Enable WAL mode for better concurrency. Keep DB size reasonable (<10GB). Index frequently queried columns.",
    "patterns": "Use Redis for hot data, SQLite for durable data. Pattern: check Redis cache → if miss, query SQLite → store in Redis with TTL. Use Redis pub/sub for real-time features. SQLite can handle 100k+ reads/sec if properly indexed."
  },
  "constraints": {
    "redis": {
      "best_practices": [
        "Always set TTLs on cached data",
        "Use namespaced keys: project:entity:id",
        "Monitor memory usage",
        "Use Redis Cluster for production scale",
        "Don't store large values (>1MB)",
        "Use connection pooling"
      ],
      "forbidden": [
        "FLUSHDB/FLUSHALL in production",
        "Storing sensitive data without encryption",
        "KEYS command in production (use SCAN)"
      ]
    },
    "sqlite": {
      "best_practices": [
        "Enable WAL: PRAGMA journal_mode=WAL",
        "Use transactions for multiple writes",
        "Index foreign keys and common WHERE clauses",
        "VACUUM periodically to reclaim space",
        "Use prepared statements (prevent SQL injection)",
        "Back up regularly",
        "Limit to single-writer scenarios or careful locking"
      ],
      "forbidden": [
        "Running SQLite over NFS",
        "Concurrent writes without WAL",
        "Storing multi-GB files as BLOBs",
        "Raw string concatenation in SQL"
      ]
    }
  },
  "common_patterns": {
    "redis_cache": {
      "template": "const cached = await redis.get(key);\nif (cached) return JSON.parse(cached);\nconst fresh = await fetchFromDB();\nawait redis.set(key, JSON.stringify(fresh), 'EX', 3600);\nreturn fresh;"
    },
    "sqlite_init": {
      "template": "import sqlite3\nconn = sqlite3.connect('app.db')\nconn.execute('PRAGMA journal_mode=WAL')\nconn.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)')\nconn.commit()"
    },
    "sqlite_migration": {
      "template": "BEGIN TRANSACTION;\nALTER TABLE users ADD COLUMN email TEXT;\nCREATE INDEX idx_users_email ON users(email);\nCOMMIT;"
    }
  },
  "libraries": {
    "redis": {
      "nodejs": "ioredis, redis",
      "python": "redis-py, aioredis"
    },
    "sqlite": {
      "nodejs": "better-sqlite3, sqlite",
      "python": "sqlite3 (builtin), sqlalchemy"
    }
  }
}
```

***

## How to use these in your router

1. Store them in `/config/stacks/` on your router.
2. Project configs reference stacks:

```json
{
  "project_id": "my-discord-bot",
  "stacks": ["python", "discord-api", "redis-sqlite", "flyio"]
}
```

3. On startup, router loads all stack bibles and indexes skills/prompts/constraints.
4. When planning/executing:
   - Inject relevant prompts into LLM system messages.
   - Use stack-specific commands for skills.
   - Enforce constraints as rules.

These bibles give your agents deep, consistent knowledge of each stack without per-project configuration.