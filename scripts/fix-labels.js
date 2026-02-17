/**
 * Fix Labels Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';

const labelIdsToAdd = [
  'ecc3764e-5cdf-46eb-8777-968c98f2d62d', // sluagh:autonomous
  '60567481-803b-4750-bf29-7d1a91670d13', // type:feature
  'deee661b-7010-4501-a57b-615b12a77d78', // complexity:simple
  '9087a6b2-ccba-4030-b590-e3607e933f2c'  // sluagh:ready
];

async function updateIssue(id, labelIds) {
  const response = await fetch(`${ROUTER_URL}/admin/linear/update-issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id,
      input: { labelIds }
    })
  });
  const data = await response.json();
  return data;
}

async function main() {
  // Get BIF-167
  const response = await fetch(`${ROUTER_URL}/admin/linear/list-issues?limit=1`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  const { issues } = await response.json();
  const issue = issues[0];
  
  console.log(`🧪 Updating ${issue.identifier} (${issue.id}) with labels...`);
  const result = await updateIssue(issue.id, labelIdsToAdd);
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
