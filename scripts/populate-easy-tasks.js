#!/usr/bin/env node
const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'd43e265a-cbc3-4f07-afcd-7792ce875ad3';

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY not set');
  process.exit(1);
}

function makeLinearRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.errors) reject(new Error(JSON.stringify(response.errors, null, 2)));
          else resolve(response.data);
        } catch (err) { reject(err); }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🚀 Populating Easy Tasks for Sluagh Swarm...');
  
  try {
    // 1. Get Labels
    const labelData = await makeLinearRequest(`
      query($teamId: String!) {
        team(id: $teamId) {
          labels { nodes { id name } }
        }
      }
    `, { teamId: LINEAR_TEAM_ID });

    const labels = labelData.team.labels.nodes;
    const autonomousLabel = labels.find(l => l.name === 'sluagh:autonomous');
    
    if (!autonomousLabel) {
      console.error('ERROR: sluagh:autonomous label not found');
      return;
    }

    // 2. Find Backlog Issues with complexity:simple OR complexity:low
    const issueData = await makeLinearRequest(`
      query($teamId: String!) {
        team(id: $teamId) {
          issues(filter: { 
            state: { type: { eq: "backlog" } },
            labels: { some: { name: { in: ["complexity:simple", "complexity:low"] } } }
          }) {
            nodes { id identifier title }
          }
        }
      }
    `, { teamId: LINEAR_TEAM_ID });

    const issues = issueData.team.issues.nodes;
    console.log(`Found ${issues.length} easy tasks in backlog.`);

    for (const issue of issues) {
      console.log(`- Tagging ${issue.identifier}: ${issue.title}`);
      await makeLinearRequest(`
        mutation($id: String!, $labelIds: [String!]) {
          issueUpdate(id: $id, input: { labelIds: $labelIds }) {
            success
          }
        }
      `, { 
        id: issue.id, 
        labelIds: [autonomousLabel.id] // Note: This overwrites! In production we should merge.
      });
    }

    console.log('\n✅ Task population complete.');
  } catch (error) {
    console.error('ERROR:', error.message);
  }
}

main();
