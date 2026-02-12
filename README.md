# Bifrost Bridge & Corporate Survival Kit

**Bridging constrained corporate environments to the AI cloud.**

This project implements the "Bifrost" pattern: a secure, verifiable bridge between a locked-down corporate environment (Windows, Zscaler/SSL interception, no admin rights) and external AI services (Perplexity, Linear, Google Gemini).

## 🚀 Core Capabilities

1.  **SSL Interception Bypass**: Automatically extracts corporate certificates and configuring Node.js/Python to trust them.
2.  **Portable Shell Environment**: Installs and configures **PowerShell Core 7** locally with a custom profile that bypasses execution policy restrictions and pre-loads environment variables.
3.  **Cloudflare Proxies**: Deploys workers to forward traffic to external APIs, handling auth and cors.
    - `perplexity-proxy`: Connects to Perplexity Sonar models.
    - `linear-proxy`: Connects to Linear GraphQL API (Queries & Mutations).
4.  **Universal Runner**: `scripts/bifrost.py` orchestrates everything.

## 🛠️ Quick Start

## 🛠️ Quick Start

### 1. Fresh Install

Run the automated setup script to install dependencies (`gh`, `flyctl`, `pwsh`) and check authentication:

```powershell
.\scripts\setup_dev.ps1
```

### 2. Editor Setup

Ensure VS Code uses the `PwshDev` profile to bypass corporate restrictions.

### 2. Editor Setup (Critical)

To ensure tools like `python`, `node`, and `npx` work seamlessly inside VS Code/Antigravity:

1.  You must configure the **Global User Settings** (`Ctrl+Shift+P` -> "Open User Settings (JSON)") to use the `PwshDev` profile.
2.  See [`docs/LEARNINGS.md`](docs/LEARNINGS.md) for the exact JSON snippet to paste.
3.  **Why?** This prevents the environment from falling back to system defaults.

### 3. Development Setup

Install dependencies and linting tools:

```bash
npm install
npm run lint      # Check code style
npm run lint:fix  # Auto-fix issues
```

### 4. Enter the "Clean" Environment

Launch the portable shell where tools (npx, wrangler, node) work without SSL errors and with correct secrets loaded:

```bash
npm run shell
```

### 3. Usage

Inside the shell (or via `bifrost.py` prefix):

### Infrastructure Deployment (CI/CD)

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

### Tools

```bash
# Ask AI (Perplexity Sonar)
npm start -- ask "How do I fix this SSL error?"

# Deep Research (Perplexity Sonar Reasoning)
npm start -- research "Best practices for TypeScript SDKs"

# Deploy Workers
npx wrangler deploy --prefix workers/linear-proxy

# Manage Secrets
npx wrangler secret put PROXY_API_KEY --prefix workers/linear-proxy
```

## 📂 Project Structure

- `package.json`: **The Commander**. Use `npm run` or `npm start` for tasks.
- `.tools/pwsh/`: Portable PowerShell Core installation (ignored in git).
- `.certs/`: Extracted corporate certificates.
- `workers/`: Cloudflare Worker source code.
- `src/`: TypeScript SDK and CLI source code.
- `docs/`: Project documentation and backlog.

## 🔧 Troubleshooting

**"Missing Authority Key Identifier" in Python**:
Use `bifrost.py`. It handles SSL context correctly. If writing standalone scripts, see `scripts/verify_linear.py` for how to use `ssl._create_unverified_context()` if necessary for local tools.

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
2.  Run `python scripts/bifrost.py detect` to verify your environment.

---

---

_Documentation maintained by Antigravity Agent._
