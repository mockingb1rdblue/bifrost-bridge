---
description: Smart Retry & Recovery Workflow (Timeout -> Analyze -> Pivot)
---

# Smart Retry Workflow

This workflow dictates how to handle "stuck" states, timeouts, or tool failures.

## 1. Monitor & Timeout

- **Rule**: If a tool call (especially network/LLM based) takes longer than **30 seconds** without response, or fails with a network error, consider it a FAILURE.
- **Action**: Do not just retry the exact same call immediately if it was a timeout.

## 2. Analyze the Failure

- **Diagnostic**: Look at the error message.
    - `Network error` / `Fetch failed`: Connectivity issue.
    - `Timeout`: Service unavailable or congested.
    - `400 Bad Request`: Input format issue.
- **Record**: Briefly note what went wrong in your internal thought process (or `LEARNINGS.md` if it's a new pattern).

## 3. Pivot Strategy (The "Side-Step")

Do not bang your head against the wall. If `Approach A` failed, propose `Approach B`.

### Hierarchy of Approaches:
1.  **Specialized Tool** (e.g., `perplexity`, `grep_search`) - *High Fidelity, High Risk*
2.  **Local Script** (Python/Node) - *High Control, Reliable*
3.  **Manual/Native** (CMD/Powershell) - *Lowest Common Denominator*

### The Pivot Protocol:
1.  **Acknowledge**: "The X tool failed due to Y."
2.  **Propose**: "Switching to Z strategy to unblock."
3.  **Execute**: Run the alternative immediately if safe, or ask if unsure.

## 4. Post-Recovery

- Once the task is completed via the pivot:
    - **Document**: Add an entry to `docs/LEARNINGS.md` about the failure mode.
    - **Refine**: If a specific tool is consistently failing, update `task.md` or strict workflows to avoid it in that context.
