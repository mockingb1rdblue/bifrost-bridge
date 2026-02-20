# Integration Protocols: The Binding Rites

> **Purpose**: Technical specifications for connecting Ankou's Aegis to external entities.
> **Scope**: Linear, Cloudflare, Fly.io, LLM Providers.

## 🔗 The Linear Lich (Project Management)

### Configuration
The bridge binds to Linear via the **Crypt Core**.
-   **API Endpoint**: `https://api.linear.app/graphql`
-   **Auth**: OAuth2 or Personal API Key (`lin_api_...`).
-   **Variables**:
    -   `LINEAR_API_KEY`: Master access key.
    -   `LINEAR_TEAM_ID`: The UUID of the target team.
    -   `LINEAR_WEBHOOK_SECRET`: For validating incoming webhooks.

### The Label Lifecycle
Tasks must transition through these states to drive the Swarm:
1.  `sluagh:ready` -> Agent picks up task.
2.  `sluagh:active` -> Agent describes plan.
3.  `sluagh:review` -> Agent submits PR.
4.  `sluagh:blocked` -> Agent requires human help.

### Limits & Workarounds
-   **The 250 Ceiling**: Free tier limit.
-   **Protocol**:
    -   Use `docs/SWARM_BACKLOG.md` for specific engineering tasks.
    -   Only High-Level "Epics" go to Linear.
    -   Aggressively archive "Done" issues in Linear.

## ⚡ The Crypt Core (Cloudflare Workers)

### Worker Topology
1.  **Reaper's Registry** (`router-do`):
    -   **Type**: Durable Object.
    -   **Role**: Request queuing, rate limiting, and state management.
    -   **Bindings**: `LINEAR_LICH` (Service), `EULOGY_ENGINE` (Service).

2.  **Ankou's Aegis** (`auth-worker`):
    -   **Type**: Worker.
    -   **Role**: JWT Validation, GitHub Webhook formatting.

### Environment Hygiene
-   **Compatibility Dates**: Lock to `2024-09-23` or later.
-   **Node Compatibility**: Enable `nodejs_compat` flag in `wrangler.toml`.

## 🦅 Specter Sanctums (Fly.io)

### Machine Configuration
-   **Image**: Dockerfile based on `node:18-alpine` + `git` + `python3`.
-   **Resources**: `shared-cpu-1x`, 256MB RAM (Minimum).
-   **Auto-Stop**: `suspend` logic enabled to save costs.

### Persistent Volumes
-   **Mount**: `/data`
-   **Usage**: Cloned repositories, `node_modules` cache, SQLite databases (if local).
-   **Warning**: Machines are ephemeral; only `/data` survives restarts.

## 🧠 The Astral Chart (LLM Routing)

### Provider Selection
| Provider       | Model                                      | Use Case                                                 |
| :------------- | :----------------------------------------- | :------------------------------------------------------- |
| **Google**     | `gemini-flash-latest`, `gemini-pro-latest` | High-throughput, Context Window (1M+), Sitemap crawling. |
| **DeepSeek**   | `deepseek-chat`                            | Complex Logic, Code Generation (Cost-effective).         |
| **Perplexity** | `sonar-small-online`, `sonar-pro`          | Real-time Documentation Discovery (Web Search).          |

### Routing Logic
The **Reaper's Registry** determines the model based on task metadata:
-   `type: research` -> **Perplexity**.
-   `type: code` -> **DeepSeek**.
-   `type: summary` -> **Gemini Flash**.
