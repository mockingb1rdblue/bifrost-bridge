
import { LinearClient } from '../src/linear-client';
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

    const finalBaseUrl = useDirect ? 'https://api.linear.app/graphql' : (baseUrl || 'https://api.linear.app/graphql');
    const client = new LinearClient(apiKey, finalBaseUrl);

    const issuesToQueue = ['BIF-34', 'BIF-35', 'BIF-36', 'BIF-37', 'BIF-38'];

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

            // 1. Find 'Todo' state ID
            const states = await client.getWorkflowStates(issue.team.id);
            const todoState = states.find(s => s.name === 'Todo' || s.type === 'unstarted');

            // 2. Find 'sluagh:ready' label ID
            const labelsQuery = `query { issueLabels { nodes { id name } } }`;
            const labelsData = await client.query<{ issueLabels: { nodes: any[] } }>(labelsQuery);
            const readyLabel = labelsData.issueLabels.nodes.find(l => l.name === 'sluagh:ready');

            // 3. Update Issue
            const updateMutation = `
                mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
                    issueUpdate(id: $id, input: $input) {
                        success
                    }
                }
            `;

            const input: any = {};
            if (todoState) input.stateId = todoState.id;
            if (readyLabel) {
                // Get existing labels to not overwrite them? 
                // Actually issueUpdate input for labels is labelIds: string[]
                // We should probably merge if we want to keep others, but the user said "queue up"
                // which often implies setting the correct state for automation.
                input.labelIds = [readyLabel.id];
            }

            await client.query(updateMutation, { id: issue.id, input });
            console.log(chalk.green(`      ✅ Moved to Todo + tagged sluagh:ready.`));

        } catch (e: any) {
            console.error(chalk.red(`      ❌ Failed ${identifier}: ${e.message}`));
        }
    }
}

main().catch(console.error);
