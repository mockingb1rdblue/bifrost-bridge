# Operational Manual: The Wake Writs

> **Purpose**: The definitive guide for Human Operators to interact with Ankou's Aegis.
> **Scope**: Setup, Daily Operations, Deployment, Troubleshooting.

## 🌅 The Wake Writ (Daily Resumption)

_Execute this ritual at the start of every session to re-align the environment._

1.  **Re-animation**:
    ```bash
    # Ensure local tools are in PATH
    source scripts/activate-env.sh
    # OR manual: export PATH=$PWD/.tools/bin:$PATH
    ```
2.  **Pulse Check**:
    ```bash
    # Verify connection to the Crypt Core
    curl https://bifrost-gateway.fly.dev/health
    ```
3.  **Tumulus Sync**:
    ```bash
    # Pull latest tasks from the Swarm Backlog
    cat docs/SWARM_BACKLOG.md
    ```

## 🏗️ The Day-Zero Ritual (Cold Start)

_For new machines or fresh clones._

### Prerequisites

- **Node.js v18+**
- **Wrangler**: `npm i -g wrangler && wrangler login`
- **Fly.io CLI**: `brew install flyctl && fly auth login`

### Installation

```bash
git clone https://github.com/mockingb1rdblue/bifrost-bridge.git
cd bifrost-bridge
npm install
# Initialize Worker dependencies
(cd workers/annals-of-ankou && npm install)
```

### Hostile Environment Protocol (Corporate Proxy)

_If you are behind a Zscaler/Corporate firewall:_

1.  **Certificate Extraction**:
    ```bash
    # Extract corporate root CA to allow npm/npx
    node scripts/extract_certs.js
    ```
2.  **Portable Shell**:
    ```powershell
    # Windows Only: Bypass execution policies
    .\scripts\setup_dev.ps1
    ```

## 🚀 Deployment Protocols

### 1. The Crypt Core (Router)

_Deploy the Cloudflare Workers that manage traffic._

```bash
cd workers/crypt-core
npx wrangler deploy
# Verify:
curl https://crypt-core.YOUR-SUBDOMAIN.workers.dev/health
```

### 2. The Sluagh Swarm (Agents)

_Deploy the Fly.io Machines that execute code._

```bash
fly deploy --config fly.toml
# Verify:
fly status
```

### 3. Abyssal Artifacts (Secrets)

_Never store secrets locally. Inject them directly into the Abyss._

**Cloudflare:**

```bash
# Interactive
npx wrangler secret put LINEAR_API_KEY
# Pipeline (User beware of whitespace!)
echo "key_value" | tr -d '\n' | npx wrangler secret put LINEAR_API_KEY
```

**Fly.io (The Zero Secret Protocol):**

- **DO NOT** Use `fly secrets set` manually if possible.
- **DO** Use the secure injection script which handles prompt-based injection during deployment.

```bash
# Deploys Swarm AND injects keys from memory (never stored on disk)
npx tsx scripts/infra/secure-connect.ts scripts/infra/deploy-swarm.ts
```

## 🔧 Troubleshooting (The Black Grimoire)

### The 401 Loop of Death

**Symptom**: "Unauthorized" errors despite valid keys (Infinite Loop).
**Critical Failure**: Workers bombarded the router with 401s due to secret mismatch.
**Cause**:

1.  **Invisible Newlines**: `echo $KEY | ...` often adds `\n`.
2.  **Shadowed Variables**: `[vars]` in `wrangler.toml` overriding `wrangler secret put`.
3.  **Local vs Edge**: Running `wrangler dev` locally while Bees are on Edge.
    **Ritual**:
4.  **Purge [vars]**: Remove any plain-text API keys from `wrangler.toml`.
5.  **Sanitize**: Update secret using `tr -d '\n'`.
6.  **Synchronize**: Ensure both `dev.vars` (local) and Secrets (Edge) match.

### The "Fetch Failed" Curse

**Symptom**: Sluagh Agents failing to poll.
**Cause**: Network flakes or Fly.io machine sleeping.
**Ritual**:

- Check `fly logs`.
- Scaling from 0 to 1 may take ~5s. Implement exponential backoff in clients.

### Git Permission Errors

**Symptom**: "Permission denied (publickey)".
**Cause**: SSH key not forwarded or GitHub App perm missing.
**Ritual**:

- Ensure `ssh-agent` is running and key is added (`ssh-add -l`).
- Verify GitHub App has "Read/Write" on **Contents** and **Pull Requests**.

## 🔧 Troubleshooting

### Deployment Failures

#### `MODULE_NOT_FOUND` / Missing `dist/index.js`

- **Symptom**: Container starts but immediately crashes with `Error: Cannot find module '/app/dist/index.js'`.
- **Cause**: Docker build context issues or missing dependencies.
- **Fixes**:
  1.  **Context**: Always run `fly deploy` from the worker directory (`workers/worker-bees/`) so `npm run build` uses the correct `package.json`.
  2.  **Dependencies**: Ensure all imports (e.g., `@linear/sdk`) are present in `workers/worker-bees/package.json`.
  3.  **Cache**: If in doubt, add a comment to `Dockerfile` to force a layer rebuild.

#### "Lease currently held"

- **Symptom**: Deployment hangs or fails with lease errors.
- **Fix**: `fly machine destroy <machine-id> --force` to nuker the stuck machine.

## 🛡️ Environment Hardening Protocol

_Mandatory practices to prevent configuration drift and security leaks._

### The "Multiple Environments" Warning

**Symptom**: `WARNING] Multiple environments are defined...`
**Cause**: `wrangler.toml` has `[env.staging]` etc., but you ran `wrangler deploy` without `--env`.
**Remediation**:

1.  **Explicit Targeting**: Always use `--env`:
    ```bash
    wrangler deploy --env production
    wrangler dev --env test
    ```
2.  **Script Enforcement**: Use `package.json` scripts that hardcode these flags.

### Secret Rotation (The Dual-Key Ritual)

_To zero-downtime rotate keys (e.g., Linear API Key):_

1.  **Generate**: Create new key in the provider.
2.  **Inject**: Add as `LINEAR_API_KEY_NEXT`.
3.  **Migrate**: Update code to fallback (`env.LINEAR_API_KEY_NEXT || env.LINEAR_API_KEY`).
4.  **Promote**: `wrangler secret put LINEAR_API_KEY` with new value.
5.  **Clean**: Remove `LINEAR_API_KEY_NEXT`.
