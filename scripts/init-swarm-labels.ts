
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = process.env.LINEAR_TEAM_ID;

if (!LINEAR_API_KEY || !TEAM_ID) {
    console.error('LINEAR_API_KEY or LINEAR_TEAM_ID missing');
    process.exit(1);
}

async function query(q: string, variables?: any) {
    const response = await fetch('https://api.linear.app/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: LINEAR_API_KEY!,
        },
        body: JSON.stringify({ query: q, variables }),
    });
    
    const data: any = await response.json();
    if (data.errors) {
        console.error('Errors:', JSON.stringify(data.errors, null, 2));
        throw new Error('GraphQL Error');
    }
    return data.data;
}

async function ensureLabels() {
    const labelsToCreate = [
        { name: 'swarm:ready', color: '#3E7854' }, // Green
        { name: 'swarm:active', color: '#E2B93B' }, // Yellow
        { name: 'swarm:blocked', color: '#C93B3B' }, // Red
        { name: 'swarm:review', color: '#3B82F6' }, // Blue
    ];

    console.log('🔍 Checking for labels...');
    
    const currentLabelsQuery = `
        query Labels($teamId: String!) {
          issueLabels(filter: { team: { id: { eq: $teamId } } }) {
            nodes {
              id
              name
            }
          }
        }
    `;
    const labelData = await query(currentLabelsQuery, { teamId: TEAM_ID });
    const existingNames = labelData.issueLabels.nodes.map((l: any) => l.name);

    for (const label of labelsToCreate) {
        if (!existingNames.includes(label.name)) {
            console.log(`➕ Creating label: ${label.name}`);
            const createMutation = `
                mutation LabelCreate($input: IssueLabelCreateInput!) {
                    issueLabelCreate(input: $input) {
                        success
                        issueLabel { id }
                    }
                }
            `;
            await query(createMutation, {
                input: {
                    name: label.name,
                    color: label.color,
                    teamId: TEAM_ID
                }
            });
        } else {
            console.log(`✅ Label already exists: ${label.name}`);
        }
    }
}

ensureLabels().catch(console.error);
