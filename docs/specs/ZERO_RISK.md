# Environment & Security Specification

> [!IMPORTANT]
> **Status**: Living Standard
> **Source**: Refactored from `_INBOX/cloudflare_env.md` & `_INBOX/new_auth.md`

## Security Model: "Zero Local Secrets"

**Principle**: Secrets should never touch a local developer workstation's disk. We treat local environments as untrusted.

### 1. Secret Storage
- **Fly.io**: Secrets are stored in the Vault associated with each App (`fly secrets set`).
- **Cloudflare**: Secrets are stored in Worker environment variables (encrypted).
- **GitHub Actions**: Only `FLY_API_TOKEN` and `CLOUDFLARE_API_TOKEN` are stored. All other app secrets are injected by the runtime (Fly/CF) during deployment.

### 2. Local Development
- **Do NOT** use `.env` files for secrets (API keys, DB credentials).
- **Workflow**:
    1. `fly auth login` (one-time).
    2. `npm run deploy` (deploy to a dev/staging Sprite).
    3. `fly logs` (observe output).
- **Proxy Pattern**: If local execution is strictly required, use a Cloudflare Worker proxy that holds the secrets and authenticates the local user via short-lived token.

## Environment Management

### Configuration (`wrangler.toml`)
- **Default**: Top-level config is the *Base*, not Production.
- **Environments**: Explicit `[env.staging]`, `[env.production]`.
- **Command Enforcement**: 
    - ALWAYS use `--env` flag.
    - `npm run deploy:staging` -> `wrangler deploy --env staging`.
    - `npm run deploy:prod` -> `wrangler deploy --env production`.

### Troubleshooting "Environment Ambiguity"
If `wrangler` complains about missing environments:
1. Check `wrangler.toml` for `[env.x]` blocks.
2. Ensure you are not running a "naked" command (`wrangler secret put`) when environments are defined.
3. Use `--env <name>` explicitly.

### Rotation Policy ("Ankou's Aegis")
- **Strategy**: Dual-key rotation.
- **Process**:
    1. Generate New Key.
    2. Add New Key to `fly secrets` / `wrangler secret`.
    3. Deploy App (supports both keys).
    4. Revoke Old Key.
- **Automation**: Use `bifrost-rotator` (planned) to manage this via API headers where possible.

## Compliance Checklist
- [ ] No `.env` files in git.
- [ ] No `.env` files on local disk (use `env.d.ts` for types only).
- [ ] `wrangler.toml` defines strict environments.
- [ ] CI/CD pipeline enforces `--env` flags.
