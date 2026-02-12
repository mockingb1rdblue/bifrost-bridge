/**
 * Bulk create Fly.io migration issues in Linear
 * Using DIRECT Linear API (bypassing proxy due to auth issues)
 */

import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const PROJECT_ID = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d'; // Bifrost v3
const TEAM_ID = process.env.LINEAR_TEAM_ID!;

interface Issue {
  id: string;
  title: string;
  desc: string;
}

// Simplified issue list with only essential info
const issues: Issue[] = [
  // Infrastructure (4)
  { id: 'FLY-001', title: 'Initialize Fly.io Account & CLI', desc: '**P1 | 15min**\n\nInstall flyctl, authenticate, verify access\n\nSteps:\n1. curl -L https://fly.io/install.sh | sh\n2. flyctl auth login\n3. flyctl auth whoami' },
  { id: 'FLY-002', title: 'Create bifrost-runner App', desc: '**P1 | 10min**\n\nRun: flyctl apps create bifrost-runner\nDeps: FLY-001' },
  { id: 'FLY-003', title: 'Create bifrost-events App', desc: '**P1 | 10min**\n\nRun: flyctl apps create bifrost-events\nDeps: FLY-001' },
  { id: 'FLY-004', title: 'Configure WireGuard 6PN', desc: '**P1 | 20min**\n\nRun: flyctl wireguard create\nSave to .fly/wireguard.conf\nDeps: FLY-001' },
  
  // Sprites (8) - MONTH 2 PRIORITY
  { id: 'FLY-028', title: 'Research Sprites vs Machines', desc: '**P1 | 60min** 🔥 MONTH 2\n\nCompare state persistence, cold start, costs\nDoc: docs/sprites_evaluation.md\nRef: _INBOX/flyio_more_upgrades.md' },
  { id: 'FLY-029', title: 'Design Sprite Allocation Strategy', desc: '**P1 | 45min** 🔥 MONTH 2\n\nDecide: 1 Sprite/repo vs pooled\nDoc: docs/sprite_allocation.md\nDeps: FLY-028' },
  { id: 'FLY-030', title: 'Add Sprite API Client', desc: '**P1 | 60min** 🔥 MONTH 2\n\nFunctions: createSprite(), pauseSprite(), resumeSprite()\nFile: workers/custom-router/src/sprite-client.ts\nDeps: FLY-015' },
  { id: 'FLY-031', title: 'Implement Sprite Lifecycle', desc: '**P1 | 75min** 🔥 MONTH 2\n\nPause after batch (not shutdown), resume in 1-2s\nPreserve: repos, deps, working tree\nFile: workers/bifrost-runner/src/sprite-lifecycle.ts\nDeps: FLY-030' },
  { id: 'FLY-032', title: 'Add Repo Clone Detection', desc: '**P1 | 30min** 🔥 MONTH 2\n\nCheck /.sprite/repos/{name}, skip if exists (saves 20s)\nFile: workers/bifrost-runner/src/repo-manager.ts\nDeps: FLY-031' },
  { id: 'FLY-033', title: 'Dependency Cache Check', desc: '**P2 | 45min**\n\nHash package.json, skip npm install if unchanged (saves 30s)\nFile: workers/bifrost-runner/src/dep-cache.ts\nDeps: FLY-031' },
  { id: 'FLY-034', title: 'Sprite Checkpoint Creation', desc: '**P2 | 60min**\n\nCreate checkpoint after batch, keep last 5\nSave to /.sprite/checkpoints/\nDeps: FLY-031' },
  { id: 'FLY-035', title: 'Sprite Health Check', desc: '**P2 | 45min**\n\nVerify before resume, rollback to checkpoint if corrupted\nFile: workers/bifrost-runner/src/health-check.ts\nDeps: FLY-034' },
  
  // Agent Runners (4)
  { id: 'FLY-013', title: 'Base Dockerfile for Agent', desc: '**P1 | 30min**\n\nFROM node:20-slim, <100MB\nFile: workers/bifrost-runner/Dockerfile' },
  { id: 'FLY-014', title: 'Add Git & Build Tools', desc: '**P1 | 20min**\n\napt-get install git curl build-essential\nDeps: FLY-013' },
  { id: 'FLY-015', title: 'Add Fly Machines API Client', desc: '**P2 | 15min**\n\nnpm install @flydotio/fly-api\nFile: workers/custom-router/package.json' },
  { id: 'FLY-016', title: 'Implement Machine Spawn', desc: '**P2 | 60min**\n\nFunction: spawnRunner(taskId) → machineId\nFile: workers/custom-router/src/fly-client.ts\nDeps: FLY-015' },
  
  // Event Store (5)
  { id: 'FLY-010', title: 'Create Volume for Events', desc: '**P1 | 10min**\n\nflyctl volumes create events_data --size 10 --region sea\nDeps: FLY-003' },
  { id: 'FLY-011', title: 'SQLite Event Schema', desc: '**P1 | 30min**\n\nCREATE TABLE events(id, timestamp, agent_id, action, payload)\nFile: workers/bifrost-events/schema.sql' },
  { id: 'FLY-012', title: 'Event Store HTTP API', desc: '**P1 | 60min**\n\nPOST /append, GET /query\nFile: workers/bifrost-events/src/api.ts\nDeps: FLY-011' },
  { id: 'FLY-013-E', title: 'Private-Only Event Access', desc: '**P1 | 20min**\n\nservices.internal_port=8080, no public ports\nFile: workers/bifrost-events/fly.toml\nDeps: FLY-003' },
  { id: 'FLY-014-E', title: 'Deploy Event Store', desc: '**P1 | 20min**\n\nflyctl deploy --app bifrost-events\nDeps: FLY-010, FLY-012, FLY-013-E' },
  
  // Security (4)
  { id: 'FLY-020', title: 'Event API Auth', desc: '**P1 | 30min**\n\nCheck Authorization: Bearer token, 401 if invalid\nFile: workers/bifrost-events/src/api.ts\nDeps: FLY-012' },
  { id: 'FLY-021', title: 'Configure Worker Secrets', desc: '**P1 | 10min**\n\nwrangler secret put FLY_API_TOKEN\nwrangler secret put EVENTS_SECRET' },
  { id: 'FLY-022', title: 'Test WireGuard Isolation', desc: '**P1 | 20min**\n\nPublic curl fails, WireGuard curl succeeds\nDeps: FLY-013-E, FLY-004' },
  { id: 'FLY-019', title: 'Disable SSH on Runners', desc: '**P1 | 10min**\n\nRemove enable_consul from fly.toml\nFile: workers/bifrost-runner/fly.toml' },
  
  // Testing (3)
  { id: 'FLY-025', title: 'E2E Runner Lifecycle Test', desc: '**P2 | 90min**\n\nSpawn, execute, verify event, shutdown\nFile: scripts/test_runner_lifecycle.ts\nDeps: FLY-016' },
  { id: 'FLY-026', title: 'Load Test Event Store', desc: '**P3 | 60min**\n\nWrite 1000 events, query all, verify no loss\nFile: scripts/load_test_events.ts\nDeps: FLY-014-E' },
  { id: 'FLY-027', title: 'Verify Cost Posture', desc: '**P3 | 30min**\n\nIdle=$0, event store on reserved, monthly<$50' },
  
  // Autoscaling (3)
  { id: 'FLY-036', title: 'Sprite Pooling Registry', desc: '**P2 | 60min** MONTH 3\n\nTrack: repo, status, task_count\nFile: workers/custom-router/src/sprite-pool.ts' },
  { id: 'FLY-037', title: 'Queue-Depth Scaling', desc: '**P2 | 75min** MONTH 3\n\nSpawn Sprite when queue>threshold, cap at 5\nDeps: FLY-036' },
  { id: 'FLY-038', title: 'Autoscaling Cost Guardrails', desc: '**P2 | 45min** MONTH 3\n\nCheck cost before scaling, queue if over budget\nDeps: FLY-037' },
];

