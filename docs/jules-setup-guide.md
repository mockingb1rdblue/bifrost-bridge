# Jules Agent Setup Guide 🤖

This guide walks you through setting up the "Brain" (Custom Router) and "Hands" (Jules Agent) with the necessary GitHub permissions.

## 1. Register the GitHub App

1.  Go to **[GitHub Developer Settings > GitHub Apps](https://github.com/settings/apps)**.
2.  Click **New GitHub App**.
3.  **Name**: `Bifrost-Jules-Agent-[YourName]` (must be unique globally).
4.  **Homepage URL**: `https://github.com/mockingb1rdblue/bifrost-bridge` (or your repo URL).
5.  **Callback URL**: `http://localhost:8787/auth/callback` (placeholder, not used yet).
6.  **Webhook URL**: Uncheck "Active" for now (we use polling).

### Permissions & Events

Scroll down to **Permissions** and select:

| Category       | Permission      | Access           | Reason                            |
| :------------- | :-------------- | :--------------- | :-------------------------------- |
| **Repository** | `Contents`      | **Read & Write** | To read code and commit changes.  |
| **Repository** | `Pull requests` | **Read & Write** | To create, review, and merge PRs. |
| **Repository** | `Issues`        | **Read & Write** | To comment on issues (if needed). |
| **Repository** | `Metadata`      | **Read-only**    | Mandatory.                        |

- **Subscribe to events**: Select `Pull request` and `Pull request review`.

Click **Create GitHub App**.

## 2. Get Your Secrets

After creation, you will see the **About** page for your app.

### A. App ID

- Find **App ID** near the top (e.g., `123456`).
- **Save as**: `GITHUB_APP_ID`

### B. Private Key

- Scroll to **Private keys**.
- Click **Generate a private key**.
- A `.pem` file will download. Open it with a text editor.
- **Save content as**: `GITHUB_PRIVATE_KEY` (Keep the `-----BEGIN...` and line breaks).

### C. Installation ID

1.  On the left sidebar, click **Install App**.
2.  Click **Install** next to your account/org.
3.  Select the `bifrost-bridge` repository (or "All repositories").
4.  After installation, look at the browser URL:
    `https://github.com/settings/installations/34242342`

- The number at the end is your ID.
- **Save as**: `GITHUB_INSTALLATION_ID`

## 3. Configure Development Secrets (`.dev.vars`)

For local development with Cloudflare Workers, secrets live in `.dev.vars` inside the worker directory.

**Create this file:** `workers/custom-router/.dev.vars`

```bash
# workers/custom-router/.dev.vars

# Router Auth
PROXY_API_KEY="dev-proxy-key"
JULES_API_KEY="dev-jules-key"

# Linear Config (Existing)
LINEAR_API_KEY="your-linear-key"
LINEAR_TEAM_ID="your-team-id"
LINEAR_PROJECT_ID="your-project-id"

# GitHub App Config (New)
GITHUB_APP_ID="123456"
GITHUB_INSTALLATION_ID="34242342"
# Note: For multi-line private keys in .dev.vars, use \n for newlines or just paste it if Wrangler supports it (it can be tricky).
# Best practice for local dev: Use a purely single-line version or load it from a separate file in code if strictly local.
# FOR NOW: Flatten the PEM key to a single line with `\n` characters.
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpQIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
```

> **Tip**: To flatten your PEM key:
> `awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' < key.pem`

## 4. Configure Production Secrets

For the deployed worker, use `wrangler`:

```bash
cd workers/custom-router

wrangler secret put GITHUB_APP_ID
# Enter ID...

wrangler secret put GITHUB_INSTALLATION_ID
# Enter ID...

wrangler secret put GITHUB_PRIVATE_KEY
# Paste the full PEM content (Wrangler handles multi-line input)
```

## 5. Run the System

### Terminal 1: The Brain (Router)

```bash
cd workers/custom-router
npm run dev
```

### Terminal 2: The Hands (Agent)

```bash
# In project root
export JULES_API_KEY="dev-jules-key"
export PROXY_URL="http://localhost:8787"

npx tsx scripts/jules-agent.ts
```

## 6. Future: Enabling Active Mode (Webhooks)

To switch from Polling to Active Mode (receiving real-time events from GitHub):

1.  **Update Worker Code**:
    - Implement a `POST /webhooks/github` endpoint in `RouterDO`.
    - Add signature verification using `GITHUB_WEBHOOK_SECRET`.
    - Handle `pull_request` and `pull_request_review` events.

2.  **Update GitHub App**:
    - Go to **App Settings > General**.
    - **Webhook URL**: Set to `https://[your-worker-subdomain].workers.dev/webhooks/github`.
    - **Webhook Secret**: Generate a strong secret string.
    - **Active**: Check this box.

3.  **Update Worker Secrets**:
    - Add `GITHUB_WEBHOOK_SECRET` to `.dev.vars` and production secrets via `wrangler`.
