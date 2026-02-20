# Swarm Capability Audit & Gap Analysis

> **Date**: 2026-02-18
> **Phase**: 16 (Capability Analysis)
> **Status**: 🟡 Partial Capabilities

## 1. Current Inventory (`sluagh-swarm`)

The current `worker-bees` agent (`agent.ts`) supports the following handlers:

| Handler Type  | Payload Actions | Description                                                | Status    |
| :------------ | :-------------- | :--------------------------------------------------------- | :-------- |
| `echo`        | N/A             | Returns the payload with a timestamp.                      | ✅ Active |
| `runner_task` | `read_file`     | Reads text content from a local file.                      | ✅ Active |
| `runner_task` | `write_file`    | Writes/Overwrites text content to a file.                  | ✅ Active |
| `runner_task` | `list_dir`      | Lists files in a directory (non-recursive).                | ✅ Active |
| `runner_task` | `review_diff`   | **MOCK Implementation**. Returns static "Reviewed" status. | ⚠️ Mock   |

## 2. Gap Analysis (Vs. `SWARM_BACKLOG.md`)

The `SWARM_BACKLOG.md` defines missions that require significantly easier-to-use tools.

### 🔴 Critical Missing Capabilities

#### A. Command Execution (The "Hands")

- **Requirement**: Run `npm install`, `git commit`, `npx wrangler deploy`.
- **Gap**: No `exec` or `spawn` capability in `agent.ts`.
- **Impact**: Swarm cannot build projects, run tests, or manage deployments.

#### B. Semantic/Code Search (The "Eyes")

- **Requirement**: Find relevant code for "Context Engine" or "Refactor" tasks.
- **Gap**: Only `list_dir` exists. No `grep`, `find`, or vector search.
- **Impact**: Swarm is blind to file contents without reading _everything_.

#### C. External API Gateway (The "Voice")

- **Requirement**: Call Linear (create issues), Perplexity (research), Gemini (analysis).
- **Gap**: No generic `fetch` tool. The agent is isolated.
- **Impact**: Swarm cannot interact with the outside world (SaaS integrations).

#### D. Intelligent Processing (The "Brain")

- **Requirement**: `review_diff` needs to actually analyze code.
- **Gap**: `review_diff` is hardcoded to return success.
- **Impact**: "Validator Agent" provides no value.

## 3. Recommendations (The "Sluagh Toolset")

To enable Mission 1 (Cairn Codex) and Mission 2 (Liminal Library), we must upgrade `agent.ts` with the following **Standard Toolset**:

1.  **`run_command`**: Safe wrapper for `child_process.exec`.
2.  **`search_files`**: Wrapper for `grep` and `find`.
3.  **`fetch_url`**: Proxy-aware HTTP client for external APIs.
4.  **`linear_action`**: Dedicated wrapper for Linear SDK operations (or handled via `fetch_url`).

## 4. Security Considerations

- **Command Injection**: `run_command` must strictly validate input or run in a sandbox (Firecracker does this, but app-level validation is needed).
- **Secret Leaks**: `fetch_url` must mask headers in logs.

## 5. Next Steps

1.  **Design**: Create `specs/SLUAGH_TOOLSET.md` defining the schema for these new tools.
2.  **Implement**: Refactor `agent.ts` to support specific handlers for these tools.
3.  **Deploy**: Push `v2` of `sluagh-swarm`.
