
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

    const finalBaseUrl = useDirect ? 'https://api.linear.app/graphql' : baseUrl;
    const client = new LinearClient(apiKey, finalBaseUrl);

    const issuesToInspect = process.argv.slice(2).filter(arg => !arg.startsWith('--'));

    if (issuesToInspect.length === 0) {
        console.log(chalk.yellow('⚠️ No issue identifiers provided. Usage: npx ts-node scripts/inspect_issue_details.ts BIF-104 BIF-105 [--direct]'));
        process.exit(0);
    }

    console.log(chalk.bold(`🔍 Inspecting Issue Details:\n`));

    for (const identifier of issuesToInspect) {
        const query = `
            query($id: String!) {
                issue(id: $id) {
                    id
                    identifier
                    title
                    description
                    priority
                    state {
                        name
                        type
                    }
                    project {
                        name
                    }
                    labels {
                        nodes {
                            name
                        }
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

            console.log(chalk.cyan.bold(`📋 ${issue.identifier}: ${issue.title}`));
            console.log(chalk.gray(`Project: ${issue.project?.name || 'None'}`));
            console.log(chalk.gray(`Status: ${issue.state.name} (${issue.state.type})`));
            console.log(chalk.gray(`Labels: ${issue.labels.nodes.map((l: any) => l.name).join(', ') || 'None'}`));
            console.log(chalk.white(`\nDescription:`));
            console.log(chalk.italic(issue.description || 'No description provided.'));
            console.log(chalk.blue(`--------------------------------------------------\n`));

        } catch (e: any) {
            console.error(chalk.red(`❌ Error processing ${identifier}:`, e.message));
        }
    }
}

main().catch(console.error);
