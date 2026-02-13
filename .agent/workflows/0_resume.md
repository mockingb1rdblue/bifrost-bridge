---
description: Universal cold-start resumption workflow for Zero Local Secrets
---

# 🚀 Universal Resumption Workflow (Cold Start)

This workflow is optimized for resuming work on any machine (Windows, Mac, Linux) without requiring local secrets or previous environment state.

## 1. Local Setup

1.  **Sync Code**:

    ```bash
    git pull origin main
    ```

2.  **Auth Check (Cloudflare)**:

    ```bash
    npx wrangler whoami
    # If not logged in: npx wrangler login
    ```

3.  **Auth Check (Fly.io)**:

    ```bash
    fly auth whoami
    # If not logged in: fly auth login
    ```

4.  **Install Dependencies**:
    ```bash
    npm install
    # Windows only: .\scripts\setup_dev.ps1
    ```

## 2. Establish the "Auth Bridge"

Since we use **Zero Local Secrets**, your local tools rely on edge configuration. Establish the bridge by deploying/verifying the router:

```bash
# This verifies your credentials and confirms access to edge secrets
npx wrangler deploy --prefix workers/custom-router
```

## 3. Synchronize State

Use the `custom-router` bridge to pull current Linear tasks and seed the dev environment:

```bash
# Trigger remote seeding of prioritized backlog (if needed)
npm run seed:swarm
```

## 4. Context Fast-Boot

Ingest the current strategic state:

1.  Read `RESUME.md` (Mental model).
2.  Read `STATUS.md` (Daily progress).
3.  Check Linear Projects for `swarm:ready` issues.

## 5. Verification

Verify the bridge is active:

```bash
# Check automated health report
node -e "fetch('https://custom-router.mock1ng.workers.dev/admin/post-update', { method: 'POST', headers: { 'Authorization': 'Bearer test-key-default' } }).then(r => r.json().then(console.log))"
```
