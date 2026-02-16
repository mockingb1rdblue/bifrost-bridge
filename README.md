# Bifrost Bridge & Corporate Survival Kit

**Bridging constrained corporate environments to the AI cloud.**

This project implements the "Bifrost" pattern: a secure, verifiable bridge between a locked-down corporate environment (Windows, Zscaler/SSL interception, no admin rights) and external AI services (Perplexity, Linear, Google Gemini).

## 🚀 Core Capabilities

1.  **SSL Interception Bypass**: Automatically extracts corporate certificates and configuring Node.js/Python to trust them.
2.  **Portable Shell Environment**: Installs and configures **PowerShell Core 7** locally with a custom profile that bypasses execution policy restrictions and pre-loads environment variables.
3.  **Cloudflare Proxies**: Deploys workers to forward traffic to external APIs, handling auth and cors.
    - `perplexity-proxy`: Connects to Perplexity Sonar models.
    - `linear-proxy`: Connects to Linear GraphQL API (Queries & Mutations).
    - `custom-router`: The central "Swarm" orchestrator (Durable Object).

## 🧠 Advanced Architecture

For a deep dive into the autonomous capabilities of this project, see:

- [Swarm Architecture](./docs/swarm-architecture.md): How the `custom-router` orchestrates tasks.
- [Agent Ecosystem](./docs/agent-ecosystem.md): The roles of Jules and Worker Bees.
- [Infrastructure: Sprites](./docs/infrastructure-sprites.md): Repo-specific persistent execution environments.
- [Scripts Reference](./docs/scripts-reference.md): Catalog of utility and management scripts.
- [Pending Backlog](./PENDING_BACKLOG.md): High-priority architected issues blocked by Linear limits.
- [Backlog Archive](./docs/backlog_archive_2026-02-16.md): Historical record of superseded/canceled issues.

## 📜 Event Sourcing: Annals of Ankou

The swarm uses an immutable event store, **Annals of Ankou**, to record every critical decision, action, and state transition. This provides a high-fidelity audit trail and enables multi-agent coordination through state replay.

- **Immutable Log**: Every action is recorded with a unique correlation ID.
- **State Replay**: Agents can reconstruct the "ground truth" of any issue by replaying its event stream.
- **Auditability**: Complete transparency into AI reasoning and execution steps.

For more details, see the [Annals of Ankou Architecture](file:///Users/mock1ng/Documents/Projects/Antigravity-Github/bifrost-bridge/workers/annals-of-ankou/ARCHITECTURE.md).

## 🚀 Resuming Work ("Cold Start")

If you are a human or an AI agent picking up this project from a fresh clone:

### 1. The Auth Bridge

We follow a **"Zero Local Secrets"** policy. You do not need a `.env` file. Instead, use your authenticated session as the secret provider:

```bash
# Verify your Cloudflare session
npx wrangler whoami

# Establish the "Auth Bridge"
# This deploys the latest code and confirms you have the necessary edge secrets.
npx wrangler deploy --prefix workers/custom-router
```

### 2. Prepare Environment

Run the setup script to trust corporate certs and initialize the portable shell:

```bash
.\scripts\setup_dev.ps1
npm run shell
```

### 3. Synchronize State

Use the edge bridge to seed test issues or pull live status:

```bash
# Seed the backlog with prioritized "Direct Problem" issues
npm run seed:swarm
```

### 4. Context Ingestion

Read the following files to align with the current strategic state:

- `BOOTSTRAP.md`: End-to-end setup guide from scratch (Local to Cloud).
- `RESUME.md`: Fast-boot mental model.
- `STATUS.md`: Current day's accomplishments.
- `.agent/workflows/0_resume.md`: Step-by-step resumption workflow.

## 🛠️ Quick Start

### 1. Fresh Install

Run the automated setup script to install dependencies (`gh`, `flyctl`, `pwsh`) and check authentication:

.\scripts\setup_dev.ps1

````

### 2. Environment Setup
The project follows a **strict "Zero Local Secrets" policy**.
- **Do NOT** store API keys in `.env` files for Cloudflare Workers or Fly.io apps.
- **Do** use `wrangler secret put` or `fly secrets set`.

See `.agent/workflows/secure-secrets.md` for the full protocol.

### 3. Editor Setup
Ensure VS Code uses the `PwshDev` profile to bypass corporate restrictions.

### 4. Development Setup
Install dependencies and linting tools:
```bash
npm install
npm run lint      # Check code style
npm run lint:fix  # Auto-fix issues
```

### 5. Enter the "Clean" Environment
Launch the portable shell where tools (npx, wrangler, node) work without SSL errors and with correct secrets loaded (fetched from remote or mocked):

```bash
npm run shell
```

### 6. Usage
Inside the shell (or via `bifrost.py` prefix):

#### Infrastructure Deployment (CI/CD)
Because of corporate proxy restrictions, we use **GitHub Actions** to deploy to Fly.io.

1.  **Push Changes**:
    ```bash
    git push origin main
    ```
2.  **Monitor Deployment**:
    ```bash
    gh run list --workflow deploy.yml
    gh run watch
    ```

#### Tools

```bash
# Ask AI (Perplexity Sonar)
npm start -- ask "How do I fix this SSL error?"

# Deep Research (Perplexity Sonar Reasoning)
npm start -- research "Best practices for TypeScript SDKs"

# Deploy Workers
npx wrangler deploy --prefix workers/linear-proxy

# Manage Secrets (Zero Local Secrets!)
# Interactive
npx wrangler secret put PROXY_API_KEY --prefix workers/linear-proxy
# Non-interactive
echo "my-key" | npx wrangler secret put PROXY_API_KEY --prefix workers/linear-proxy
```

## 📂 Project Structure

- `package.json`: **The Commander**. Use `npm run` or `npm start` for tasks.
- `.tools/pwsh/`: Portable PowerShell Core installation (ignored in git).
- `.certs/`: Extracted corporate certificates.
- `workers/`: Cloudflare Worker source code.
- `scripts/`: Utility and management scripts (see [Scripts Reference](./docs/scripts-reference.md)).
- `src/`: TypeScript SDK and CLI source code.
- `docs/`: Project documentation and architecture deep dives.

## 🔧 Troubleshooting

**Wrangler Deployment Fails**:
Ensure you are using the portable shell (`npm run shell`) which loads the necessary `NODE_EXTRA_CA_CERTS`.

## 🛡️ Security Features

### Circuit Breaker

The Linear client includes a circuit breaker to protect API keys from deactivation:

- Triggers on 401 errors
- Creates `.auth.lock` file
- Blocks all requests until resolved

**To Reset**:

```bash
# Verify secrets in .env
npm start -- linear projects --direct

# Delete lockfile
rm .auth.lock  # Unix
del .auth.lock  # Windows
```

### Rate Limiting

- **Linear & Perplexity Proxies**: 100 req/min (In-memory Token Bucket)
- **Custom Router**: 100 req/min (Durable Object Token Bucket, health-aware)

## 🤖 Agents & LLMs

If you are an AI agent picking up this project:

1.  Read `.agent/workflows/0_resume.md`.
2.  See [Agent Ecosystem](./docs/agent-ecosystem.md) for architectural details.

---

---

_Documentation maintained by Antigravity Agent._
````
