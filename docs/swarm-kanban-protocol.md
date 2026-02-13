# Swarm Kanban Protocol

The Bifrost Bridge operates on an **Autonomous Kanban Engine**. This document defines the protocol for human-to-AI collaboration and task orchestration.

## 1. The Operational Lifecycle

Tasks transition through specific states driven by metadata labels in Linear.

| Label           | Phase            | Actor    | Description                                                    |
| :-------------- | :--------------- | :------- | :------------------------------------------------------------- |
| `swarm:ready`   | **Pending**      | Human    | Task is fully defined and ready for autonomous "checkout".     |
| `swarm:active`  | **Executing**    | AI Swarm | Task has been checked out by an agent (e.g., Jules).           |
| `swarm:review`  | **Verification** | Human    | Task is complete and awaiting human validation.                |
| `swarm:blocked` | **Blocked**      | Human    | Swarm encountered an error or policy violation requiring help. |

## 2. Metadata Schema

To optimize swarm execution, include a metadata block in the Linear issue description. This allows the orchestrator to prioritize and allocate resources effectively.

```yaml
Metadata:
  Priority: 10-100 (Default: 10)
  RiskProfile: low | medium | high
  BudgetMax: Max tokens per task (Default: 5000)
  TaskType: feature | bug | documentation | maintenance
```

## 3. Autonomous Audit Trail

The swarm maintains transparency by posting automated comments:
- **Check-in**: Posted when `RouterDO` creates a job and changes label to `swarm:active`. Includes the Job ID and parsed metadata.
- **Progress**: (Optional) Agents post updates for long-running workflows.
- **Handoff**: Posted upon completion or failure. Includes a result summary and a link to artifacts or logs.

## 4. How to Assign Work

1.  Create an issue in Linear.
2.  Define the scope clearly in the description.
3.  Add the **Metadata** block.
4.  Apply the **`swarm:ready`** label.

The `custom-router` will detect the issue within its next sync cycle and initiate the checkout protocol.

---
*Bifrost Bridge v1.5.0 - Autonomous Swarm Control*
