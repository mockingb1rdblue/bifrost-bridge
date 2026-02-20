# System Architecture: The Crypt Core

## 🏗️ High-Level Topology

```mermaid
graph TD
    User[User/Corporate Laptop] -->|HTTPS/WSS| Cloudflare[Cloudflare Network]

    subgraph "The Abyss (Cloud)"
        subgraph "Crypt Core (Control Plane)"
            Router[Reaper's Registry (RouterDO)]
            Auth[Ankou's Aegis (Auth Worker)]
        end

        subgraph "Specter Sanctums (Execution Plane)"
            Fly[Fly.io Infrastructure]
            Sluagh[Sluagh Swarm (Worker Agents)]
            Codex[Cairn Codex (PM DB)]
            Library[Liminal Library (Vector DB)]
        end

        subgraph "Eulogy Engine (Memory)"
            Events[Event Store (D1/DO)]
            Logs[Telemetry Logs]
        end
    end

    Cloudflare --> Router
    Router -->|Dispatch| Sluagh
    Sluagh -->|Update| Codex
    Sluagh -->|Query| Library
    Sluagh -->|Log| Events
```

## 🧩 Component Details

### 1. Reaper's Registry (The Router)

- **Function**: Distributes tasks to the Sluagh Swarm.
- **Tech**: Cloudflare Durable Objects.
- **Protocol**: HTTP/WebSocket.
- **State**: Holds the "Pending Queue" (if not in Codex).

### 2. Sluagh Swarm (The Workers)

- **Function**: Executes code, analyzes docs, runs tools.
- **Tech**: Node.js/TypeScript on Fly.io Machines.
- **Behavior**: Polling/Event-Driven.
- **Tools**: Access to `fs`, `git`, `npm`, and `LLM APIs`.

### 3. Eulogy Engine (The Memory)

- **Function**: Immutable log of all system events.
- **Tech**: Cloudflare D1 + DO.
- **Pattern**: Event Sourcing. Every state change is a recorded event.

### 4. Liminal Library (The Context)

- **Function**: Semantic search for codebase and docs.
- **Tech**: Vector Database / Embeddings.
- **Source**: Ingested from Git and Web Crawls.

### 5. Detailed Specifications

> [!TIP]
> **Living Documentation**: These specifications contain the actual implementation details and code patterns.

| Component          | Specification                                           | Description                                 |
| ------------------ | ------------------------------------------------------- | ------------------------------------------- |
| **Context Engine** | [LIMINAL_LIBRARY.md](docs/specs/LIMINAL_LIBRARY.md)     | "Liminal Library" vector search & indexing. |
| **Doc Crawler**    | [CRYPT_CRAWLER.md](docs/specs/CRYPT_CRAWLER.md)         | "Crypt Crawler" ingestion strategy.         |
| **Router**         | [DULLAHAN_DISPATCH.md](docs/specs/DULLAHAN_DISPATCH.md) | "Dullahan" intelligent proxy logic.         |
| **Research Proxy** | [VEIL_VAULT.md](docs/specs/VEIL_VAULT.md)               | "Veil Vault" corporate bypass strategy.     |
| **Linear**         | [CAIRN_CODEX.md](docs/specs/CAIRN_CODEX.md)             | "Linear Orchestrator" SDK & patterns.       |
| **Security**       | [ZERO_RISK.md](docs/specs/ZERO_RISK.md)                 | Zero Local Secrets & Environment hygiene.   |
| **Automation**     | [GHOST_EYE.md](docs/specs/GHOST_EYE.md)                 | Native agent browsing capabilities.         |
| **Lore**           | [DARK_MYTHOLOGY.md](docs/specs/DARK_MYTHOLOGY.md)       | Naming conventions and mythology.           |

## 📡 Integration Protocols

### Linear (Legacy/External)

- **Role**: Human Interface (until Codex is ready).
- **Access**: Via `LinearClient` (GraphQL).
- **Sync**: One-way sync from Codex -> Linear (optional).

### LLM Providers

- **DeepSeek**: Primary Code Logic (Cost/Perf balance).
- **Gemini**: Large Context & Embeddings.
- **Perplexity**: Research & Doc Discovery.

## 🛡️ Security Architecture

- **Zero Local Secrets**: No `.env` on local machines.
- **Abyssal Artifacts**: Secrets injected at runtime via Fly.io/Cloudflare platform secrets.
- **Least Privilege**: Workers only access what they need.
