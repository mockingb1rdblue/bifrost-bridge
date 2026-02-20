---
description: The Startup Ritual - Enforcing Fresh Clone Mentality & Compliance
---

# 🌅 The Startup Ritual

**Trigger**: Execute this workflow at the start of EVERY new chat/session.

## Purpose

To combat "environment drift" and "local secrets" usage. We operate under the assumption that:

1.  The machine was just wiped.
2.  All secrets must be re-verified.
3.  Documentation is the only source of truth.

---

## 1. The Compliance Check (Docs First)

Verify that the Core Pillars exist and are accessible.

```bash
# 1. Check for the 5 Pillars
ls -l docs/PROJECT_MANIFESTO.md docs/SYSTEM_ARCHITECTURE.md docs/OPERATIONAL_MANUAL.md docs/INTEGRATION_PROTOCOLS.md docs/SWARM_BACKLOG.md

# 2. Check for the Covenant (License) & Entry Point
ls -l LICENSE README.md
```

**Rule**: If any of these are missing, **STOP**. The bridge is broken. Restore them immediately.

## 2. The "Fresh Clone" Simulation

Assume `node_modules` and `.tools` may be corrupted or missing.

```bash
# 1. Verify Node.js Environment
node -v
npm -v

# 2. Check for drift (Uncommitted files usually mean hidden tech debt!)
git status --porcelain
```

**Rule**: If `git status` shows uncommitted files, **WARN THE USER**. Hidden changes break the "Fresh Clone" promise.

## 3. The Identity Verification (Auth)

We are "Cloud-Floating". Verify we can speak to the clouds.

```bash
# 1. Cloudflare Identity
npx wrangler whoami

# 2. Fly.io Identity
fly auth whoami
```

**Rule**: If these fail, execute `docs/OPERATIONAL_MANUAL.md` -> **"The Wake Writ"**.

## 4. The Tech Debt Audit (No Archives)

Ensure no one has tried to hide trash in the dark corners.

```bash
# Verify NO archive directories exist
if [ -d "docs/archive" ] || [ -d "archive" ] || [ -d "docs/relics/archive" ]; then
    echo "❌ VIOLATION: Archive directory detected."
    echo "ACTION: Immediate tech debt management required. Merge or Destroy."
else
    echo "✅ Clean State: No archives found."
fi
```

## 5. The Pulse (Status)

Read the `STATUS.md` to load the previous session's context.

```bash
cat STATUS.md
```

---

_The Ritual is complete. You are now synced with Ankou's Aegis._
