
import { LinearClient } from './workers/crypt-core/src/linear';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from crypt-core if possible, or manual
const LINEAR_API_KEY = process.env.LINEAR_API_KEY || 'your-key';
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'your-team-id';

async function test() {
    console.log('Testing Linear label filtering...');
    const client = new LinearClient({
        apiKey: LINEAR_API_KEY,
        teamId: LINEAR_TEAM_ID
    });

    console.log(`Querying for 'sluagh:ready' in team ${LINEAR_TEAM_ID}...`);
    const issues = await client.listIssuesByLabel('sluagh:ready');
    console.log(`Found ${issues.length} issues.`);
    issues.forEach(i => console.log(`- ${i.identifier}: ${i.title}`));

    if (issues.length === 0) {
        console.log('Fallback: listing all issues to check labels...');
        const all = await client.listAllIssues(10);
        all.forEach(i => {
            console.log(`- ${i.identifier}: ${i.title} Labels: ${i.labels.nodes.map((l:any) => l.name).join(', ')}`);
        });
    }
}

test().catch(console.error);
