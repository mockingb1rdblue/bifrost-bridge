# Swarm Architecture

The "Swarm" is the central orchestration layer of the Bifrost Bridge project, bridging high-level project management (Linear) with low-level execution (Worker Bees).

## Central Hub: Custom Router

The core of the swarm is the `custom-router` worker. It acts as the "Source of Truth" and orchestration brain, managing jobs, events, and agent communication.

### Implementation Detail
-   **Framework**: Hono (Cloudflare Workers)
-   **State**: Cloudflare KV (`ROUTER_KV`)
-   **Queueing**: FIFO queue implemented via KV (`jobs_queue`, `active_jobs`)

### Key Responsibilities

1.  **Job Queueing**: Provides endpoints for agents to poll for work and report completion.
2.  **Linear & GitHub Integration**:
    *   **GitHub Webhooks**: Listens for branch creation and PR events.
    *   **Orchestration Triggers**: Automatically queues jobs when Linear-style branches (e.g., `eng-123-fix-bug`) are created.
    *   **Feedback Loops**: Triggers automated PR reviews and re-queues correction tasks on failure.
3.  **LLM Routing**:
    *   Dynamic routing between Anthropic, Google Gemini, DeepSeek, and Perplexity.
    *   Provides a unified `/v2/chat` endpoint for agents.

## Core API Endpoints

-   **`POST /v1/queue/poll`**: Used by Worker Bees to fetch the next pending job.
-   **`POST /v1/queue/complete`**: Used by Worker Bees to report job results and trigger follow-up logic (e.g., PR feedback).
-   **`POST /orchestrate`**: Internal endpoint to manually or automatically queue orchestration tasks.
-   **`POST /github/webhook`**: Receives GitHub events to drive the swarm's activity.

## Job Lifecycle

1.  **Trigger**: Event (GitHub push, PR, or API call) creates a job in `jobs_queue`.
2.  **Poll**: A Worker Bee checks out the job via `/v1/queue/poll`, moving it to `active_jobs`.
3.  **Execute**: The agent performs the task (e.g., running tests, implementing code).
4.  **Complete**: Agent reports results via `/v1/queue/complete`.
5.  **Re-act**: The Router analyzes the result. If a review failed, it creates a new `job-fix` task, completing the autonomous loop.

## Router Dashboard

The router provides a real-time web dashboard at the root URL (`/`) to monitor:
-   System health and request counts.
-   Active Jules tasks and agent activity.
-   The current state of the standard job queue.
-   Recent system errors and audit logs.

## Security & Verification

-   **Proxy Auth**: Most endpoints require a `Bearer` token matching the `PROXY_API_KEY`.
-   **Zero Local Secrets**: Production secrets are managed via `wrangler secret` and never stored in the repository.
