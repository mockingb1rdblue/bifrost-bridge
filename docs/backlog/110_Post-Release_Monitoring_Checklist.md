## Post-Release Monitoring Checklist

### Immediate (First 1 hour)

- [ ] All services healthy in production
- [ ] Error rates within normal range
- [ ] Response times acceptable
- [ ] No spike in support tickets

### Short-term (First 24 hours)

- [ ] Monitor key metrics dashboards
- [ ] Review production logs for anomalies
- [ ] Check user-facing features working
- [ ] Verify database migrations completed

### Communication

- [ ] Announce release in #engineering
- [ ] Update status page
- [ ] Notify customer success team
- [ ] Post release notes to changelog

### Rollback Plan

- [ ] Document rollback procedure
- [ ] Keep previous version tagged
- [ ] Identify rollback decision makers
      `.trim();
    await this.orchestrator.createIssue({
      projectId: releaseProjectId,
      title: `${version} - Post-Release Monitoring`,
      description: checklist,
      priority: 'urgent',
      labels: ['monitoring', 'release'],
      assigneeId: await this.orchestrator.getDefaultAssignee()
      });
      }
      }

````

***

### 6. **Enhanced MCP Tools**

```typescript
// linear-mcp-server/src/index.ts - Additional tools

const enhancedTools = [
  {
    name: 'log_engineering_work',
    description: 'Add structured engineering log to issue (what worked, what didn\'t, lessons learned)',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' },
        what_was_done: { type: 'string' },
        what_worked: { type: 'array', items: { type: 'string' } },
        what_didnt_work: { type: 'array', items: { type: 'string' } },
        lessons_learned: { type: 'array', items: { type: 'string' } },
        technical_decisions: { type: 'array', items: { type: 'object' } }
      },
      required: ['issue_key', 'what_was_done']
    }
  },
  {
    name: 'track_cicd_run',
    description: 'Record CI/CD pipeline execution on issue with status and logs',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' },
        pipeline_url: { type: 'string' },
        status: { type: 'string', enum: ['pending', 'running', 'success', 'failure'] },
        stage: { type: 'string' },
        logs: { type: 'string' }
      },
      required: ['issue_key', 'status']
    }
  },
  {
    name: 'track_deployment',
    description: 'Record deployment to environment (dev/staging/production)',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' },
        environment: { type: 'string', enum: ['dev', 'staging', 'production'] },
        status: { type: 'string', enum: ['deploying', 'success', 'failed', 'rolled_back'] },
        version: { type: 'string' },
        url: { type: 'string' }
      },
      required: ['issue_key', 'environment', 'status', 'version']
    }
  },
  {
    name: 'execute_release_workflow',
    description: 'Automated release workflow: version bump, release notes, GitHub release, monitoring setup',
    inputSchema: {
      type: 'object',
      properties: {
        milestone_id: { type: 'string' },
        release_type: { type: 'string', enum: ['major', 'minor', 'patch', 'hotfix'] }
      },
      required: ['milestone_id', 'release_type']
    }
  },
  {
    name: 'suggest_labels',
    description: 'AI-powered label suggestion based on issue content',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' }
      },
      required: ['issue_key']
    }
  },
  {
    name: 'create_issue_branch',
    description: 'Create properly named Git branch for issue following git-flow conventions',
    inputSchema: {
      type: 'object',
      properties: {
        issue_key: { type: 'string' }
      },
      required: ['issue_key']
    }
  }
];
````

---
