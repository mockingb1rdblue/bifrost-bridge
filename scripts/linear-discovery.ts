
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = process.env.LINEAR_TEAM_ID;

if (!LINEAR_API_KEY) {
    console.error('LINEAR_API_KEY missing');
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

async function runDiscovery() {
    console.log('🚀 Starting Swarm Discovery...\n');

    // 1. List Projects & Milestones
    const projectQuery = `
        query {
            projects {
                nodes {
                    id
                    name
                    description
                    progress
                    milestones {
                        nodes {
                            id
                            name
                            description
                            targetDate
                        }
                    }
                }
            }
        }
    `;
    const projectsData = await query(projectQuery);
    console.log('--- Projects & Milestones ---');
    projectsData.projects.nodes.forEach((p: any) => {
        console.log(`\n📂 Project: ${p.name} (${p.id})`);
        console.log(`   Progress: ${Math.round(p.progress * 100)}%`);
        p.milestones.nodes.forEach((m: any) => {
            console.log(`   🏁 Milestone: ${m.name} (${m.id})`);
        });
    });

    // 2. List Labels
    const labelQuery = `
        query {
            labels {
                nodes {
                    id
                    name
                    color
                }
            }
        }
    `;
    const labelData = await query(labelQuery);
    console.log('\n--- Labels ---');
    labelData.labels.nodes.forEach((l: any) => {
        console.log(`🏷️  ${l.name} (${l.id})`);
    });

    // 3. List High Level Issues for Bifrost
    const issuesQuery = `
        query {
            issues(filter: { team: { id: { eq: "${TEAM_ID}" } } }) {
                nodes {
                    id
                    identifier
                    title
                    state { name }
                    labels { nodes { name } }
                }
            }
        }
    `;
    const issuesData = await query(issuesQuery);
    console.log('\n--- Recent Issues ---');
    issuesData.issues.nodes.slice(0, 10).forEach((i: any) => {
        const labels = i.labels.nodes.map((l: any) => l.name).join(', ');
        console.log(`🎫 [${i.identifier}] ${i.title} | State: ${i.state.name} | Labels: [${labels}]`);
    });
}

runDiscovery().catch(console.error);
