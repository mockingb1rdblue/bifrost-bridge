/**
 * Create Sluagh Ready State Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';

async function createState() {
  const response = await fetch(`${ROUTER_URL}/admin/linear/configure-swarm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json();
  return data;
}

async function main() {
  console.log(`🏗️ Creating 'Sluagh Ready' state via configure-swarm...`);
  const result = await createState();
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
