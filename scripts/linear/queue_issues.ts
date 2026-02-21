import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

// Load .env
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Certs
const certPath = path.join(__dirname, '../.certs/corporate_bundle.pem');
if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

async function main() {
  let apiKey = process.env.LINEAR_API_KEY;
  const baseUrl = process.env.LINEAR_WEBHOOK_URL;
  const useDirect = process.argv.includes('--direct');

  if (baseUrl && baseUrl.includes('workers.dev') && !useDirect) {
    apiKey = process.env.PROXY_API_KEY;
  } else {
    apiKey = process.env.LINEAR_API_KEY;
  }

  if (!apiKey) {
    console.error(chalk.red('❌ API Key is missing in .env'));
    process.exit(1);
  }

  const finalBaseUrl = useDirect
    ? 'https://api.linear.app/graphql'
    : baseUrl || 'https://api.linear.app/graphql';
  const client = new LinearClient(apiKey, finalBaseUrl);

  const issuesToQueue = ['BIF-281'];

  console.log(chalk.bold(`🚀 Queueing Next 5 Issues:\n`));

  for (const identifier of issuesToQueue) {
    const query = `
            query($id: String!) {
                issue(id: $id) {
                    id
                    title
                    state {
                        id
                        name
                    }
                    team {
                        id
                    }
                }
            }
        `;

    try {
      const data = await client.query<{ issue: any }>(query, { id: identifier });
      const issue = data.issue;

      if (!issue) {
        console.log(chalk.red(`❌ Issue ${identifier} not found\n`));
        continue;
      }

      console.log(chalk.cyan(`   Queueing ${identifier}: ${issue.title}...`));

      // 1. Find 'In Progress' state ID and Viewer ID
      const states = await client.getWorkflowStates(issue.team.id);
      const inProgressState = states.find((s: any) => s.name === 'In Progress' || s.type === 'started');
      
      const viewerQuery = `query { viewer { id } }`;
      const viewerData = await client.query<{ viewer: { id: string } }>(viewerQuery);
      const viewerId = viewerData.viewer.id;

      // 2. Find 'sluagh:ready' label ID
      const labelsQuery = `query { issueLabels { nodes { id name } } }`;
      const labelsData = await client.query<{ issueLabels: { nodes: any[] } }>(labelsQuery);

      const readyLabel = labelsData.issueLabels.nodes.find((l) => l.name === 'sluagh:ready');

      // 3. Update Issue
      const updateMutation = `
                mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
                    issueUpdate(id: $id, input: $input) {
                        success
                    }
                }
            `;

      const input: any = {
        title: `[SWARM] [run_command] ${issue.title}`,
        description: `${issue.description || ''}\n\n\`\`\`json\n{\n  \"command\": \"echo\",\n  \"args\": [\"Autonomy test successful\"]\n}\n\`\`\``,
        assigneeId: viewerId
      };
      
      if (inProgressState) input.stateId = inProgressState.id;
      if (readyLabel) {
        input.labelIds = [readyLabel.id];
      }

      await client.query(updateMutation, { id: issue.id, input });
      console.log(chalk.green(`      ✅ Assigned to swarm + Moved to In Progress + Payload added.`));
    } catch (e: any) {
      console.error(chalk.red(`      ❌ Failed ${identifier}: ${e.message}`));
    }
  }
}

main().catch(console.error);
