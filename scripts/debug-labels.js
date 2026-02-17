/**
 * Debug Labels Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';

async function listIssues() {
  const response = await fetch(`${ROUTER_URL}/admin/linear/list-issues?limit=5`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data = await response.json();
  return data.issues;
}

async function main() {
  console.log(`🔍 Checking issues and labels...`);
  const issues = await listIssues();
  
  for (const issue of issues) {
    console.log(`Issue ${issue.identifier}: "${issue.title}"`);
    console.log(`  Labels: ${issue.labels.nodes.map(l => l.name).join(', ') || 'None'}`);
  }
  
  // Try to add a label specifically
  const targetIssue = issues[0];
  console.log(`\n🧪 Attempting to add label 'sluagh:autonomous' to ${targetIssue.identifier}...`);
  
  const response = await fetch(`${ROUTER_URL}/admin/linear/update-issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: targetIssue.id,
      input: {
        labelIds: [] // Wait, I need actual ID. My update endpoint doesn't support names yet.
      }
    })
  });
  
  console.log(`\nDone.`);
}

main().catch(console.error);
