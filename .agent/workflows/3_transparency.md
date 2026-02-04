---
description: Transparency Protocol (Status Updates BEFORE Blocking Actions)
---

# Transparency Protocol

User trust requires visibility. We must never appear "stuck".

## 1. The "Before-Action" Update

**Rule**: Before executing ANY command that might take more than 2 seconds (e.g., `npm install`, `git commit`, `grep_search` on large repos, network calls), you MUST update the `TaskBoundary`.

- **Bad Status**: "Running checks." (Vague)
- **Good Status**: "Running 'npm install'. This may take 30s. Waiting for output..." (Clear, sets expectations)

## 2. Explicit Waiting

If you are calling a tool and setting `WaitDurationSeconds` or expecting a delay:
1.  **Update TaskStatus**: "Waiting for [Tool Name] to complete..."
2.  **Reasoning**: "Waiting on [Tool Name] to retrieve [Resource] because [Reason]."

## 3. Handling "Stuck" Appearance

If a command is running in the background:
- **Do not go silent.** Check status frequently if possible.
- If you cannot check status frequently, explain *why* in the preceding message: "I am sending this command to the background. I will check back in 5 seconds."

## 4. Cancellation Recovery

If the user cancels an action:
1.  **Acknowledge**: "Command cancelled by user."
2.  **Status Check**: Immediately run a quick check (e.g., `git status`) to see state.
3.  **Report**: Tell the user what state the system is in. "Commit was interrupted. Repository is currently dirty."
