# Agent Ecosystem

The Bifrost Bridge uses a multi-agent system to handle complex tasks autonomously. The system is split into specialized roles: **RouterDO** (The Orchestrator) and **Worker Bees** (The Executors).

## RouterDO: Primary Orchestrator

The **RouterDO** (residing in `crypt-core`) is the high-level brain of the swarm. It manages the lifecycle of tasks from inception to closure.

### Roles & Responsibilities
-   **Task Sync**: Ingests issues from Linear based on labels (`sluagh:ready`) and maintains a prioritized internal queue.
-   **Planning**: Uses LLMs to generate technical implementation plans for each issue.
-   **Workspace Management**: Coordinates branch creation and pull request management via the GitHub API.
-   **Verification**: Orchestrates the autonomous validation loop, including PR approval and squashing/merging.
-   **Reporting**: Automatically posts "Engineering Logs" and status updates directly to Linear issues.

## Worker Bees: Distributed Executors

**Worker Bees** are lightweight TypeScript agents that poll the `RouterDO` for work. They can run locally on Windows/macOS or within persistent Fly.io **Sprites**.

### Roles & Responsibilities
-   **Polling**: Connects to `/v1/queue/poll` or `/v1/swarm/next` to fetch pending jobs.
-   **Execution**: Handles specific file system operations and shell commands within the workspace.
-   **Reporting**: Posts execution results, diffs, or error logs back to the router via `/v1/queue/complete` or `/v1/swarm/update`.

### Supported Actions (runner_task)
-   **`read_file`**: Reads content from the workspace.
-   **`write_file`**: Writes or updates files, ensuring directory existence.
-   **`list_dir`**: Recursively lists directory contents for context gathering.
-   **`review_diff`**: Performs a self-check on changes to ensure consistency with the implementation plan.
-   **`echo`**: Used for connection testing and latency verification.

## Communication Protocol

Agents communicate via a REST API exposed by the `crypt-core` worker:

1.  **Poll**: `POST /v1/queue/poll` (generic) or `POST /v1/swarm/next` (prioritized).
    -   Worker identifies itself with a unique `workerId`.
    -   Router returns a `Job` or `SwarmTask` object.
2.  **Complete**: `POST /v1/queue/complete` or `POST /v1/swarm/update`.
    -   Worker sends back `jobId`/`taskId`, results, and engineering logs.

## Configuration

Agents require the following environment variables (managed via Cloudflare/Fly.io secrets):
-   `ROUTER_URL`: The endpoint for the custom router.
-   `WORKER_API_KEY`: Authentication secret for the router (Bearer token).
-   `BIFROST_ROLE`: (Optional) Identifies the worker's specialized role.
