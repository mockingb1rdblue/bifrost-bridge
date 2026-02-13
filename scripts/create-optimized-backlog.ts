
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

    const client = new LinearClient({ apiKey, teamId });
    
    const swarmReadyLabelId = await client.getLabelIdByName(teamId, 'swarm:ready');
    if (!swarmReadyLabelId) {
        console.error('swarm:ready label not found. Run init-swarm-labels.ts first.');
        process.exit(1);
    }

    const optimizedTasks = [
        {
            title: '[SWARM] Implement Distributed Cache in RouterDO',
            description: `Implement a Cloudflare KV-backed cache for model routing decisions to reduce latency.\n\nMetadata:\nTaskType: infrastructure\nRiskProfile: low\nPriority: 25\nBudgetMax: 2000\nSuccessCriteria: <10ms cache retrieval`,
        },
        {
            title: '[SWARM] Enhance Collaboration Triage with Multi-Model Voting',
            description: `Update the triage logic to require consensus from at least two different models (e.g., Claude and Gemini) for high-risk decisions.\n\nMetadata:\nTaskType: orchestration\nRiskProfile: medium\nPriority: 15\nBudgetMax: 5000\nSuccessCriteria: Consensus logic implemented and tested`,
        },
        {
            title: '[SWARM] Automate Dependency Vulnerability Remediation',
            description: `Create a recurring job that runs npm audit, parses results, and autonomously creates PRs for fixed dependencies.\n\nMetadata:\nTaskType: security\nRiskProfile: medium\nPriority: 30\nBudgetMax: 3000\nSuccessCriteria: Zero high-severity vulnerabilities`,
        }
    ];

    console.log(`🚀 Seeding ${optimizedTasks.length} Optimized Swarm issues...`);

    for (const task of optimizedTasks) {
        const result = await client.createIssue({
            title: task.title,
            description: task.description,
            teamId,
            projectId: PROJECT_ID,
        });
        
        // Add swarm:ready label
        await client.updateIssue(result.id, {
            labelIds: [swarmReadyLabelId]
        });
        
        console.log(`✅ Created ${result.identifier}: ${task.title}`);
    }
}

main().catch(console.error);
