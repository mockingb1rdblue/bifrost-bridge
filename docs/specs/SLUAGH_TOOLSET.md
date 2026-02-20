# Sluagh Toolset v1: The Hands & Eyes

> **Status**: DRAFT
> **Phase**: 17 (Implementation)
> **Author**: Antigravity

## 1. Philosophy: "Restricted Omnipotence"

The Sluagh Swarm agents (Worker Bees) require powerful tools to be effective, but these tools must be sandboxed to prevent accidental destruction or "ghost" processes.

**Core Principle**: Tools are _stateless_ wrappers around system capabilities. State is managed by the Router/Context Engine.

## 2. The Toolset Schema

### 2.1 `run_command` (The Hands)

Safely execute shell commands within the Firecracker microVM.

**Schema**:

```typescript
interface RunCommandPayload {
  command: string; // The executable (e.g., 'npm', 'git', 'ls')
  args: string[]; // Arguments array
  cwd?: string; // Working directory (default: root)
  timeout?: number; // Timeout in ms (default: 30000)
  env?: Record<string, string>; // Optional env overrides
}

interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}
```

**Security Rules**:

1.  **Blocklist**: `rm -rf /`, `mkfs`, `:(){ :|:& };:` (fork bombs).
2.  **Timeout**: Hard kill after 60s (prevents zombie processes).
3.  **Sanitization**: `env` vars must not overwrite system-critical keys (like `WORKER_API_KEY`).

### 2.2 `fetch_url` (The Voice)

Interact with external APIs (Linear, Perplexity, Cloudflare).

**Schema**:

```typescript
interface FetchUrlPayload {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any; // JSON object or string
  timeout?: number;
}

interface FetchUrlResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
}
```

**Security Rules**:

1.  **Secret Injection**: The _Agent_ injects API keys from its process environment. The _Router_ never sends keys in the payload.
    - Example: If `headers['Authorization']` is `"$LINEAR_API_KEY"`, the Agent replaces it.

### 2.3 `linear_action` (The Specialist)

High-level wrapper for Linear operations to ensure consistency.

**Schema**:

```typescript
interface LinearActionPayload {
  action: 'create_issue' | 'update_issue' | 'list_issues' | 'create_comment';
  params: Record<string, any>; // Typed based on action
}
```

**Actions**:

- `create_issue`: `{ title, description, teamId, priority }`
- `update_issue`: `{ id, stateId, assigneeId }`
- `create_comment`: `{ issueId, body }`

## 3. Implementation Plan

### Phase 17.1: The Shell (Hands)

- Update `agent.ts` to support `run_command`.
- Implement `CommandExecutor` class using `child_process.spawn`.
- Add integration test: `echo "hello"`.

### Phase 17.2: The Network (Voice)

- Update `agent.ts` to support `fetch_url`.
- Implement `NetworkClient` class.
- Add integration test: `curl https://example.com`.

### Phase 17.3: The Specialist (Linear)

- Update `agent.ts` to support `linear_action`.
- Implement `LinearTool` using `@linear/sdk`.
- Verify with "Swarm Self-Assignment" (Agent assigns itself a task).
