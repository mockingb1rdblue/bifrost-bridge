# Bifrost Bridge: Fresh Pull Setup Guide

This guide walkthrough the steps required to get your environment ready after a fresh `git clone` or `git pull` in a constrained corporate environment.

## 📋 Prerequisites

- **Git for Windows** (already used for the clone).
- **Python 3.x** (installed and in PATH).

---

## 🚀 Step-by-Step Setup

### 1. External Certificate Extraction

If you are behind a corporate proxy (like Zscaler), you must extract the local SSL certificates so Node.js and Python can trust outgoing connections.

```bash
python scripts/bifrost.py extract-certs
```

_This creates the `.certs/` directory and `corporate_bundle.pem`._

### 2. Portable PowerShell Core Installation

To bypass execution policies and pre-load corporate configurations, we use a portable instance of PowerShell Core.

```bash
python scripts/bifrost.py setup-shell
```

_This downloads the ~100MB PowerShell Core zip (if missing), extracts it to `.tools/pwsh/`, and creates a custom profile._

### 3. Environment Variables

Ensure you have a `.env` file in the root directory. You can use `.env.template` as a starting point.

```bash
cp .env.template .env
# Edit .env with your specific API keys
```

---

## 🛠️ Daily Usage

### Launching the Shell

Always enter the project via the portable shell to ensure all SSL bypasses and environment variables are active:

```bash
# Option A: Direct batch file
.\scripts\pwsh.bat

# Option B: Via the commander
python scripts/bifrost.py shell
```

### Deploying Workers

Once inside the shell, tools like `npx` and `wrangler` will work correctly using the extracted certificates:

```bash
# Example: Deploying a worker
bifrost deploy linear-proxy
```

---

## 🔧 Troubleshooting

- **Large File Errors**: We exclude `pwsh.zip` from git. If setup fails, check your internet connection and ensure `scripts/setup_portable_shell.py` can reach GitHub.
- **SSL Errors in Node**: Ensure `NODE_EXTRA_CA_CERTS` is pointing to the `corporate_bundle.pem` (the shell handles this automatically).
