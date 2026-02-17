const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'd43e265a-cbc3-4f07-afcd-7792ce875ad3';

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY not set.');
  process.exit(1);
}

function makeLinearRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          console.error(`HTTP Error: ${res.statusCode}`);
          console.error('Body:', body);
        }
        try {
          const response = JSON.parse(body);
          if (response.errors) reject(new Error(JSON.stringify(response.errors, null, 2)));
          else resolve(response.data);
        } catch (err) { 
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 200)}`));
          } else {
            console.error('Failed to parse JSON body:', body.substring(0, 200));
            reject(err);
          }
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🐝 Reassigning tasks from agent:jules to the Sluagh Swarm (JS Edition)...\n');

  // 1. Get labels
  const labelQuery = `
    query($teamId: String!) {
      team(id: $teamId) {
        labels {
          nodes { id name }
        }
      }
    }
  `;
  const labelData = await makeLinearRequest(labelQuery, { teamId: LINEAR_TEAM_ID });
  const labels = labelData.team.labels.nodes;
  
  const julesLabel = labels.find(l => l.name === 'agent:jules');
  const autonomousLabel = labels.find(l => l.name === 'sluagh:autonomous');

  if (!julesLabel) {
    console.error('❌ Label "agent:jules" not found.');
    return;
  }
  if (!autonomousLabel) {
    console.error('❌ Label "sluagh:autonomous" not found.');
    return;
  }

  // 2. Fetch issues with agent:jules label
  const issueQuery = `
    query($labelId: ID!) {
      issues(filter: { labels: { some: { id: { eq: $labelId } } } }) {
        nodes {
          id identifier title labels { nodes { id } }
        }
      }
    }
  `;
  const issueData = await makeLinearRequest(issueQuery, { labelId: julesLabel.id });
  const issues = issueData.issues.nodes;

  console.log(`🔍 Found ${issues.length} issues assigned to agent:jules.`);

  for (const issue of issues) {
    console.log(`➡️  Reassigning ${issue.identifier}: ${issue.title}`);

    // Update labels and unassign
    const currentLabelIds = issue.labels.nodes.map(l => l.id);
    const newLabelIds = currentLabelIds
      .filter(id => id !== julesLabel.id);
    
    if (!newLabelIds.includes(autonomousLabel.id)) {
      newLabelIds.push(autonomousLabel.id);
    }

    const updateMutation = `
      mutation($id: String!, $labelIds: [String!]) {
        issueUpdate(id: $id, input: { labelIds: $labelIds, assigneeId: null }) {
          success
        }
      }
    `;
    await makeLinearRequest(updateMutation, { id: issue.id, labelIds: newLabelIds });

    const commentMutation = `
      mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }
    `;
    await makeLinearRequest(commentMutation, { 
      issueId: issue.id, 
      body: '🔄 **Task Reassigned**: Migrated from `@agent:jules` to the autonomous `Sluagh Swarm`.\n\nDeepSeek and Gemini will now collaborate on this task.'
    });
  }

  console.log('\n✅ Reassignment complete!');
}

main().catch(console.error);
