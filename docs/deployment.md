# Deployment Guide

## Prerequisites

- **GitHub CLI (`gh`)**: Installed via `.tools/gh` (Automated by `scripts/setup.ps1`).
- **Fly.io CLI (`flyctl`)**: Installed via `.tools/flyctl` (Automated by `scripts/setup.ps1`).

## CI/CD Pipeline

We use GitHub Actions to deploy to Fly.io.

### Secrets Setup (One-Time)

The `FLY_API_TOKEN` must be an **Organization-Scoped Deploy Token** to support multiple apps (`bifrost-events`, `bifrost-runner`).

**Correct Command to Generate Token:**

```powershell
# Generate Org Token (valid for 1 year approx)
flyctl tokens create org personal --name "github-actions-org" -x 9999h > token.txt

# Set Secret in GitHub
Get-Content token.txt | gh secret set FLY_API_TOKEN

# Cleanup
Remove-Item token.txt -Force
```

> **Note:** Do NOT use `flyctl auth token` (User session token) as it may have unrestricted access or expire. Do NOT use `flyctl tokens create deploy` without `--org` as it defaults to app-bound tokens which fail for multi-app repos.

## Local Development

1.  Run `scripts/setup.ps1` to install dependencies.
2.  Run `npm run dev` in `workers/bifrost-events` to start the local server.
