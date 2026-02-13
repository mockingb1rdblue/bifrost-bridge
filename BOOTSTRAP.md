# Bifrost Bridge: Bootstrap Protocol 🚀

This guide document the end-to-end process of bringing the Bifrost Bridge from a "Cold Start" in a hostile corporate environment to a state of **Autonomous Cloud-Floating Mesh** (Zero Local Secrets).

---

## Phase 1: Hostile Environment Setup (Local)

**Goal**: Establish a "Beachhead" on a locked-down Windows machine.

1.  **Certificate Extraction**: Capture the corporate SSL/Zscaler roots so `npm` and `npx` can function.
    - Run: `node scripts/extract_certs.js` (uses `rejectUnauthorized: false` to bootstrap).
    - Result: `.certs/corporate_bundle.pem` created.
2.  **Portable Shell**: Install PowerShell 7 locally to bypass execution policies.
    - Run: `.\scripts\setup_dev.ps1`
    - This script configures the local `PowerShell_Profile.ps1` to trust the extracted certs and set up the local `.tools` path.
3.  **Authentication Bridge**: Authenticate your CLIs.
    - `gh auth login`
    - `npx wrangler login`
    - `fly auth login`

---

## Phase 2: Cloud Foundation (Cloudflare)

**Goal**: Deploy the secure bridges for external APIs.

1.  **Local Secrets Injection (One-Time)**:
    - Copy `.env.example` to `.env`.
    - Fill in mandatory keys: `LINEAR_API_KEY`, `PERPLEXITY_API_KEY`.
2.  **Deploy Proxies**:
    - `npx wrangler deploy --prefix workers/linear-proxy`
    - `npx wrangler deploy --prefix workers/perplexity-proxy`
3.  **Edge Secret Handshake**:
    - Inject secrets directly into the edge:
      ```bash
      echo "your-key" | npx wrangler secret put LINEAR_API_KEY --prefix workers/linear-proxy
      ```
    - Once edge secrets are set, you can **delete** them from your local `.env`.

---

## Phase 3: Infrastructure Scaffold (Fly.io & GitHub)

**Goal**: Establish the persistent execution plane.

1.  **GitHub Repo Setup**:
    - Create a private repository.
    - Push the codebase.
2.  **GitHub Secrets Configuration**:
    - Add `FLY_API_TOKEN` to GitHub Repository Secrets.
    - This allows GitHub Actions to deploy without you having a local `FLY_API_TOKEN`.
3.  **Fly.io Deployment**:
    - Trigger the deployment via GitHub Actions (`gh workflow run deploy.yml`).
    - This scaffolds `bifrost-events` (Persistence) and `bifrost-runner` (Worker Bees).
4.  **Verification**:
    - Check logs: `fly logs --app bifrost-events`.

---

## Phase 4: Swarm Initiation (Autonomous Mesh)

**Goal**: Hand off the "Hands" to the Worker Bees.

1.  **Custom Router Setup**:
    - Deploy `workers/custom-router`.
    - This is the "Brain" that coordinates between Linear and the Fly.io runners.
2.  **Backlog Seeding**:
    - Use the remote seeding bridge:
      ```bash
      npm run seed:swarm  # Triggers /admin/seed-test-issues on your live router
      ```
    - This creates the first set of autonomous tasks in Linear with metadata labels.

---

## Phase 5: The "Zero Local Secrets" Cut-over

**Goal**: Final transition to cloud-floating state.

1.  **The Great Purge**:
    - Delete your local `.env` file permanently.
2.  **The Resumption Test**:
    - Close your IDE, clear your local temporary files, and try to "Resume" using only:
      ```bash
      npx wrangler deploy --prefix workers/custom-router
      ```
    - If the deploy succeeds and you can fetch projects via the proxy, your bridge is fully floating.
3.  **Autonomous Management**:
    - All future secrets should be rotated via edge-managed tools or GitHub Actions.

---

## Summary of Transition Flow

| Component   | Initial State  | Transition State      | Floating State                  |
| :---------- | :------------- | :-------------------- | :------------------------------ |
| **Secrets** | Local `.env`   | `wrangler secret put` | Edge Secrets Only               |
| **Auth**    | Password login | CLI Auth Tokens       | GitHub Secrets / Tokens         |
| **Deploy**  | Manual `npx`   | GitHub Actions        | Autonomous Swarm                |
| **Context** | Local Brain    | `custom-router` DO    | Persistence in `bifrost-events` |

---

_Authored by Antigravity Agent - 2026-02-13_
