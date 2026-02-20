# Linear Integration Specification

> [!IMPORTANT]
> **Status**: Approved for Implementation
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `103_Technical_Architecture.md`

## Overview

The **Linear Orchestrator** is a high-level TypeScript SDK/Tool designed to manage project lifecycles autonomously. It goes beyond simple issue tracking to enable "Project-as-Code" and intelligent scheduling.

## Core Components

### 1. `LinearOrchestrator` Class

- **Purpose**: High-level abstraction over `@linear/sdk`.
- **Capabilities**:
  - `createProject(spec)`: Creates Project + Milestones + Epics + Tasks + Dependencies in one atomic operation.
  - `createDependencyChain(ids)`: Links tasks as blockers.
  - `updateProjectStatus(milestone, status)`: Bulk updates.

### 2. `ProjectSpecParser`

- **Purpose**: Converts natural language into structured JSON specs.
- **Integration**: Uses Perplexity/LLM to "reason" about the project structure before creating it.
- **Parsing logic**:
  - Epic Breakdown (3-7 major components)
  - Task Breakdown (5-10 tasks per epic)
  - Milestone Distribution (Weekly/Bi-weekly)

### 3. MCP Tool Definition

- **Tool**: `create_structured_project`
- **Input**:
  ```json
  {
    "name": "Project Name",
    "description": "Natural language description...",
    "duration_weeks": 12,
    "use_ai_enhancement": true
  }
  ```

## Implementation Snippets

### Project Creation Logic

```typescript
async createProject(spec: ProjectSpec): Promise<ProjectResult> {
    // 1. Create Project
    const project = await this.client.projectCreate({ ... });

    // 2. Create Milestones
    const milestones = await this.createMilestones(project.id, spec.milestones);

    // 3. Create Epics (issues with 'Epic' label)
    const epics = await this.createEpics(project.id, spec.epics, milestones);

    // 4. Create Tasks (child issues)
    const tasks = await this.createTasks(epics, spec.tasks, milestones);

    // 5. Link Dependencies
    await this.createDependencies(tasks, spec.dependencies);
}
```

### Dependency chaining

```typescript
async createDependencies(tasks: any[], dependencies: DependencySpec[]) {
    for (const dep of dependencies) {
       await this.client.issueRelationCreate({
          issueId: dep.blockedId,
          relatedIssueId: dep.blockerId,
          type: 'blocks'
       });
    }
}
```

## Strategic Value

This enables the **Architect Agent** to simply say "Build a 12-week plan for a React migration" and have the entire Gantt-chart-ready structure appear in Linear instantly, rather than creating 50 tickets manually.
