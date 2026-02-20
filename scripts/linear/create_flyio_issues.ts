/**
 * Create Thin-Sliced Fly.io Migration Issues in Linear
 *
 * This script creates 27 atomic tasks optimized for low-reasoning LLM execution.
 * Each task is <90 min, single-objective, with clear acceptance criteria.
 */

import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const PROJECT_ID = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d'; // Bifrost v3

interface IssueSpec {
  identifier: string;
  title: string;
  description: string;
  priority: 1 | 2 | 3 | 4;
  estimate: number; // minutes
  dependencies?: string[];
}

const issues: IssueSpec[] = [
  // Infrastructure Foundation
  {
    identifier: 'FLY-001',
    title: 'Initialize Fly.io Account & CLI',
    description: `**Task**: Install flyctl, authenticate, verify access

**Acceptance Criteria**:
- \`flyctl auth whoami\` returns valid user
- CLI version >= 0.2.0

**Steps**:
1. Run \`curl -L https://fly.io/install.sh | sh\`
2. Run \`flyctl auth login\`
3. Verify with \`flyctl auth whoami\`

**Files**: None
**Estimated**: 15 min`,
    priority: 1,
    estimate: 15,
  },
  {
    identifier: 'FLY-002',
    title: 'Create bifrost-runner App Scaffold',
    description: `**Task**: Initialize Fly.io app for agent runners

**Acceptance Criteria**:
- App visible in \`flyctl apps list\`
- Initial \`fly.toml\` created

**Steps**:
1. Run \`flyctl apps create bifrost-runner\`
2. Verify app creation

**Files**: \`workers/bifrost-runner/fly.toml\`
**Dependencies**: FLY-001
**Estimated**: 10 min`,
    priority: 1,
    estimate: 10,
    dependencies: ['FLY-001'],
  },
  {
    identifier: 'FLY-003',
    title: 'Create bifrost-events App Scaffold',
    description: `**Task**: Initialize Fly.io app for event store

**Acceptance Criteria**:
- App visible in dashboard
- Initial \`fly.toml\` for event store created

**Steps**:
1. Run \`flyctl apps create bifrost-events\`
2. Verify app creation

**Files**: \`workers/bifrost-events/fly.toml\`
**Dependencies**: FLY-001
**Estimated**: 10 min`,
    priority: 1,
    estimate: 10,
    dependencies: ['FLY-001'],
  },
  {
    identifier: 'FLY-004',
    title: 'Configure WireGuard Private Network',
    description: `**Task**: Set up 6PN secure access to Fly.io

**Acceptance Criteria**:
- Can ping Fly.io internal DNS
- WireGuard config saved

**Steps**:
1. Run \`flyctl wireguard create\`
2. Save config to \`.fly/wireguard.conf\`
3. Test connectivity

**Files**: \`.fly/wireguard.conf\`
**Dependencies**: FLY-001
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-001'],
  },

  // Agent Runner Implementation
  {
    identifier: 'FLY-005',
    title: 'Create Base Dockerfile for Agent Runtime',
    description: `**Task**: Write Dockerfile using node:20-slim

**Acceptance Criteria**:
- Builds without errors
- Image size < 100MB

**Steps**:
1. Create \`workers/bifrost-runner/Dockerfile\`
2. Use \`FROM node:20-slim\`
3. Copy package files
4. Run \`npm ci\`

**Files**: \`workers/bifrost-runner/Dockerfile\`
**Estimated**: 30 min`,
    priority: 1,
    estimate: 30,
  },
  {
    identifier: 'FLY-006',
    title: 'Add Git & Build Tools to Docker Image',
    description: `**Task**: Extend Dockerfile with system dependencies

**Acceptance Criteria**:
- \`docker run bifrost-runner git --version\` works
- All build tools present

**Steps**:
1. Add \`RUN apt-get update && apt-get install -y git curl build-essential\`
2. Clean up apt cache
3. Test build

**Files**: \`workers/bifrost-runner/Dockerfile\`
**Dependencies**: FLY-005
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-005'],
  },
  {
    identifier: 'FLY-007',
    title: 'Configure Auto-Stop Behavior in fly.toml',
    description: `**Task**: Enable scale-to-zero for runners

**Acceptance Criteria**:
- Config validates with \`flyctl config validate\`
- auto_stop and auto_start enabled

**Steps**:
1. Edit \`workers/bifrost-runner/fly.toml\`
2. Add \`auto_stop_machines = true\`
3. Add \`auto_start_machines = true\`
4. Validate config

**Files**: \`workers/bifrost-runner/fly.toml\`
**Dependencies**: FLY-002
**Estimated**: 15 min`,
    priority: 1,
    estimate: 15,
    dependencies: ['FLY-002'],
  },
  {
    identifier: 'FLY-008',
    title: 'Implement Inactivity Timer in Agent Code',
    description: `**Task**: Add auto-shutdown logic to agent

**Acceptance Criteria**:
- Agent exits after 5 min idle
- Fly stops Machine automatically

**Steps**:
1. Add \`AUTOSLEEP_MINUTES\` env var
2. Implement idle timer
3. Call \`process.exit(0)\` on timeout
4. Test locally

**Files**: \`workers/bifrost-runner/src/agent.ts\`
**Dependencies**: FLY-005
**Estimated**: 45 min`,
    priority: 2,
    estimate: 45,
    dependencies: ['FLY-005'],
  },
  {
    identifier: 'FLY-009',
    title: 'Deploy First Test Runner Machine',
    description: `**Task**: Deploy runner to Fly.io

**Acceptance Criteria**:
- Machine visible in dashboard
- Responds to health check

**Steps**:
1. Run \`flyctl deploy --app bifrost-runner\`
2. Check \`flyctl status\`
3. Verify health

**Files**: None
**Dependencies**: FLY-005, FLY-007
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-005', 'FLY-007'],
  },

  // Event Store Setup
  {
    identifier: 'FLY-010',
    title: 'Create Persistent Volume for Event Log',
    description: `**Task**: Provision storage for SQLite

**Acceptance Criteria**:
- Volume listed in \`flyctl volumes list\`
- Size = 10GB

**Steps**:
1. Run \`flyctl volumes create events_data --size 10 --region sea\`
2. Verify creation

**Files**: None
**Dependencies**: FLY-003
**Estimated**: 10 min`,
    priority: 1,
    estimate: 10,
    dependencies: ['FLY-003'],
  },
  {
    identifier: 'FLY-011',
    title: 'Write SQLite Schema for Event Log',
    description: `**Task**: Define immutable event table

**Acceptance Criteria**:
- Schema applies cleanly
- No syntax errors

**Schema**:
\`\`\`sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSON NOT NULL
);
CREATE INDEX idx_timestamp ON events(timestamp);
\`\`\`

**Files**: \`workers/bifrost-events/schema.sql\`
**Estimated**: 30 min`,
    priority: 1,
    estimate: 30,
  },
  {
    identifier: 'FLY-012',
    title: 'Create Event Store HTTP API',
    description: `**Task**: Minimal Express server for event log

**Acceptance Criteria**:
- \`POST /append\` writes to SQLite
- \`GET /query\` reads back events

**Endpoints**:
- \`POST /append\` - Accept { agent_id, action, payload }
- \`GET /query?since=<timestamp>\` - Return events

**Files**: \`workers/bifrost-events/src/api.ts\`
**Dependencies**: FLY-011
**Estimated**: 60 min`,
    priority: 1,
    estimate: 60,
    dependencies: ['FLY-011'],
  },
  {
    identifier: 'FLY-013',
    title: 'Configure Private-Only Access for Event Store',
    description: `**Task**: Lock down event API to 6PN

**Acceptance Criteria**:
- Event API only reachable via \`bifrost-events.flycast\`
- No public ports

**Steps**:
1. Set \`services.internal_port = 8080\`
2. Remove all public port bindings
3. Test from WireGuard

**Files**: \`workers/bifrost-events/fly.toml\`
**Dependencies**: FLY-003
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-003'],
  },
  {
    identifier: 'FLY-014',
    title: 'Deploy Event Store to Fly.io',
    description: `**Task**: Deploy event store app

**Acceptance Criteria**:
- Health check passes
- Volume mounted at /data

**Steps**:
1. Run \`flyctl deploy --app bifrost-events\`
2. Verify mount point
3. Test API

**Files**: None
**Dependencies**: FLY-010, FLY-012, FLY-013
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-010', 'FLY-012', 'FLY-013'],
  },

  // Control Plane Integration
  {
    identifier: 'FLY-015',
    title: 'Add Fly.io Machines API Client',
    description: `**Task**: Install Fly API package

**Acceptance Criteria**:
- Build passes
- No type errors

**Steps**:
1. \`npm install @flydotio/fly-api\`
2. Add to RouterDO imports

**Files**: \`workers/custom-router/package.json\`, \`router-do.ts\`
**Estimated**: 15 min`,
    priority: 2,
    estimate: 15,
  },
  {
    identifier: 'FLY-016',
    title: 'Implement Machine Spawn Function',
    description: `**Task**: Create function to spawn runner

**Acceptance Criteria**:
- Function creates Machine
- Returns Machine ID

**Signature**:
\`\`\`typescript
async function spawnRunner(taskId: string): Promise<string>
\`\`\`

**Files**: \`workers/custom-router/src/fly-client.ts\`
**Dependencies**: FLY-015
**Estimated**: 60 min`,
    priority: 2,
    estimate: 60,
    dependencies: ['FLY-015'],
  },
  {
    identifier: 'FLY-017',
    title: 'Add Event Store Client to RouterDO',
    description: `**Task**: Create client to write events

**Acceptance Criteria**:
- Can write events from Worker to Fly event store
- Handles network errors

**Class**:
\`\`\`typescript
class EventStoreClient {
  async append(event: Event): Promise<void>
}
\`\`\`

**Files**: \`workers/custom-router/src/event-client.ts\`
**Dependencies**: FLY-014
**Estimated**: 45 min`,
    priority: 2,
    estimate: 45,
    dependencies: ['FLY-014'],
  },
  {
    identifier: 'FLY-018',
    title: 'Update Task Creation to Log Events',
    description: `**Task**: Integrate event logging

**Acceptance Criteria**:
- Every task creates event in SQLite log

**Steps**:
1. Import EventStoreClient
2. In \`createTask()\`, add \`eventStore.append({...})\`
3. Test event written

**Files**: \`workers/custom-router/src/router-do.ts\`
**Dependencies**: FLY-017
**Estimated**: 30 min`,
    priority: 2,
    estimate: 30,
    dependencies: ['FLY-017'],
  },

  // Security Hardening
  {
    identifier: 'FLY-019',
    title: 'Disable SSH on All Runner Machines',
    description: `**Task**: Lock down runner access

**Acceptance Criteria**:
- SSH fails when attempted

**Steps**:
1. Remove \`[experimental.enable_consul]\` from fly.toml
2. Redeploy
3. Test SSH rejection

**Files**: \`workers/bifrost-runner/fly.toml\`
**Dependencies**: FLY-007
**Estimated**: 10 min`,
    priority: 1,
    estimate: 10,
    dependencies: ['FLY-007'],
  },
  {
    identifier: 'FLY-020',
    title: 'Add Auth Token Validation to Event API',
    description: `**Task**: Protect event endpoints

**Acceptance Criteria**:
- Requests without valid token return 401

**Steps**:
1. Check \`Authorization: Bearer <EVENTS_SECRET>\`
2. Reject invalid requests
3. Test auth flow

**Files**: \`workers/bifrost-events/src/api.ts\`
**Dependencies**: FLY-012
**Estimated**: 30 min`,
    priority: 1,
    estimate: 30,
    dependencies: ['FLY-012'],
  },
  {
    identifier: 'FLY-021',
    title: 'Configure Cloudflare Worker Secrets for Fly Auth',
    description: `**Task**: Add Fly.io credentials to Workers

**Acceptance Criteria**:
- Secrets present in Worker env

**Steps**:
1. Run \`wrangler secret put FLY_API_TOKEN\`
2. Run \`wrangler secret put EVENTS_SECRET\`
3. Verify in dashboard

**Files**: None
**Estimated**: 10 min`,
    priority: 1,
    estimate: 10,
  },
  {
    identifier: 'FLY-022',
    title: 'Test WireGuard-Only Access',
    description: `**Task**: Verify 6PN isolation

**Acceptance Criteria**:
- Public access fails
- WireGuard access succeeds

**Tests**:
- \`curl https://bifrost-events.fly.dev\` → fails
- \`curl http://bifrost-events.flycast:8080\` → succeeds

**Files**: None
**Dependencies**: FLY-013, FLY-004
**Estimated**: 20 min`,
    priority: 1,
    estimate: 20,
    dependencies: ['FLY-013', 'FLY-004'],
  },

  // Cost Optimization
  {
    identifier: 'FLY-023',
    title: 'Allocate Performance Block for Event Store',
    description: `**Task**: Reserve capacity for always-on event store

**Acceptance Criteria**:
- Event store on reserved capacity
- ~30% cost reduction visible

**Steps**:
1. Go to Fly.io dashboard
2. Allocate 1x shared-cpu-1x block
3. Assign to bifrost-events

**Files**: None
**Dependencies**: FLY-014
**Estimated**: 15 min`,
    priority: 3,
    estimate: 15,
    dependencies: ['FLY-014'],
  },
  {
    identifier: 'FLY-024',
    title: 'Configure Scale-to-Zero for Runners',
    description: `**Task**: Set autoscaling policy

**Acceptance Criteria**:
- No idle runners after 5 min
- Wakes on Worker request

**Config**:
\`\`\`toml
[[services.autoscaling]]
  min = 0
  max = 10
\`\`\`

**Files**: \`workers/bifrost-runner/fly.toml\`
**Dependencies**: FLY-007
**Estimated**: 20 min`,
    priority: 2,
    estimate: 20,
    dependencies: ['FLY-007'],
  },

  // Testing
  {
    identifier: 'FLY-025',
    title: 'E2E Test for Runner Lifecycle',
    description: `**Task**: Automated test for full workflow

**Test Steps**:
1. Spawn Machine via Worker
2. Execute simple task
3. Verify event logged
4. Confirm Machine shuts down

**Files**: \`scripts/test_runner_lifecycle.ts\`
**Dependencies**: FLY-016, FLY-018
**Estimated**: 90 min`,
    priority: 2,
    estimate: 90,
    dependencies: ['FLY-016', 'FLY-018'],
  },
  {
    identifier: 'FLY-026',
    title: 'Load Test Event Store',
    description: `**Task**: Verify event store performance

**Test**:
- Write 1000 events rapidly
- Query all back
- Verify no data loss

**Files**: \`scripts/load_test_events.ts\`
**Dependencies**: FLY-014
**Estimated**: 60 min`,
    priority: 3,
    estimate: 60,
    dependencies: ['FLY-014'],
  },
  {
    identifier: 'FLY-027',
    title: 'Verify Cost Posture',
    description: `**Task**: Manual verification of costs

**Checks**:
- Idle usage = $0
- Event store on reserved block
- Total monthly cost < $50

**Files**: None
**Dependencies**: FLY-023, FLY-024
**Estimated**: 30 min`,
    priority: 3,
    estimate: 30,
    dependencies: ['FLY-023', 'FLY-024'],
  },
];

