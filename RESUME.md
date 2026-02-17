# Bifrost Bridge: AI Fast-Boot (RESUME HERE) 🚀

> **Last Updated**: 2026-02-12 (22:36:41)
> **Active Phase**: Phase 3 (Autonomous Swarm)
> **Status**: 🟢 Core Deployment Stable

## 🧠 Mental Model: The Swarm

Bifrost is a multi-agent orchestration bridge designed to bypass corporate SSL/proxy restrictions.

- **Brain**: `custom-router` (Cloudflare Worker + Durable Object).
- **Hands**: `worker-bees` (Fly.io Workers) polling the Brain.
- **State Engine**: Linear (Projects/Issues drive agent behavior).

## 🔒 Security: ZERO LOCAL SECRETS

- **Policy**: No keys in `.env`, `.dev.vars`, or root files.
- **Workflow**: Local dev MUST use `npx wrangler dev --remote` to bridge cloud secrets.
- **CLI**: Use authenticated bridges (e.g., `custom-router/admin/projects`) to fetch live data.

## 📍 Current State & Next Steps

### Phase 4: Autonomous Neural Mesh (Active 🟢)

- **Shared Memory**: `annals-of-ankou` (on Fly.io) is the source of truth for swarm history.
- **Persistence**: Database uses a Fly.io volume (`/data/events.db`) with WAL mode enabled.
- **Recovery**: If telemetry stalls, check `RESUME.md` for secret resync commands.
- **Deployment**: `maintenance-loop.sh` is the authoritative deployment path.
- **Learnings**: 
    - ⚠️ **Migrations**: SQLite migrations must be idempotent (check `PRAGMA table_info`).
    - ⚠️ **Secrets**: Cloudflare secrets must target the top-level env (avoid `--env production` unless configured).

### Next Session Goals (Phase 5)

1. **Self-Optimization**: Implement loops where agents analyze their own success/failure patterns.
2. **Dynamic Scaling**: Auto-scaling worker-bees based on queue depth.
3. **Advanced Triage**: Fine-tuning the LLM router for 99% accuracy in model selection.

## 🛠️ Quick Commands

- **Logs**: `fly logs --app bifrost-worker-bees`
- **Tail**: `npx wrangler tail --prefix workers/custom-router`
- **Fetch Projects**: `curl -H "Authorization: Bearer test-key-default" https://custom-router.mock1ng.workers.dev/admin/projects`

---

_Read `.agent/workflows/0_resume.md` for full environment setup or `BOOTSTRAP.md` for a fresh start._
