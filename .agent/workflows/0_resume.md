---
description: Resume work on Mac after handoff from Windows
---

# 🚀 Resuming Work on Bifrost

## 0. Context Fast-Boot (AI AGENTS START HERE)
**Read [RESUME.md](../../RESUME.md) immediately.** It contains the current mental model, active architecture, and next strategic steps.

## 1. Local Setup

1.  **Pull Latest Changes**:
    ```bash
    git pull origin main
    ```

2.  **Clean Slate Protocol**:
    Ensure no secret files have crept in.
    ```bash
    ./scripts/check-secrets.sh --fix
    ```

3.  **Dependencies**:
    ```bash
    npm install
    ```

## 2. Authentication Check

Since we don't use local secrets, your CLI tools must be authenticated.

1.  **Cloudflare (Wrangler)**:
    ```bash
    npx wrangler whoami
    # If not logged in:
    # npx wrangler login
    ```

2.  **Fly.io**:
    ```bash
    fly auth whoami
    # If not logged in:
    # fly auth login
    ```

## 3. Verify Environment

Run the unit tests to ensure your environment is correctly mocked and ready.

```bash
npm test --prefix workers/custom-router
```

## 4. How to Execute Tasks

To trigger a task and see the flow:

1.  **Linear**: Update a task to "In Progress".
2.  **Logs**:
    ```bash
    # View router logs
    npx wrangler tail --prefix workers/custom-router
    ```

## 5. Next Steps

Check `STATUS.md` for the current project status and active tasks.
