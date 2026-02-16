
import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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
        console.error('❌ API Key is missing in .env');
        process.exit(1);
    }

    const finalBaseUrl = useDirect ? 'https://api.linear.app/graphql' : baseUrl;
    const client = new LinearClient(apiKey, finalBaseUrl);

    const query = `
        query {
            issueLabels {
                nodes {
                    id
                    name
                    description
                    color
                }
            }
        }
    `;

    try {
        const data = await client.query<{ issueLabels: { nodes: any[] } }>(query);
        const labels = data.issueLabels.nodes;
        console.log(JSON.stringify(labels, null, 2));
    } catch (e: any) {
        console.error('❌ Error fetching labels:', e.message);
    }
}

main().catch(console.error);
