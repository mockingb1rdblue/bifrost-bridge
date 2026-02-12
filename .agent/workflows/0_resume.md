---
description: Resume work on Mac after handoff from Windows
---

# 🚀 Resuming Bifrost on MacOS

You have successfully transitioned from the constrained Windows environment to your "friendly" Mac environment. All core services (Agent Runner, Event Store, Custom Router) are live on Fly.io and Cloudflare.

## 1. Local Setup (Mac)

1.  **Clone / Pull**:
    ```bash
    git pull origin hee-haw
    ```
2.  **Dependencies**:
    ```bash
    npm install
    ```
3.  **Environment**:
    Copy `.env.example` to `.env`. You don't _strictly_ need the production keys locally since the cloud is already configured, but they are useful for local script execution.
    ```bash
    cp .env.example .env
    ```

## 2. Status of Phase 8 (Data Plane Integration)

The following items were completed and verified:

- [x] **Agent Runner (`bifrost-runner`)**: Deployed to Fly.io with auto-shutdown and auth.
- [x] **Event Store (`bifrost-events`)**: Deployed to Fly.io with SQLite persistence.
- [x] **Control Plane (`custom-router`)**: Integrated with both runner and events.
- [x] **Linear Integration**: 33 issues (BIF-103 to BIF-133) created in the backlog.

## 3. How to Execute Tasks

To trigger a task and see the flow:

1.  Go to Linear and update a task to "In Progress".
2.  The `custom-router` webhook will trigger a job.
3.  Check logs:

    ```bash
    # View router logs
    npx wrangler tail --prefix workers/custom-router

    # View events directly from store
    curl -H "Authorization: Bearer $EVENTS_SECRET" https://bifrost-events.fly.dev/events
    ```

## 4. Mac Efficiency Tips

Since you are no longer behind Zscaler interception/Windows constraints:

- You don't need `NODE_EXTRA_CA_CERTS`.
- You don't need the `.tools/pwsh` portable environment.
- Native `zsh` or `bash` works perfectly.

**Next Priority**: Start on `BIF-103` (Infrastructure verification) or move straight to **Sprites Migration** (BIF-107) for performance gains.
