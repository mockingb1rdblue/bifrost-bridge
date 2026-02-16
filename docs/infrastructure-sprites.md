# Infrastructure: Sprites

In the Bifrost Bridge project, a **Sprite** is a persistent, repo-specific execution environment running as a Fly.io machine.

## The Problem: Ephemeral Runners
Standard CI/CD runners (like GitHub Actions) are ephemeral. They lose state between runs, making multi-step agent interactions slow as they have to re-clone and re-setup the environment every time.

## The Solution: Persistent Sprites
The `bifrost-bridge` worker includes a `SpriteManager` that dynamically manages persistent Fly.io machines.

### Key Features
1.  **Repo-Specific Persistence**: Each repository gets its own Fly.io Volume (1GB default).
2.  **Machine Hibernation**: Sprites are stopped when not in use. When a new task for a repo arrives, the `SpriteManager` automatically resumes the existing machine.
3.  **Low Latency**: By keeping the environment "warm" and persistent, agents can resume work instantly.

## Sprite Management Logic

The `SpriteManager` follows this flow when a task is received for a `repoUrl`:
1.  **Check Identity**: Hashes the `repoUrl` to create a unique machine name (e.g., `sprite-abc123`).
2.  **Find Machine**: Searches for an existing Fly.io machine with metadata matching the `repoUrl`.
3.  **Resume or Create**:
    *   If a machine exists and is `stopped`, it starts it.
    *   If no machine exists, it creates a new Fly.io Volume and then a new Machine using the `bifrost-runner` image.
4.  **Volume Mounting**: Mounts the repo-specific volume to `/workspace`.

## Configuration

The `SpriteManager` requires a Fly.io API Token with permissions to manage machines and volumes in the target app (`bifrost-runner`).

-   **App Name**: `bifrost-runner`
-   **Default Region**: `ord` (Chicago)
-   **Image**: `registry.fly.io/bifrost-runner:latest`
