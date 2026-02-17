# Swarm Troubleshooting Guide: The 401 Loop of Death

## 🛑 Symptom: "The Red Box of Death"
If you see a massive ASCII banner in your `worker-bees` logs titled **🚨 SWARM AUTHENTICATION FAILURE 🚨**, it means the **Authentication Enforcer** has tripped.

### Why did this happen?
The worker-bees (Fly.io) tried to poll the router (Cloudflare) 3 times and were rejected with `401 Unauthorized` each time. To protect the infrastructure from a "request storm," the worker has permanently disabled its own polling loop.

---

## 🔍 Diagnostic Steps

### 1. Check Key Synchronization
The most common cause is that the `PROXY_API_KEY` on Cloudflare doesn't match the `WORKER_API_KEY` on Fly.io.

**Run the validator:**
```bash
./scripts/validate-auth-sync.sh
```

### 2. Compare Hashes
The error banner displays your **Actual Key Hash**. Compare this with the **Expected Key Hash** provided in the banner.
- If they differ, the secrets are out of sync.
- If the expected hash is `none`, the router doesn't have a `PROXY_API_KEY` set at all.

---

## 🛠️ The Fix

### The "Nuclear" Option (Recommended)
If secrets are out of sync, the fastest way to fix everything is to force-sync the known good key to all environments:

```bash
./scripts/recover-secrets.sh
```
*Note: This script pushes the same master key to Cloudflare, Fly.io, and your local `.dev.vars`.*

### Manual Fix: Fly.io
If only the bees are broken:
```bash
echo -n "YOUR_KEY" | fly secrets set WORKER_API_KEY=- --app bifrost-worker-bees
```

### Manual Fix: Cloudflare
If only the router is broken:
```bash
echo -n "YOUR_KEY" | npx wrangler secret put PROXY_API_KEY
```

---

## 🐝 How to Resume the Swarm
The worker-bees do **not** automatically recover from a 3-strike lockout. You must restart them:

```bash
fly apps restart bifrost-worker-bees
```

Or if running locally:
- Stop the process (`Ctrl+C`).
- Ensure `.dev.vars` is updated.
- Run `npm run swarm`.
