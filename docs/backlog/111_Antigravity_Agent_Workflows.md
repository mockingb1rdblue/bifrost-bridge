## Antigravity Agent Workflows

### Workflow 1: Complete Feature Development

```
Developer prompt:
"I just finished implementing the certificate extraction feature. 
Log the engineering work, track the successful CI run, and deploy to staging."

Agent executes:
1. log_engineering_work - Captures implementation details
2. track_cicd_run - Records successful pipeline
3. track_deployment - Marks deployed to staging
4. Updates labels automatically (deployed-staging, ci-passed)
```

### Workflow 2: Release Preparation

```
Developer prompt:
"Milestone 'Phase 1' is complete. Execute release workflow for minor version."

Agent executes:
1. Verifies all issues completed
2. Generates version 0.2.0
3. Creates release branch
4. Generates release notes from Linear issues
5. Creates GitHub release
6. Sets up monitoring checklist issue
7. Returns release URL and next steps
```

### Workflow 3: Post-Mortem Documentation

```
Developer prompt:
"The MCP proxy deployment failed. Document what went wrong: 
SSL certificate chain was incomplete, needed root CA. 
Fixed by updating cert extraction script. Lesson: always validate full chain."

Agent executes:
1. log_engineering_work with failure analysis
2. Creates "Lessons Learned" label if not exists
3. Links to related documentation
4. Suggests creating a checklist issue for future validations
```

***
