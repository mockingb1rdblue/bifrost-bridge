# Project Learnings

## 2026-02-04: Tool Network Timeouts & Process Resilience

### Incident
During the prioritization of backlog items, the agent attempted to use the `perplexity-ask` tool. The call failed with a network error (`TypeError: fetch failed`) after a delay. This led to a perception of "getting stuck" and eventual user cancellation of subsequent commands.

### Learnings
1.  **Network Tool Reliability**: External API calls (like Perplexity) can fail or hang. We cannot assume 100% uptime.
2.  **Fail-Fast Necessity**: If a tool connection is unstable, we should have shorter timeouts or immediate fallback strategies.
3.  **Transparency**: When a tool fails, the agent must explicitly acknowledge the failure and describe the pivot strategy to the user *before* executing it, to avoid confusion.
4.  **Process vs. Outcome**: Simply getting the result (via a Python script) is good, but the *process* of getting there needs to be robust against "hanging" states.

### Action Items
- Implemented `2_smart_retry.md` workflow to mandate timeout analysis before pivots.
- Established a protocol for recording these learnings to prevent recurrence.

## 2026-02-04: User Visibility & "Stuck" States

### Incident
The user cancelled a `git commit` operation and reported feeling the agent was "stuck" again, requesting a workflow that "clearly shows what you're waiting on and why".

### Learnings
1.  **Implicit vs. Explicit Waiting**: The agent knows it's waiting for a command, but if the `TaskStatus` doesn't explicitly say "Waiting for command X...", the user just sees no activity.
2.  **Granular Status Updates**: Before running potentially blocking commands (commits, installs, large searches), the `TaskStatus` must be updated to reflect *exactly* what is happening.
3.  **Cancellation Sensitivity**: Users will cancel if they don't see progress. Frequent updates beat silent batching.

### Action Items
- Create `3_transparency.md` to force status updates before blocking calls.
