# Swarm Architecture

The "Swarm" is the central orchestration layer of the Bifrost Bridge project, bridging high-level project management (Linear) with low-level execution (Worker Bees).

## Central Hub: Crypt Core (RouterDO)

The core of the swarm is the `crypt-core` worker. It acts as the "Source of Truth" and orchestration brain, managing jobs, events, and agent communication.

### Implementation Detail
-   **Framework**: Hono (Cloudflare Workers)
-   **State**: Cloudflare Durable Objects (`RouterDO`) for consistent queue and metric management.
-   **Queueing**: Multi-tier queueing (generic Jobs and specialized SwarmTasks) implemented within the Durable Object.

### Key Responsibilities

1.  **Job & Task Orchestration**: Provides endpoints for agents to poll for work and report completion.
2.  **Linear & GitHub Integration**:
    *   **GitHub Webhooks**: Listens for branch creation, PR events, and comments.
    *   **Linear Sync**: Bi-directionally syncs issues with the `sluagh:ready` and `sluagh:active` labels.
    *   **Feedback Loops**: Triggers automated PR reviews and merges.
3.  **LLM Routing**:
    *   Dynamic routing between Anthropic, Google Gemini, DeepSeek, and Perplexity.
    *   Unified `/v2/chat` endpoint with prompt optimization based on shared memory.

## Core API Endpoints

-   **`POST /v1/queue/poll`**: Fetch the next pending generic job.
-   **`POST /v1/queue/complete`**: Report generic job results.
-   **`POST /v1/swarm/tasks`**: List or create specialized swarm tasks.
-   **`POST /v1/swarm/next`**: Fetch the next prioritized `SwarmTask`.
-   **`POST /v1/swarm/update`**: Update `SwarmTask` status, metadata, and engineering logs.
-   **`POST /v2/chat`**: Unified multi-LLM routing endpoint.
-   **`POST /webhooks/linear`**: Receives Linear events to drive automation.
-   **`POST /webhooks/github`**: Receives GitHub events (PRs, comments).

## Job Lifecycle

1.  **Trigger**: Event (Linear update, GitHub push, or API call) creates a job in the queue.
2.  **Poll**: A Worker Bee checks out the job via `/v1/swarm/next` or `/v1/queue/poll`.
3.  **Execute**: The agent performs the task (e.g., `coding`, `verify`, `planning`).
4.  **Complete**: Agent reports results via `/v1/swarm/update` or `/v1/queue/complete`.
5.  **Re-act**: The Router analyzes the result. Successful verification can trigger autonomous PR merge and Linear issue closure.

## Router Dashboard

The router provides a real-time web dashboard at the root URL (`/`) to monitor:
-   System health and request counts.
-   Active Swarm Tasks and agent activity.
-   Provider performance metrics (tokens consumed, success rates).
-   Recent system errors and audit logs.

## Security & Verification

-   **Proxy Auth**: Most endpoints require a `Bearer` token matching the `PROXY_API_KEY`.
-   **Zero Local Secrets**: Production secrets are managed via `wrangler secret` and never stored in the repository.
