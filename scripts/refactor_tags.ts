
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

    const finalBaseUrl = useDirect ? 'https://api.linear.app/graphql' : baseUrl;
    const client = new LinearClient(apiKey, finalBaseUrl);

    console.log(chalk.bold(`🚀 Starting Linear Tag Refactor...\n`));

    // 1. Fetch current labels to get IDs
    const listQuery = `
        query {
            issueLabels {
                nodes {
                    id
                    name
                }
            }
        }
    `;

    const listData = await client.query<{ issueLabels: { nodes: any[] } }>(listQuery);
    const existingLabels = listData.issueLabels.nodes;

    const toDelete = [
        'agent:jules',
        'gurps',
        'discord',
        'M1: Production Stability',
        'M2: Mechanics Complete',
        'M3: Social & Factions',
        'M3: Operations Alpha',
        'M4: Public Beta',
        'context-mini',
        'context-micro',
        'context-nano'
    ];

    const toCreate = [
        { name: 'agent:deepseek', color: '#14B8A6' },
        { name: 'agent:gemini', color: '#3B82F6' },
        { name: 'agent:perplexity', color: '#F59E0B' },
        { name: 'agent:anthropic', color: '#EF4444' }
    ];

    // Delete Useless Tags
    for (const labelName of toDelete) {
        const label = existingLabels.find(l => l.name === labelName);
        if (label) {
            console.log(chalk.yellow(`   🗑️ Deleting ${labelName}...`));
            const deleteMutation = `
                mutation LabelDelete($id: String!) {
                    issueLabelDelete(id: $id) {
                        success
                    }
                }
            `;
            try {
                await client.query(deleteMutation, { id: label.id });
                console.log(chalk.green(`      ✅ Deleted.`));
            } catch (e: any) {
                console.error(chalk.red(`      ❌ Failed: ${e.message}`));
            }
        } else {
            console.log(chalk.gray(`   ℹ️ ${labelName} not found, skipping.`));
        }
    }

    // Create New Tags
    for (const labelInfo of toCreate) {
        const exists = existingLabels.find(l => l.name === labelInfo.name);
        if (!exists) {
            console.log(chalk.cyan(`   ✨ Creating ${labelInfo.name}...`));
            const createMutation = `
                mutation LabelCreate($input: IssueLabelCreateInput!) {
                    issueLabelCreate(input: $input) {
                        success
                        issueLabel {
                            id
                        }
                    }
                }
            `;
            try {
                // We need Team ID for labels usually, or they are Global. 
                // Let's try global first.
                await client.query(createMutation, { input: labelInfo });
                console.log(chalk.green(`      ✅ Created.`));
            } catch (e: any) {
                console.error(chalk.red(`      ❌ Failed: ${e.message}`));
                console.log(chalk.gray(`      (Global creation might require teamId. Checking project context...)`));
                // Fallback or retry with teamId if needed
            }
        } else {
            console.log(chalk.gray(`   ℹ️ ${labelInfo.name} already exists.`));
        }
    }

    console.log(chalk.bold.green(`\n✅ Refactor complete.`));
}

main().catch(console.error);
