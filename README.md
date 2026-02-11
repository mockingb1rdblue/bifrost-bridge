# Bifrost Bridge & Corporate Survival Kit

**Bridging constrained corporate environments to the AI cloud.**

This project implements the "Bifrost" pattern: a secure, verifiable bridge between a locked-down corporate environment (Windows, Zscaler/SSL interception, no admin rights) and external AI services (Perplexity, Linear, Google Gemini).

## 🚀 Core Capabilities

1.  **SSL Interception Bypass**: Automatically extracts corporate certificates and configuring Node.js/Python to trust them.
2.  **Portable Shell Environment**: Installs and configures **PowerShell Core 7** locally with a custom profile that bypasses execution policy restrictions and pre-loads environment variables.
3.  **Cloudflare Proxies**: Deploys workers to forward traffic to external APIs, handling auth and cors.
    - `perplexity-proxy`: Connects to Perplexity Sonar models.
    - `linear-proxy`: Connects to Linear GraphQL API (Queries & Mutations).
4.  **Universal Runner**: `scripts/bifrost.py` orchestrates everything.

## 🛠️ Quick Start

### Initial Setup
For detailed instructions for a fresh install, see the [Environment Setup Guide](docs/setup_guide.md).

```bash
# 1. Extract corporate certificates to .certs/
python scripts/bifrost.py extract-certs

# 2. Setup portable PowerShell environment
python scripts/bifrost.py setup-shell
```

### 2. Editor Setup (Critical)
To ensure tools like `python`, `node`, and `npx` work seamlessly inside VS Code/Antigravity:
1.  You must configure the **Global User Settings** (`Ctrl+Shift+P` -> "Open User Settings (JSON)") to use the `PwshDev` profile.
2.  See [`docs/LEARNINGS.md`](docs/LEARNINGS.md) for the exact JSON snippet to paste.
3.  **Why?** This prevents the environment from falling back to system defaults.

### 3. Development Setup
Install dependencies and linting tools:
```bash
npm install
npm run lint      # Check code style
npm run lint:fix  # Auto-fix issues
```

### 4. Enter the "Clean" Environment
Launch the portable shell where tools (npx, wrangler, node) work without SSL errors and with correct secrets loaded:
```bash
python scripts/bifrost.py shell
```

### 3. Usage
Inside the shell (or via `bifrost.py` prefix):

```bash
# Ask AI (Perplexity Sonar)
bifrost ask "How do I fix this SSL error?"

# Deep Research (Perplexity Sonar Reasoning)
bifrost research "Best practices for TypeScript SDKs"

# Deploy Workers
bifrost deploy linear-proxy

# Manage Secrets
bifrost secret linear-proxy PROXY_API_KEY <value>
```

## 📂 Project Structure

- `scripts/bifrost.py`: **The Commander**. Use this for everything.
- `.tools/pwsh/`: Portable PowerShell Core installation (ignored in git).
- `.certs/`: Extracted corporate certificates.
- `workers/`: Cloudflare Worker source code.
- `src/`: TypeScript SDK and CLI source code.
- `docs/`: Project documentation and backlog.

## 🔧 Troubleshooting

**"Missing Authority Key Identifier" in Python**:
Use `bifrost.py`. It handles SSL context correctly. If writing standalone scripts, see `scripts/verify_linear.py` for how to use `ssl._create_unverified_context()` if necessary for local tools.

**Wrangler Deployment Fails**:
Ensure you are using the portable shell (`bifrost.py shell`) or `scripts/deploy_worker.py`, which loads the necessary `NODE_EXTRA_CA_CERTS`.

## 🤖 Agents & LLMs

If you are an AI agent picking up this project:
1.  Read `.agent/workflows/0_resume.md`.
2.  Run `python scripts/bifrost.py detect` to verify your environment.


---

Great question. Your router is fundamentally different from an MCP server in architecture, purpose, and control flow.

***

## MCP Server (Model Context Protocol)

**What it is:**
- A **standardized interface** for exposing tools, prompts, and resources to AI assistants (like Claude).
- Defines a protocol for AI clients to **discover and invoke** capabilities on the server.

**Architecture:**
- **Client-initiated:** The AI assistant (client) decides when to call the MCP server.
- **Request/response:** Stateless or minimal state; each tool invocation is independent.
- **Passive:** The server waits for the AI to ask for something.

**Example flow:**
1. You ask Claude: "What's in my Linear backlog?"
2. Claude sees the MCP server exposes a `linear_get_issues` tool.
3. Claude calls the tool via MCP.
4. MCP server fetches from Linear API, returns data.
5. Claude uses the data to answer you.

**Key characteristics:**
- **AI is in control:** Claude decides which tools to use and when.
- **Simple orchestration:** One tool call at a time, driven by the AI's reasoning.
- **No autonomous behavior:** MCP server only responds to requests; doesn't do anything on its own.
- **No policy engine:** The AI decides, not the server.

