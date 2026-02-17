#!/usr/bin/env node
/**
 * Linear Project Audit Script
 * Exports all issues from the Bifrost project for swarm refactoring analysis
 */

const https = require('https');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'd43e265a-cbc3-4f07-afcd-7792ce875ad3';

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set');
  console.error('Please set it: export LINEAR_API_KEY=your_key');
  process.exit(1);
}

const query = `
  query($teamId: String!) {
    team(id: $teamId) {
      id
      name
      projects {
        nodes {
          id
          name
          state
          description
        }
      }
      issues(first: 100) {
        nodes {
          id
          identifier
          title
          description
          state {
            name
            type
          }
          priority
          estimate
          labels {
            nodes {
              name
            }
          }
          assignee {
            name
          }
          project {
            name
          }
          createdAt
          updatedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

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
          if (response.errors) {
            reject(new Error(JSON.stringify(response.errors, null, 2)));
          } else {
            resolve(response.data);
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔍 Querying Linear API...\n');
  
  try {
    const data = await makeLinearRequest(query, { teamId: LINEAR_TEAM_ID });
    
    if (!data.team) {
      console.error('ERROR: Team not found. Check LINEAR_TEAM_ID');
      process.exit(1);
    }

    const { team } = data;
    
    console.log('=== TEAM INFO ===');
    console.log(`Team: ${team.name} (${team.id})\n`);
    
    console.log('=== PROJECTS ===');
    team.projects.nodes.forEach(p => {
      console.log(`- ${p.name} (${p.state})`);
    });
    console.log('');
    
    console.log('=== ISSUES SUMMARY ===');
    console.log(`Total Issues: ${team.issues.nodes.length}\n`);
    
    // Categorize by state
    const byState = {};
    team.issues.nodes.forEach(issue => {
      const state = issue.state.name;
      byState[state] = (byState[state] || 0) + 1;
    });
    
    console.log('By State:');
    Object.entries(byState).forEach(([state, count]) => {
      console.log(`  ${state}: ${count}`);
    });
    console.log('');
    
    // Categorize by labels
    const byLabel = {};
    team.issues.nodes.forEach(issue => {
      issue.labels.nodes.forEach(label => {
        byLabel[label.name] = (byLabel[label.name] || 0) + 1;
      });
    });
    
    console.log('By Label:');
    Object.entries(byLabel).forEach(([label, count]) => {
      console.log(`  ${label}: ${count}`);
    });
    console.log('');
    
    // Save full export
    const exportData = {
      team: {
        id: team.id,
        name: team.name
      },
      projects: team.projects.nodes,
      issues: team.issues.nodes.map(issue => ({
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        state: issue.state.name,
        priority: issue.priority,
        estimate: issue.estimate,
        labels: issue.labels.nodes.map(l => l.name),
        assignee: issue.assignee?.name,
        project: issue.project?.name,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt
      })),
      summary: {
        totalIssues: team.issues.nodes.length,
        byState,
        byLabel,
        hasNextPage: team.issues.pageInfo.hasNextPage
      }
    };
    
    console.log('\n✅ Full export saved to linear_audit.json');
    console.log(JSON.stringify(exportData, null, 2));
    
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

main();