async function main() {
  console.log(`🚀 Creating ${issues.length} Fly.io migration issues in Linear\n`);
  
  // Use DIRECT Linear API (bypass proxy)
  const baseURL = 'https://api.linear.app/graphql';
  const apiKey = process.env.LINEAR_API_KEY;
  
  if (!apiKey) {
    console.error('ERROR: LINEAR_API_KEY not found in .env');
    process.exit(1);
  }
  
  console.log(`Using DIRECT Linear API: ${baseURL}`);
  console.log(`API key: ${apiKey.substring(0, 15)}...`);
  
  // Linear Client constructor signature: (apiKey, baseURL)
  const client = new LinearClient(apiKey, baseURL);
  const created: string[] = [];
  
  for (const issue of issues) {
    try {
      const title = `[${issue.id}] ${issue.title}`;
      
      console.log(`Creating: ${title}`);
      
      const result = await client.createIssue({
        teamId: TEAM_ID,
        title,
        description: issue.desc,
        projectId: PROJECT_ID
      });
      
      created.push(result.identifier);
      console.log(`✓ ${result.identifier}\n`);
      
    } catch (error) {
      console.error(`✗ Failed ${issue.id}:`, error);
    }
  }
  
  console.log(`\n✅ Created ${created.length}/${issues.length} issues`);
  console.log(created.join(', '));
}

main().catch(console.error);
