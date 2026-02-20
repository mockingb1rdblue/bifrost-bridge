# Worker Bees (The Sluagh Swarm Hands) 🐝

Autonomous agents that poll the `Custom Router` for jobs and execute them.

## 🔒 Security: Zero Local Secrets Policy

**MANDATORY**:

- Local `fly.toml` should **NOT** contain secrets in cleartext.
- All secrets MUST be set via `fly secrets set [KEY]=[VALUE]`.
- Use `ROUTER_URL` and `WORKER_API_KEY`.

## 🛠️ Execution

### Local Polling

```bash
ROUTER_URL=https://custom-router.mock1ng.workers.dev WORKER_API_KEY=your-key npm start
```

### Deployment (Fly.io)

**CRITICAL**: We follow a "Zero Local Secrets" policy. Do **NOT** run `fly deploy` directly if you need to update secrets.

Use the secure deployment wrapper:

```bash
# This prompts for keys (e.g. LINEAR_API_KEY) and injects them in-memory
npx tsx ../../scripts/infra/secure-connect.ts ../../scripts/infra/deploy-swarm.ts
```

_Fallback (Only if secrets are already set and unchanged):_

```bash
fly deploy
```