***

## Your Router

**What it is:**
- An **autonomous orchestration platform** that manages multi-step AI workflows, enforces policies, and operates independently.
- A **decision engine** that routes work to the right provider/model based on rules, not AI discretion.

**Architecture:**
- **Server-initiated:** The router decides what to do based on triggers (Linear webhooks, background schedules, your requests).
- **Stateful workflows:** Tracks jobs, steps, decisions, budgets, batches across time.
- **Active:** The router runs background agents, schedules work, monitors projects.

**Example flow:**
1. Linear issue created with label `tech-debt`.
2. Router's background agent detects it (no human involved yet).
3. Router checks rules: "tech-debt issues in project X → use DeepSeek, low priority, batch with similar tasks."
4. Router collects 5 similar issues, batches them into one LLM call.
5. DeepSeek analyzes all 5, router parses results, creates individual jobs.
6. For risky changes, router pauses and asks you for direction (human-in-the-loop).
7. You approve, router resumes, executes refactor, runs tests, updates Linear, closes issue.

**Key characteristics:**
- **Router is in control:** Rules and workflows determine what happens, not the AI.
- **Complex orchestration:** Multi-step workflows, batching, caching, rate limiting, budget enforcement.
- **Autonomous behavior:** Background agent runs on schedule, processes work without user intervention.
- **Policy engine:** Rules decide provider, model, workflow, and when to involve humans.
- **Cost management:** Per-project budgets, activity-aware pausing, cached/batched calls.
- **Observability:** Admin UI, decision queues, usage tracking.

***

## Side-by-side comparison

| Aspect | MCP Server | Your Router |
|--------|-----------|-------------|
| **Control flow** | AI client decides what to call | Router decides based on rules/workflows |
| **Initiative** | Passive (waits for requests) | Active (autonomous background work) |
| **State** | Stateless or minimal | Stateful (jobs, decisions, budgets) |
| **Orchestration** | Single tool calls | Multi-step workflows with branching |
| **Provider selection** | AI picks tools available | Router picks provider/model via rules |
| **Cost management** | None (AI's responsibility) | Built-in budgets, batching, caching |
| **Human-in-the-loop** | AI can ask user questions | Router pauses at decision points, notifies via Linear |
| **Background work** | No autonomous behavior | Background agent continuously processes tasks |
| **Integration depth** | Simple API wrappers | Deep Linear/GitHub integration (webhooks, status sync) |
| **Observability** | Logs only | Admin UI with dashboards, queues, cost tracking |

***

## Analogy

**MCP Server is like a toolbox:**
- You (or Claude) pick which tool to use.
- The toolbox doesn't do anything on its own.
- It just makes tools available when asked.

**Your Router is like a construction foreman:**
- It reads the blueprints (Linear issues, rules, workflows).
- It decides which subcontractors (providers/models) to hire for which jobs.
- It schedules work, manages budgets, checks in with you at key decisions.
- It works overnight (background agent) on low-priority tasks without bothering you.
- It tracks everything and gives you a daily report (admin UI).

***

## Could you build your router *using* MCP?

**Kind of, but it would be awkward:**

You could expose your router's capabilities as an MCP server:
- Tools: `create_job`, `run_workflow`, `check_budget`, etc.
- Claude calls these tools to orchestrate workflows.

**But you'd lose key advantages:**
- Claude would have to manually check budgets, batch tasks, enforce rules—things your router does automatically.
- No background agent (Claude isn't running 24/7).
- No policy enforcement (Claude might pick expensive models or skip rules).
- No stateful workflows (each request is independent).

**Better approach:**
- Keep your router as-is (autonomous orchestration).
- Optionally expose a **thin MCP interface** so you can talk to the router via Claude:
  - `router_get_pending_decisions` → see what needs your input.
  - `router_approve_decision` → approve a decision request.
  - `router_check_usage` → see today's costs.

This lets Claude interact with the router (useful for ad-hoc queries) while the router remains autonomous.

***

## When would you use each?

**Use MCP Server when:**
- You want Claude (or another AI assistant) to have access to specific tools/data.
- You're building simple, AI-driven automation (Claude decides everything).
- You don't need stateful workflows or autonomous behavior.

**Use your Router when:**
- You need multi-step, policy-driven workflows.
- You want autonomous background work.
- You need cost management, batching, and provider orchestration.
- You're managing complex projects with Linear/GitHub integration.
- You want observability and control via admin UI.

***

## TL;DR

**MCP Server:**
- Passive tool provider for AI assistants.
- AI client decides what to call and when.
- Simple, stateless, reactive.

**Your Router:**
- Active orchestration platform.
- Router decides based on rules, workflows, budgets.
- Complex, stateful, autonomous.

Your router is an **AI orchestration engine** that *uses* LLMs as tools, while an MCP server is a **tool interface** for LLMs to use. They're complementary, not competing architectures.
