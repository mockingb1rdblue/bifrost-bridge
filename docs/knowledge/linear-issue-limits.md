# Linear Workspace Limits & Agent Orchestration Strategy

## The Problem: The 250-Issue Ceiling

During the bulk seeding of the Bifrost v3 architecture, we hit a hard limit in the Linear workspace:

> **GraphQL Error**: usage limit exceeded

Investigation via direct `curl` and Node.js testing confirms that the Linear Free Tier enforces a ceiling of **250 active issues**. 

### What Counts as "Active"?
- Issues in `Triage`, `Backlog`, `Todo`, and `In Progress` states.
- **Canceling** issues does not immediately decrease the count for the purposes of this limit (likely due to a delayed garbage collection or a different definition of "active" for API billing).
- **Archiving** is the only way to physically remove them from the active count, but this is less granular via the standard API mutations for bulk cleanup.

## Why This Matters for Sluagh Swarm

Autonomous swarms generate human-unfriendly volumes of tasks. A single project thin-slicing (like Bifrost v3) can easily exceed 200 issues in a single architectural session. 

If our orchestration layer relies solely on Linear for task persistence:
1. **Inertia**: We cannot seed new work once the limit is hit.
2. **Opaque Limits**: The API does not explicitly return the current count or the delta remaining.
3. **Cost**: Scaling to the "Pro" plan for multiple projects becomes expensive for an agent-first workflow.

## Proposed Strategy: Hybrid Coordination

To prevent our agents from being "blinded" by infrastructure limits, we move towards a hybrid model:

### 1. Local/Root Backlog (The Void-Proof Guard)
- **`PENDING_BACKLOG.md`**: A local markdown-based queue for issues that have been architected but cannot yet be seeded.
- **`docs/backlog_archive_*.md`**: Historical records of superseded or completed tasks.

### 2. Custom Coordination Layer (Bifrost-Specific)
- Transition the `custom-router` from a simple proxy to a **Durable Object with D1 Backing**.
- Use Linear for human visibility and status tracking.
- Use a local/Edge SQLite (D1) for high-frequency agent coordination.

### 3. Automatic Archival Protocol
- When an issue enters a `Done` or `Canceled` state, the agent should eventually move it to a local archive file and permanently delete it from Linear to maintain "headroom."

---

## Conclusion
Linear is a world-class UI for human developers, but its free-tier is a bottleneck for high-velocity agent swarms. We must treat Linear as a **Window** (Visibility) rather than the **Engine** (State).
