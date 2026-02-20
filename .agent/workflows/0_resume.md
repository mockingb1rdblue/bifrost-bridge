---
description: Universal cold-start resumption workflow for Zero Local Secrets
---

# 🚀 Universal Resumption Workflow (Wake Writ)

This workflow is optimized for re-animating work on any machine without requiring local secrets.

## 1. Local Setup

1.  **Sync Code**:

    ```bash
    git pull origin hee-haw
    ```

2.  **Auth Check (Cloudflare)**:

    ```bash
    npx wrangler whoami
    # If not logged in: npx wrangler login
    ```

3.  **Auth Check (Fly.io)**:

    ```bash
    fly auth whoami
    ```

4.  **Install Relics**:
    ```bash
    npm install
    # Windows only: .\scripts\setup_dev.ps1
    ```

## 2. Establish the "Abyss Bridge"

Since we use **Zero Local Secrets**, your local tools rely on edge configuration. Verify access by deploying the registry:

```bash
npx wrangler deploy --prefix workers/ankous-aegis
```

## 3. Synchronize State

Use the **Reaper's Registry** bridge to pull current **Linear Lich** tasks:

````bash
```bash
# Trigger remote seeding of the Swarm Backlog (via Linear)
npm run seed:sluagh
````

### Zero Scale Logic (The Sluagh Swarm)

We assume **Zero Scale** (no running workers) at the start of a session.

1.  **Check Swarm Status**:
    ```bash
    fly status -a sluagh-swarm
    ```
2.  **Deploy if Missing**:
    ```bash
    fly deploy --config workers/worker-bees/fly.toml
    ```

## 4. Context Fast-Boot

Ingest the current strategic state:

1.  Read `docs/OPERATIONAL_MANUAL.md` (Mental model & rituals).
2.  Read `STATUS.md` (Daily pulse).
3.  Check **Linear Lich** Projects for `swarm:ready` issues.

## 5. Verification

Verify the bridge is active:

```bash
# Check automated health report via the Registry
node -e "fetch('https://ankous-aegis.mock1ng.workers.dev/admin/post-update', { method: 'POST', headers: { 'Authorization': 'Bearer test-key-default' } }).then(r => r.json().then(console.log))"
```

### Capability Pulse

Before starting work, check the current capability matrix:

```bash
# Review current swarm capabilities
cat docs/audit/SWARM_CAPABILITIES.md
```

```

## 6. Session Continuity Protocol

### Authority: STATUS.md
- `STATUS.md` is the single source of truth for project state.
- It MUST be updated at the end of every work session.

### Update Protocol
1. **Summary**: What was accomplished today.
2. **Current State**: Code, Environment, and active Blockers.
3. **Next Steps**: What needs to happen in the next session.
```
