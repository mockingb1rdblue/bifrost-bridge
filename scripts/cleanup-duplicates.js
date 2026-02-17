/**
 * Duplicates Cleanup Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';

const idsToDelete = [
  '23567655-c906-4a7e-820b-3327cf800737', // BIF-157
  'cb002403-3009-43c2-a340-472e67a2f059', // BIF-150
  '2f440306-d8d6-413c-b6be-bcb4f0385a6a', // BIF-149
  'a5b268e2-ce0d-4cf0-a7d9-2de4ba5bd54f', // BIF-148
  '81c640fd-45b1-45d1-a08f-df3bdfecc03e', // BIF-147
  'a1966f4c-b042-4bd6-9830-fe04b129148a'  // BIF-146
];

async function deleteIssue(id) {
  const response = await fetch(`${ROUTER_URL}/admin/linear/delete-issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });
  const data = await response.json();
  return data.success;
}

async function main() {
  console.log(`🗑️ Deleting ${idsToDelete.length} duplicate issues...`);
  for (const id of idsToDelete) {
    process.stdout.write(`Deleting ${id}... `);
    const success = await deleteIssue(id);
    console.log(success ? '✅ Success' : '❌ Failed');
  }
  console.log('\n✨ Cleanup complete.');
}

main().catch(console.error);
