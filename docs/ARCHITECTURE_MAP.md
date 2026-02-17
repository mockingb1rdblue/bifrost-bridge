# Bifrost Bridge: System Architecture Map

This document outlines the specialized components and operational planes of the Bifrost Bridge swarm, utilizing the established folklore-inspired naming conventions.

## 🏗️ The Stack (Components)

| Name                    | Role             | Function                                                                                                                                   |
| :---------------------- | :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **Bifrost Bridge**      | Core Gateway     | The root project and entry point for all operations, coordinating communication between the local environment and the swarm.               |
| **Crypt-Core**          | The Brain 🧠      | A Cloudflare Durable Object orchestrator. Handles LLM routing, job queue management, and Linear/GitHub synchronizations.                   |
| **Worker Bees**         | Local Swarm 🐝    | Autonomous specialized agents running in the local/proxied environment. They poll for jobs, execute file system tasks, and report results. |
| **Annals of Ankou**     | Event Sourcing 📜 | The system's immutable ledger. Captures every job start, completion, and system event for traceability and autonomous learning.            |
| **Dullahan Dispatcher** | Gateway Routing  | A Durable Object within `crypt-core` that handles high-concurrency request routing and rate limiting.                                      |
| **Linear Proxy**        | Auth Tunnel      | A dedicated worker that bridges the gap between local tools and the Linear API, enforcing security and zero-local-secrets.                 |

## 🌐 The Planes (Operational Layers)

| Plane                   | Description           | Primary Responsibility                                                                                                                         |
| :---------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **Control Plane**       | Orchestration & Logic | Managed by `crypt-core`. This plane makes decisions, plans implementations (via LLMs), and manages the job queue.                              |
| **Data Plane**          | Execution & Feedback  | Managed by `worker-bees` and `Annals of Ankou`. This plane executes the physical code changes and records the telemetry.                       |
| **Auth Plane**          | Identity & Secrets    | Enforced via the "Zero Local Secrets" policy and `Linear Proxy`. Ensures all API interactions are authorized without local credential storage. |
| **Observability Plane** | Monitoring & UI       | The `SLUAGH SWARM` Dashboard and `Annals` event stream. Provides human-in-the-loop visibility into autonomous swarm operations.                |

## 🛠️ Key Mappings

- **Orchestrator** -> `crypt-core` (The Brain)
- **Executor** -> `worker-bee` (The Swarming Agents)
- **Ledger** -> `Annals of Ankou` (The History)
- **UI** -> `/admin` (The Dashboard)

> [!NOTE]
> All components follow the **Zero Local Secrets** policy, requiring `--remote` or proxied authentication for production-level interactions.
