# Custom Router (The Brain) 🧠

The central hub for the Bifrost Bridge swarm. It handles LLM routing, job orchestration, and Linear/GitHub integrations.

## 🔒 Security: Zero Local Secrets Policy

**MANDATORY**: This project follows a strict "Zero Local Secrets" policy.

- **NO** `.env` files should contain production or sensitive API keys.
- **NO** `.dev.vars` should be committed.
- All secrets MUST be managed via `wrangler secret put [KEY]`.

### Required Secrets

- `LINEAR_API_KEY`
- `LINEAR_TEAM_ID`
- `PROXY_API_KEY`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_INSTALLATION_ID`
- `DEEPSEEK_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`

## 🛠️ Development & Deployment

### Local Development (Proxied)

To run locally while accessing production secrets (and bypassing corporate SSL inspection):

```bash
npm run dev -- --remote
```

### Deployment

```bash
npm run deploy
```
