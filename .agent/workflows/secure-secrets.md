---
description: Protocol for maintaining Zero Local Secrets and avoiding conflicts
---

# Secure Secrets Protocol

> [!IMPORTANT]
> **GLOBAL RULE**: No secrets (API keys, tokens, credentials) shall be stored in local files (`.env`, `.dev.vars`) OR in `wrangler.toml` cleartext configuration.

## Purpose
To prevent security drift, accidental commits of sensitive data, and **deployment conflicts** between local config and remote secrets.

## Rules

### 1. No Local Secret Files
- Do not create `.env` or `.dev.vars` files.
- **Why**: They create a split-brain state between local dev and production.

### 2. No Secrets in `wrangler.toml`
- **NEVER** put secrets in the `[vars]` or `[env.*.vars]` sections of `wrangler.toml`.
- **Why**: Cloudflare treats these as "cleartext variables". If a key exists as an encrypted secret on the remote worker, deploying a `wrangler.toml` with the same key in `[vars]` will cause a **conflict warning** or overwrite the secure secret with the cleartext value.

### 3. Use Remote Secrets (The Source of Truth)
All secrets must be stored securely in the cloud provider.

**For Cloudflare Workers:**
```bash
# Interactive mode
npx wrangler secret put MY_SECRET_KEY

# Non-interactive (CI/CD compatible)
echo "my-secret-value" | npx wrangler secret put MY_SECRET_KEY
```

**For Fly.io:**
```bash
fly secrets set MY_SECRET_KEY=value
```

### 4. Local Development
- Use `npx wrangler dev --remote` to use the actual encrypted secrets from Cloudflare during development.
- Do **NOT** use `npx wrangler dev` (local mode) unless you have no dependencies on secrets.

### 5. Secure Session Execution (Scripts)
- For one-off scripts requiring secrets (e.g., Linear backlog checks, Perplexity queries), use the **Secure Connect** tool:
  ```bash
  npm run secure:exec path/to/script.ts
  ```
- **Cold Clone Persistence**: This tool now integrates natively with the **macOS Keychain**. 
  - On the very first run, it will prompt for your `PROXY_API_KEY` and `LINEAR_API_KEY`.
  - It securely stores them in the OS-level Keychain (`bifrost_proxy_key` and `bifrost_linear_key`).
  - On every subsequent run (even after a `git clone` or branch wipe), it autonomously reads the secrets from the Keychain directly into process memory.
  - Zero `.env` files. Zero prompts beyond the first setup. Zero Local Secrets.

## Verification
- Run `scripts/check-secrets.sh` before committing.
- Audit `wrangler.toml` to ensure no sensitive keys are present in `[vars]`.

## Troubleshooting "Secret Conflicts"
If you see a warning like:
> Environment variables [...] conflict with existing remote secrets.

**Fix:**
1.  Remove the conflicting keys from `wrangler.toml` `[vars]`.
2.  Ensure the values are set via `wrangler secret put`.
3.  Redeploy.

