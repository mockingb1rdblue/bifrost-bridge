
import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const PROJECT_ID = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d'; // Bifrost v3

async function main() {
    const apiKey = process.env.LINEAR_API_KEY;
    const teamId = process.env.LINEAR_TEAM_ID;

    if (!apiKey || !teamId) {
        console.error('LINEAR_API_KEY or LINEAR_TEAM_ID missing');
        process.exit(1);
    }

    const client = new LinearClient(apiKey, 'https://api.linear.app/graphql');
    
    // Find Label IDs
    const labels = await client.query<any>(`
        query Labels($teamId: String!) {
          issueLabels(filter: { team: { id: { eq: $teamId } } }) {
            nodes { id name }
          }
        }
    `, { teamId });
    
    const swarmReadyLabel = labels.issueLabels.nodes.find((l: any) => l.name === 'swarm:ready');
    if (!swarmReadyLabel) {
        console.error('swarm:ready label not found. Run init-swarm-labels.ts first.');
        process.exit(1);
    }

    const phase6Issues = [
        {
            title: '[SWARM] Implement Resource Usage Guardrails',
            description: 'Implement budget-aware scaling in RouterDO. Stop spawning machines if monthly budget exceeds threshold.\n\nMetadata:\nTaskType: maintenance\nRisk: low',
        },
        {
            title: '[SWARM] Add Multi-Agent Negotiation Step',
            description: 'Before Phase 6 execution, have Jules and another agent peer-review the plan in a shared event topic.\n\nMetadata:\nTaskType: collaboration\nRisk: medium',
        },
        {
            title: '[SWARM] Refactor RouterDO State to KV Store',
            description: 'Move large job histories from DO storage to Cloudflare KV to improve performance.\n\nMetadata:\nTaskType: architecture\nRisk: high',
        }
    ];

    console.log(`🚀 Creating ${phase6Issues.length} Swarm-Ready issues...`);

    for (const issue of phase6Issues) {
        const result = await client.createIssue({
            title: issue.title,
            description: issue.description,
            teamId,
            projectId: PROJECT_ID,
        });
        
        // Add swarm:ready label
        await client.updateIssue(result.id, {
            labelIds: [swarmReadyLabel.id]
        });
        
        console.log(`✅ Created ${result.identifier}: ${issue.title}`);
    }
}

main().catch(console.error);
