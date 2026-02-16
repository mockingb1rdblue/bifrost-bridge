# Agent Ecosystem

The Bifrost Bridge uses a multi-agent system to handle complex tasks autonomously. The system is split into specialized roles: **Jules** (The Orchestrator) and **Worker Bees** (The Executors).

## Jules: Primary Orchestrator

**Jules** is the high-level brain of the swarm. It doesn't execute code directly but manages the process.

### Roles & Responsibilities
-   **Planning**: Breaks down a Linear issue into a technical implementation plan.
-   **Workspace Management**: Creates GitHub branches and initializes the environment.
-   **Verification**: Reviews the diffs produced by Worker Bees to ensure they align with the original goal.
-   **Reporting**: Formats "Engineering Logs" and posts updates to Linear.

## Worker Bees: Distributed Executors

**Worker Bees** are lightweight agents that poll the `custom-router` for work. They can run anywhere (locally on Windows via PowerShell, or in a Fly.io "Sprite").

### Roles & Responsibilities
-   **Polling**: Connects to `/v1/queue/poll` to fetch pending `runner_task` jobs.
-   **Execution**: Handles specific file system and shell actions.
-   **Reporting**: Posts results or error logs back to the router via `/v1/queue/complete`.

### Supported Actions (runner_task)
-   `read_file`: Reads content from the workspace.
-   `write_file`: Writes/Updates files in the workspace.
-   `list_dir`: Lists directory contents.
-   `review_diff`: Performs a self-check on changes.

## Communication Protocol

Agents communicate via a REST API exposed by the `custom-router`:

1.  **Poll**: `POST /v1/queue/poll`
    -   Worker identifies itself with a unique `workerId`.
    -   Router returns a `Job` object if available.
2.  **Complete**: `POST /v1/queue/complete`
    -   Worker sends back `jobId`, `result`, and optional `error`.

## Configuration

Agents require the following environment variables:
-   `ROUTER_URL`: The endpoint for the custom router.
-   `WORKER_API_KEY`: Authentication secret for the router.
-   `BIFROST_ROLE`: (Optional) Identifies the worker's specialized role.
