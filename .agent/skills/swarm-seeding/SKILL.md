---
name: swarm-seeding
description: Protocol for seeding a Linear backlog with optimized issues for autonomous swarm testing.
---

# Sluagh Swarm Seeding Protocol

This skill provides the necessary instructions and tools to seed a Linear project with 5 strategic test issues designed to verify the Bifrost autonomous swarm.

## Purpose

- **Resilience Testing**: Verify the swarm handles failures and correctly blocks issues.
- **Priority Routing**: Confirm the orchestrator respects metadata-driven prioritization.
- **Audit Trails**: Validate that check-in and handoff comments are correctly posted.
- **Security Validation**: Test the swarm's ability to identify and remediate vulnerabilities (e.g., `npm audit`).

## Usage

### 🚀 Execution

Run the following command to begin seeding. You will be prompted for your Linear API Key and Team ID if they are not found in your environment.

```bash
./scripts/linear/seed-sluagh.sh
```

### 📋 Seeded Issues

1.  **Orchestration Logic Review** (Priority: 90) - High-priority documentation/logic task.
2.  **Autonomous Security Audit** (Priority: 75) - Automated dependency check (`npm audit`).
3.  **Sluagh Swarm Resilience Simulation** (Priority: 50) - Designed to fail to test `swarm:blocked` state.
4.  **Metadata Routing Validation** (Priority: 25) - Standard metadata parsing test.
5.  **Multi-Agent Handoff Drill** - Verifying labels and comments across multiple transitions.

## Prerequisites

- [x] Human-in-the-Loop has authenticated via `flyctl auth login`.
- [x] Linear API Key and Team ID are available.
- [x] `tsx` is installed (via `npm install`).

## Troubleshooting

If seeding fails with "No such team", verify your `LINEAR_TEAM_ID` matches the short code (e.g., "BIF") or the UUID from the Linear URL.
