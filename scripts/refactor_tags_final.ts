
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

    console.log(chalk.bold(`🚀 Finalizing Linear Tag Refactor...\n`));

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
        'backend',
        'Feature',
        'Improvement',
        'Bug',
        'Target: Feb Sprint 1',
        'Epic',
        'technical-debt',
        'docs',
        'testing'
    ];

    // Delete Duplicate/Useless Tags
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

    console.log(chalk.bold.green(`\n✅ Final refactor complete.`));
}

main().catch(console.error);
