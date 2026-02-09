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

### 1. Initial Setup
```bash
# 1. Extract corporate certificates to .certs/
python scripts/bifrost.py extract-certs

# 2. Setup portable PowerShell environment
python scripts/bifrost.py setup-shell
```

### 2. Enter the "Clean" Environment
Launch the portable shell where tools (npx, wrangler, node) work without SSL errors and with correct secrets loaded:
```bash
python scripts/bifrost.py shell
```

### 3. Usage
Inside the shell (or via `bifrost.py` prefix):

```bash
# Ask AI (Perplexity Sonar)
bifrost ask "How do I fix this SSL error?"

# Deep Research (Perplexity Sonar Reasoning)
bifrost research "Best practices for TypeScript SDKs"

# Deploy Workers
bifrost deploy linear-proxy

# Manage Secrets
bifrost secret linear-proxy PROXY_API_KEY <value>
```

## 📂 Project Structure

- `scripts/bifrost.py`: **The Commander**. Use this for everything.
- `.tools/pwsh/`: Portable PowerShell Core installation (ignored in git).
- `.certs/`: Extracted corporate certificates.
- `workers/`: Cloudflare Worker source code.
- `src/`: TypeScript SDK and CLI source code.
- `docs/`: Project documentation and backlog.

## 🔧 Troubleshooting

**"Missing Authority Key Identifier" in Python**:
Use `bifrost.py`. It handles SSL context correctly. If writing standalone scripts, see `scripts/verify_linear.py` for how to use `ssl._create_unverified_context()` if necessary for local tools.

**Wrangler Deployment Fails**:
Ensure you are using the portable shell (`bifrost.py shell`) or `scripts/deploy_worker.py`, which loads the necessary `NODE_EXTRA_CA_CERTS`.

## 🤖 Agents & LLMs

If you are an AI agent picking up this project:
1.  Read `.agent/workflows/0_resume.md`.
2.  Run `python scripts/bifrost.py detect` to verify your environment.
