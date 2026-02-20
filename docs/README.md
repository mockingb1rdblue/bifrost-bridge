# 🌉 Ankou's Aegis (Bifrost Bridge)

> **Identity**: The bridge between corporate compliance and abyssal autonomy.
> **Status**: 🟢 Active (Grand Refactor Complete)

## 📚 The Core Knowledge (Read These First)

| Document                                                     | Purpose                                                      |
| :----------------------------------------------------------- | :----------------------------------------------------------- |
| 🏰 **[Project Manifesto](docs/PROJECT_MANIFESTO.md)**         | Vision, Strategy, and "Dark Mythology" Identity.             |
| 🏗️ **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)**     | Technical topology (Cloudflare, Fly.io, Swarm).              |
| 📖 **[Operational Manual](docs/OPERATIONAL_MANUAL.md)**       | How to run, deploy, and troubleshoot the bridge.             |
| 🔌 **[Integration Protocols](docs/INTEGRATION_PROTOCOLS.md)** | API specs for Linear, LLMs, and Secrets.                     |
| 🐝 **[Swarm Backlog](docs/SWARM_BACKLOG.md)**                 | The Single Source of Truth for all active engineering tasks. |

> [!WARNING]
> **Legacy Cleanup Required**:
> The `docs/` directory still contains legacy folders (`boneyard`, `relics`, etc.) and files.
> **Action**: Please manually delete everything in `docs/` EXCEPT the 5 files listed above.

## ⚡ Quick Start

### 1. The Wake Writ (Daily)
```bash
# activate the environment
source scripts/activate-env.sh
# check health
curl https://bifrost-gateway.fly.dev/health
```

### 2. Sluagh Swarm (Agents)
The swarm operates autonomously. Monitor progress via:
-   **Terminal**: `fly logs -a bifrost-swarm`
-   **Backlog**: `tail -f docs/SWARM_BACKLOG.md`

## 🛠️ Tech Stack
-   **Control Plane**: Cloudflare Workers (Crypt Core)
-   **Execution Plane**: Fly.io Machines (Specter Sanctums)
-   **Intelligence**: Gemini 2.0 Flash / DeepSeek V3 / Perplexity
-   **Memory**: Cloudflare D1 (Eulogy Engine) + SQLite-Vec (Liminal Library)

## 📜 Global Rules (The 4 Pillars)
1.  **Zero-Risk Foundation**: Never break the build. Fix warnings immediately.
2.  **Single Source of Truth**: All tasks live in `SWARM_BACKLOG.md`.
3.  **Standardized Bootstrap**: Use the `scripts/bootstrap` patterns.
4.  **Comprehensive Documentation**: Maintain the 5 core documents.
