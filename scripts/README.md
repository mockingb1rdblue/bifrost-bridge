# Bifrost Bridge: Scripts

This directory contains utility scripts for managing the Bifrost Bridge swarm.

## Swarm Seeding

### `seed-swarm.sh`
The primary entry point for seeding the Linear backlog with test issues.

**Usage:**
```bash
./scripts/seed-swarm.sh
```

**What it does:**
1. Prompts for `LINEAR_API_KEY` and `LINEAR_TEAM_ID`.
2. Executes `scripts/seed-5-test-issues.ts` via `tsx`.
3. Populates Linear with 5 issues tagged `swarm:ready` with optimized metadata.

---

## Technical Details

### `seed-5-test-issues.ts`
The core TypeScript logic for issue creation. Uses the `LinearClient` to:
- Authenticate with Linear.
- Fetch project IDs.
- Create issues with structured metadata in descriptions.
- Apply `swarm:ready` labels to trigger autonomous checkout.

### `create-optimized-backlog.ts`
Internal utility for generating large batches of optimized issues.

### `temp-list-projects.ts`
Utility to list available Linear projects and their IDs.
