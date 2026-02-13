import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const PROJECT_ID = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d'; // Bifrost v3

async function main() {
  let apiKey = process.env.LINEAR_API_KEY;
  const teamId = process.env.LINEAR_TEAM_ID;
  const baseUrl = process.env.LINEAR_WEBHOOK_URL;

  // Smart Key Logic: if using proxy, use PROXY_API_KEY
  if (baseUrl && baseUrl.includes('workers.dev')) {
    apiKey = process.env.PROXY_API_KEY;
  }

  if (!apiKey || !teamId) {
    console.error('LINEAR_API_KEY (or PROXY_API_KEY) or LINEAR_TEAM_ID missing');
    process.exit(1);
  }

  const client = new LinearClient(apiKey);

  // Helper to get Label ID
  const getLabelId = async (name: string) => {
    const query = `query { issueLabels(filter: { name: { eq: "${name}" } }) { nodes { id } } }`;
    const data = await client.query<{ issueLabels: { nodes: { id: string }[] } }>(query);
    return data.issueLabels.nodes[0]?.id;
  };

  const swarmReadyLabelId = await getLabelId('swarm:ready');
  if (!swarmReadyLabelId) {
    console.error('swarm:ready label not found.');
    process.exit(1);
  }

  const testTasks = [
    {
      title: '[TEST] Swarm Resilience: Simulate Runner Failure',
      description: `Verify the swarm handles task failure correctly.\n\nMetadata:\nTaskType: maintenance\nRiskProfile: medium\nPriority: 10\nBudgetMax: 1000\nSuccessCriteria: Issue marked as swarm:blocked upon failure.`,
    },
    {
      title: '[TEST] Metadata Routing: High Priority Documentation Update',
      description: `Verify the orchestrator prioritizes high-priority tasks.\n\nMetadata:\nTaskType: documentation\nRiskProfile: low\nPriority: 90\nBudgetMax: 2000\nSuccessCriteria: Task checked out before lower priority tasks.`,
    },
    {
      title: '[TEST] Security Audit: Autonomous npm audit and Fix',
      description: `Test the swarm's ability to handle dependencies.\n\nMetadata:\nTaskType: security\nRiskProfile: high\nPriority: 50\nBudgetMax: 5000\nSuccessCriteria: PR created for dependency fixes.`,
    },
    {
      title: '[TEST] Latency Optimization: RouterDO Cache Verification',
      description: `Test infrastructure-level changes.\n\nMetadata:\nTaskType: infrastructure\nRiskProfile: low\nPriority: 30\nBudgetMax: 3000\nSuccessCriteria: Cache hits logged in metrics.`,
    },
    {
      title: '[TEST] Multi-Agent Handoff: Jules to Worker-Bee Flow',
      description: `Test the orchestration to execution handoff.\n\nMetadata:\nTaskType: orchestration\nRiskProfile: low\nPriority: 40\nBudgetMax: 4000\nSuccessCriteria: Jules plans and Worker-Bee executes successfully.`,
    },
  ];

  console.log(`🚀 Seeding 5 Test Swarm issues...`);

  for (const task of testTasks) {
    const mutation = `
            mutation IssueCreate($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                    success
                    issue {
                        id
                        identifier
                    }
                }
            }
        `;

    try {
      const result = await client.query<{
        issueCreate: { success: boolean; issue: { id: string; identifier: string } };
      }>(mutation, {
        input: {
          title: task.title,
          description: task.description,
          teamId,
          projectId: PROJECT_ID,
          labelIds: [swarmReadyLabelId],
        },
      });

      if (result.issueCreate.success) {
        console.log(`✅ Created ${result.issueCreate.issue.identifier}: ${task.title}`);
      } else {
        console.error(`❌ Failed to create task: ${task.title}`);
      }
    } catch (e: any) {
      console.error(`❌ Error creating task ${task.title}:`, e.message);
    }
  }
}

main().catch(console.error);
