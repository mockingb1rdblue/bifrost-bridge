/**
 * Finalize Seeded Issues Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';
const READY_STATE_ID = '740abc36-bd54-4a63-89bd-adcf506c3fbb';

// Label IDs obtained from list-labels
const LABEL_IDS = {
  'sluagh:autonomous': 'ecc3764e-5cdf-46eb-8777-968c98f2d62d',
  'sluagh:ready': '9087a6b2-ccba-4030-b590-e3607e933f2c',
  'complexity:simple': 'deee661b-7010-4501-a57b-615b12a77d78',
  'type:docs': 'fb3c46ac-9ffc-4ea4-818f-bc694a15776b',
  'type:test': 'a423592f-67ad-4602-a704-8084a3a15687',
  'type:feature': '60567481-803b-4750-bf29-7d1a91670d13',
  'component:crypt-core': 'bcc98616-1c07-43aa-a68e-3e1728c0946f',
  'component:annals': '3aeaa26f-e6c6-41ba-a112-8e8fd3521f83',
  'component:worker-bees': 'acd2d998-b63c-4694-a4c0-4628e5feed86'
};

async function listIssues() {
  const response = await fetch(`${ROUTER_URL}/admin/linear/list-issues?limit=50`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const data = await response.json();
  return data.issues;
}

async function updateIssue(id, input) {
  const response = await fetch(`${ROUTER_URL}/admin/linear/update-issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, input })
  });
  const data = await response.json();
  return data.success;
}

async function main() {
  console.log(`🔍 Fetching issues to finalize...`);
  const issues = await listIssues();
  
  // Specific titles for the 15 issues from SWARM_BATCH_ISSUES.md
  const batchTitles = [
    "Add JSDoc to EventStoreClient Methods",
    "Create ARCHITECTURE.md for Annals of Ankou",
    "Update Main README with Event Sourcing Section",
    "Add Comments to Linear Webhook Handler",
    "Document Worker Bees Polling Mechanism",
    "Write Unit Tests for EventStoreClient.append()",
    "Add Integration Test for /append Endpoint",
    "Create Test Fixtures for Event Replay",
    "Test Worker Bee Job Handler Registration",
    "Add Negative Test for Invalid Event Schema",
    "Add GET /events/count Endpoint",
    "Implement Date Range Filtering for /history",
    "Add Correlation ID Validation to Events",
    "Implement GET /events/topics Endpoint",
    "Add Event Type Filtering to /history"
  ];

  const issuesToFinalize = issues.filter(issue => batchTitles.includes(issue.title));
  console.log(`📋 Found ${issuesToFinalize.length} issues to finalize.`);

  for (const issue of issuesToFinalize) {
    process.stdout.write(`🛠️ Finalizing ${issue.identifier}: "${issue.title}"... `);
    
    // Determine labels based on title keywords
    const labelIds = [LABEL_IDS['sluagh:autonomous'], LABEL_IDS['sluagh:ready'], LABEL_IDS['complexity:simple']];
    
    if (issue.title.toLowerCase().includes('jsdoc') || issue.title.toLowerCase().includes('readme') || issue.title.toLowerCase().includes('architecture') || issue.title.toLowerCase().includes('comment') || issue.title.toLowerCase().includes('document')) {
      labelIds.push(LABEL_IDS['type:docs']);
    } else if (issue.title.toLowerCase().includes('test') || issue.title.toLowerCase().includes('fixture')) {
      labelIds.push(LABEL_IDS['type:test']);
    } else {
      labelIds.push(LABEL_IDS['type:feature']);
    }
    
    // Component labels
    if (issue.title.toLowerCase().includes('eventstoreclient') || issue.title.toLowerCase().includes('webhook') || issue.title.toLowerCase().includes('crypt-core')) {
      labelIds.push(LABEL_IDS['component:crypt-core']);
    } else if (issue.title.toLowerCase().includes('ankou') || issue.title.toLowerCase().includes('append') || issue.title.toLowerCase().includes('history') || issue.title.toLowerCase().includes('topics') || issue.title.toLowerCase().includes('count')) {
      labelIds.push(LABEL_IDS['component:annals']);
    } else if (issue.title.toLowerCase().includes('worker bee')) {
      labelIds.push(LABEL_IDS['component:worker-bees']);
    }

    const success = await updateIssue(issue.id, {
      labelIds: Array.from(new Set(labelIds)),
      stateId: READY_STATE_ID
    });
    
    console.log(success ? '✅ Success' : '❌ Failed');
  }
  
  console.log('\n✨ All issues finalized and moved to Sluagh Ready state.');
}

main().catch(console.error);
