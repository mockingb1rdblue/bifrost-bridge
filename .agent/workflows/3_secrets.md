---
description: Autonomous secrets management — how to set, rotate, and sync all secrets across Cloudflare and GitHub without human involvement
---

# 3. Secrets Management (Autonomous)

> [!IMPORTANT]
> **Zero Local Secrets** — no `.env`, no `.dev.vars`, no cleartext in `wrangler.toml`. All secrets live in Cloudflare (worker runtime) and GitHub (CI/CD). I manage both autonomously.

## The Two Storage Targets

| Target             | Tool                  | Used By            |
| ------------------ | --------------------- | ------------------ |
| Cloudflare Workers | `wrangler secret put` | Router DO, proxies |
| GitHub Secrets     | `gh secret set`       | CI/CD workflows    |

Secrets that both need (e.g. `LINEAR_API_KEY`) must be written to **both**.

---

## Secret Inventory

| Secret                   | Cloudflare | GitHub | Notes                                           |
| ------------------------ | ---------- | ------ | ----------------------------------------------- |
| `LINEAR_API_KEY`         | ✅         | ✅     | Linear personal API key (`lin_api_...`)         |
| `LINEAR_WEBHOOK_SECRET`  | ✅         | ✅     | From Linear → Settings → API → Webhooks         |
| `LINEAR_TEAM_ID`         | ✅         | ✅     | `d43e265a-cbc3-4f07-afcd-7792ce875ad3`          |
| `LINEAR_PROJECT_ID`      | ✅         | ✅     | `9aeceb58-dc0e-46ab-9b26-f12c8a083815`          |
| `GITHUB_WEBHOOK_SECRET`  | ✅         | —      | Managed via `scripts/rotate-github-webhook.mjs` |
| `GITHUB_APP_ID`          | ✅         | —      | `2847336` — never goes to GitHub (circular)     |
| `GITHUB_INSTALLATION_ID` | ✅         | —      | `109576174`                                     |
| `GITHUB_CLIENT_ID`       | ✅         | —      | `Iv23liENW6LEGyM4iCZv`                          |
| `GITHUB_PRIVATE_KEY`     | ✅         | —      | RSA PEM — NEVER goes to GitHub (circular)       |
| `PROXY_API_KEY`          | ✅         | —      | Internal auth for worker endpoints              |
| `CLOUDFLARE_API_TOKEN`   | —          | ✅     | CI/CD deploys                                   |
| `CLOUDFLARE_ACCOUNT_ID`  | —          | ✅     | CI/CD deploys                                   |
| `FLY_API_TOKEN`          | —          | ✅     | Worker bees deploy                              |

---

## Pushing a Secret (Standard)

```bash
# Cloudflare
echo "value" | npx wrangler secret put SECRET_NAME --env production

# GitHub
gh secret set SECRET_NAME --body "value" -R mockingb1rdblue/bifrost-bridge

# Both at once (parallel)
echo "value" | npx wrangler secret put SECRET_NAME --env production &
gh secret set SECRET_NAME --body "value" -R mockingb1rdblue/bifrost-bridge &
wait
```

---

## Rotating the GitHub Webhook Secret (Autonomous)

The GitHub App has **Webhooks read/write** permission. Use the rotation script:

```bash
node scripts/rotate-github-webhook.mjs
```

This script:

1. Generates a GitHub App JWT from `GITHUB_PRIVATE_KEY` + `GITHUB_APP_ID`
2. Gets an installation token for `GITHUB_INSTALLATION_ID`
3. Generates a new 32-byte hex secret
4. PATCHes the webhook on `mockingb1rdblue/bifrost-bridge` via GitHub API
5. Writes the new secret to Cloudflare via `wrangler secret put`

**No human input required.**

---

## Rotating the Linear Webhook Secret

Linear doesn't expose an API to rotate webhook secrets. Process:

1. User goes to Linear → Settings → API → Webhooks → copy new secret
2. User provides the value once in chat
3. I write it to both Cloudflare and GitHub:

```bash
echo "lin_wh_..." | npx wrangler secret put LINEAR_WEBHOOK_SECRET --env production
gh secret set LINEAR_WEBHOOK_SECRET --body "lin_wh_..." -R mockingb1rdblue/bifrost-bridge
```

---

## What Causes 401 "Invalid Signature" on Webhooks

**Always a secret mismatch** — the HMAC algorithm is correct. Causes:

- Linear webhook secret rotated but Cloudflare still has old value
- `LINEAR_WEBHOOK_SECRET` was never set (checkConfig() returns 503)
- `GITHUB_WEBHOOK_SECRET` not matching the webhook config

**Diagnosis**: if you see `Invalid signature` in wrangler tail, the secret is stale. Not a code bug.

**Circuit breaker**: 2 consecutive 401s from Linear trip the `linear` circuit → all Linear calls stop → priority-100 self-healing swarm task dispatched. Task probes the service and files a GitHub issue (never Linear) if unrecoverable. Manual reset: `POST /admin/circuit-reset?service=linear`.

---

## Branching Convention

> `hee-haw` is the **default branch** for all repos. Treat it as `main`.

```bash
# Wrong
git pull origin main

# Right
git pull origin hee-haw
```

Feature branches: `feat/dark-<name>` → squash merge into `hee-haw` → delete feature branch.

When merging with `gh pr merge`, always target `hee-haw`:

```bash
gh pr create --base hee-haw --head feat/dark-something
gh pr merge N --squash --delete-branch
```

---

## Verifying All Secrets Are Set

```bash
# Cloudflare
npx wrangler secret list --env production

# GitHub
gh secret list -R mockingb1rdblue/bifrost-bridge

# Verify DO is alive (returns 401, not 1101 Worker threw exception)
curl https://crypt-core-production.mock1ng.workers.dev/metrics
```

`Unauthorized` = healthy. `Worker threw exception` = boot crash (missing secret or storage bug).
