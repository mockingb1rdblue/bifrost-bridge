## Core Capabilities

### 1. **Project Creation from Natural Language**

```typescript
// User prompt to Antigravity:
"Create a project called 'Bifrost Bridge MVP' with:
- TLDR: Corporate network bypass toolkit
- Description: Full markdown doc with architecture, phases, milestones
- 3 month timeline with 8 milestones
- 4 priority levels distributed across tasks
- Parent-child relationships for epic breakdown
- Blocked-by relationships for dependencies"

// Agent creates:
// 1. Project entity
// 2. Milestone structure
// 3. Epic issues (parents)
// 4. Task issues (children)
// 5. All relationships
// 6. Proper priority distribution
```

### 2. **Hierarchical Project Structure** [developers.google](https://developers.google.com/issue-tracker/concepts/parent-child-relationships)

Support full issue relationship modeling:

- **Parent → Children** (Epic breakdown into tasks) [developers.google](https://developers.google.com/issue-tracker/concepts/parent-child-relationships)
- **Blocked By / Blocking** (Dependencies) [community.fibery](https://community.fibery.io/t/done-add-blocking-blocked-by-to-issues-and-projects-in-linear-integration/8483)
- **Related To** (Cross-references)
- **Duplicate Of** (Issue consolidation)

### 3. **Intelligent Milestone Planning**

Agent analyzes project scope and automatically:

- Creates milestone structure (weekly, bi-weekly, or monthly)
- Distributes issues across milestones
- Adjusts based on priority and dependencies
- Sets realistic dates based on typical project velocity

### 4. **Status & Priority Management**

- Auto-assign workflow states based on project phase
- Intelligent priority distribution (not everything is urgent)
- Status progression automation (moves issues through states)
- SLA tracking for high-priority items

---
