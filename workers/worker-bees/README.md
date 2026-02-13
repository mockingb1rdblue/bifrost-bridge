# Worker Bees (The Swarm Hands) 🐝

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
```bash
fly deploy
```
