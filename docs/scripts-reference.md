# Scripts Reference

This document provides a catalog of the utility scripts available in the `scripts/` directory.

## Core Setup & Environment

-   **`setup_dev.ps1`**: The main setup script for Windows. Extracts corporate certificates, installs PowerShell Core 7 locally, and configures the `PwshDev` profile.
-   **`extract_certs.js`**: Node.js utility used by `setup_dev.ps1` to extract system/corporate certificates into `.certs/` for SSL interception bypass.
-   **`verify_environment.ps1`**: Checks if required tools (`gh`, `wrangler`, `flyctl`) are installed and authenticated.
-   **`pwsh.bat`**: A wrapper to launch the portable PowerShell Core environment with the correct profile.

## Linear & Swarm Management

-   **`seed-swarm.sh`**: The easiest way to populate your Linear backlog with test issues.
-   **`bulk_create_issues.ts`**: Creates multiple issues in Linear from a JSON or programmatic list.
-   **`bulk_update_metadata.ts`**: Updates the metadata (in descriptions) for a collection of Linear issues.
-   **`create_flyio_issues.ts`**: Programmatically creates Fly.io related infrastructure issues in Linear.
-   **`create-optimized-backlog.ts`**: Generates a set of prioritized, thin-sliced issues to move the project toward autonomy.
-   **`seed-5-test-issues.ts`**: Seeds the Linear backlog with a specific batch of 5 test issues.
-   **`inspect_issue_details.ts` / `inspect_issue_metadata.ts`**: CLI tools to fetch and display raw data from Linear for a specific issue ID.
-   **`list_next_priorities.ts`**: Analyzes the Linear backlog and prints the next 5 prioritized tasks for the swarm.
-   **`debug_linear_issues.ts`**: Utility to troubleshoot GraphQL communication with Linear.

## Security & Validation

-   **`check-secrets.sh`**: Scans for potential secrets in the codebase before commit.
-   **`verify_hmac_logic.js`**: Tests the HMAC signature verification used for Linear webhooks.
-   **`verify_proxy_auth.js`**: Validates that proxy authentication (Bearer tokens) is working correctly.
-   **`verify_rate_limit.js`**: Stress tests the rate limiting implementation in the proxies and `RouterDO`.
-   **`create_security_hardening_issue.ts`**: Programmatically creates a security-focused task in Linear.

## Specialized Agents

-   **`jules-agent.ts`**: A standalone implementation or test harness for the Jules orchestrator logic.

## Git Hooks

-   **`pre-commit.sh`**: Script executed by git before commits to ensure code quality and secret safety.
