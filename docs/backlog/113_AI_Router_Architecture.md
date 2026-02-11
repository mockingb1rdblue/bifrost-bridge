# AI Router Architecture

**Status**: Planned  
**Source**: Ingested from Custom Router Agent Plan  
**Goal**: A self-optimizing, cost-aware AI router hosted on Fly.io that orchestrates DeepSeek, Gemini, and Local Agents.

---

## 1. Core Concept

The "Bifrost Router" is a tiny, intelligent proxy server (FastAPI/Node) running on Fly.io. It acts as the single "OpenAI-compatible" endpoint for all development tools (VS Code, Cursor, scripts), but internally it smartly routes requests to the most cost-effective provider.

**Why Fly.io?**
- **Scale-to-Zero**: auto-stops when idle (cost efficient).
- **Persistent Storage**: SQLite/Volume for logs and optimization data.
- **No Per-Request Markup**: Unlike Cloudflare Workers, you pay only for compute and outbound API calls.

## 2. Routing Policy Engine

The router normalizes all inputs to an OpenAI `chat/completions` schema and applies a policy layer:

### Tier 1: Tactical Coding (DeepSeek V3)
- **Trigger**: Prompt < 4k tokens, task is "edit", "debug", or "small refactor".
- **Provider**: DeepSeek V3 (Cheap, fast, strong coding).
- **Cost Target**: < $0.10 / day.

### Tier 2: Reasoning & Planning (DeepSeek R1 / Gemini)
- **Trigger (R1)**: "Plan a refactor", "Analyze architecture", or prompt 4k-32k tokens.
- **Trigger (Gemini Flash/Pro)**: Prompt > 32k tokens, full file context, or multimodal inputs.
- **Strategy**: Use huge context windows only when necessary.

### Auto-Optimization
- **Telemetry**: Logs timestamp, provider, prompt/completion tokens, latency, and "task label".
- **Feedback Loop**:
    - If monthly DeepSeek spend > limit, tighten Thresholds.
    - If DeepSeek RPM > 80% limit, route non-urgent tasks to Gemini or Queue.

---

## 3. The Refactor Pipeline ("The Brain")

For large-scale changes, the router uses a 3-phase pipeline to avoid context overflow:

1.  **Indexing**:
    - Walks the target repo.
    - Builds a "map" of files, sizes, and dependencies.
2.  **Planning (Global Brain)**:
    - Sends the *Map* (not the code) to DeepSeek R1 or Gemini Pro.
    - Prompts: "Create a step-by-step refactor plan."
    - Output: JSON list of steps, identifying which specific files ("Slices") needed for each step.
3.  **Execution (Slices)**:
    - For each step, fetches *only* the required files.
    - Sends to DeepSeek V3 (Narrow context = cheap & accurate).
    - Applies the returned diff.

---

## 4. Background "Hardening" Agent

A low-priority agent that runs when the router is otherwise idle, using **cached prompts** to save money.

- **Activity-Aware**: Pauses if user is active (VS Code connected/typing).
- **Tasks**:
    - **Tech Debt**: Scans for `TODO`s or complex functions.
    - **Test Coverage**: Generates tests for uncovered code.
    - **Auto-Merge**: Merges green PRs that meet strict criteria.
- **Batching**: Groups similar small tasks into single LLM calls to maximize cache hits.

## 5. Human-in-the-Loop (HITL)

Critical decision points trigger a **Decision Request** instead of executing:

- **Flow**:
    1.  Router hits a "High Risk" step (e.g., "Delete Table").
    2.  Pauses execution.
    3.  **Linear Notification**: Posts a comment to the relevant Linear Issue: "🤖 Approval needed for X."
    4.  **Admin UI**: Shows the request in the Dashboard.
- **Actions**:
    - **Approve**: Resume.
    - **Reject**: Cancel.
    - **Redirect**: "No, do it this way..." (Injects new context).

---

## 6. Integrations

- **Linear**: The source of truth. All "Projects" in the router map to Linear Projects.
- **VS Code**: A simple extension points to `https://router.fly.dev/v1`, transparently using the router.
- **Perplexity**: Used for "Strategy" phase (before Planning) to research best practices.