async function main() {
  console.log('Creating 27 thin-sliced Fly.io migration issues...\n');

  const baseURL = process.env.LINEAR_WEBHOOK_URL || 'https://linear-proxy.mock1ng.workers.dev';
  const apiKey = process.env.PROXY_API_KEY || process.env.LINEAR_API_KEY;

  if (!apiKey) {
    throw new Error('No API key found');
  }

  const client = new LinearClient(baseURL, apiKey);
  const createdIssues: string[] = [];

  for (const spec of issues) {
    try {
      const title = `[FLY-${spec.identifier}] ${spec.title}`;

      // Add priority and estimate to description
      const fullDescription = `**Priority**: P${spec.priority} | **Estimate**: ${spec.estimate} min\n\n${spec.description}`;

      console.log(`Creating: ${title}`);

      const result = await client.createIssue({
        title,
        description: fullDescription,
        projectId: PROJECT_ID,
        teamId: process.env.LINEAR_TEAM_ID!,
      });

      createdIssues.push(result.identifier);
      console.log(`✓ Created ${result.identifier}\n`);
    } catch (error) {
      console.error(`✗ Failed to create ${spec.identifier}:`, error);
    }
  }

  console.log(`\n✅ Created ${createdIssues.length} issues:`);
  console.log(createdIssues.join(', '));
}

main().catch(console.error);
