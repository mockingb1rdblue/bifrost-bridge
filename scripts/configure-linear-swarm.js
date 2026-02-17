/**
 * Configure Linear workspace for swarm deployment
 * Creates required labels only (skips workflow states which have API type issues)
 * Run: node scripts/configure-linear-swarm.js
 */

const ROUTER_URL = process.env.ROUTER_URL || 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = process.env.API_KEY || 'test-key-default';

const requiredLabels = [
  { name: 'sluagh:autonomous', color: '#10B981' },
  { name: 'sluagh:supervised', color: '#F59E0B' },
  { name: 'sluagh:hitl', color: '#F97316' },
  { name: 'type:feature', color: '#3B82F6' },
  { name: 'type:bug', color: '#EF4444' },
  { name: 'type:docs', color: '#10B981' },
  { name: 'type:test', color: '#A855F7' },
  { name: 'type:refactor', color: '#6B7280' },
  { name: 'complexity:simple', color: '#10B981' },
  { name: 'complexity:moderate', color: '#F59E0B' },
  { name: 'complexity:complex', color: '#EF4444' },
  { name: 'component:crypt-core', color: '#8B5CF6' },
  { name: 'component:annals', color: '#EC4899' },
  { name: 'component:worker-bees', color: '#14B8A6' },
];

async function createLabel(label) {
  const response = await fetch(`${ROUTER_URL}/admin/linear/create-label`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(label),
  });

  const result = await response.json();
  return result;
}

async function main() {
  console.log(`🎨 Creating ${requiredLabels.length} labels in Linear...\n`);

  const results = {
    created: 0,
    existing: 0,
    failed: 0,
  };

  for (const label of requiredLabels) {
    try {
      const result = await createLabel(label);
      if (result.error) {
        const isDuplicate = result.error.includes('already exists') || result.error.includes('must be unique');
        if (isDuplicate) {
          console.log(`⏭️  ${label.name} (already exists)`);
          results.existing++;
        } else {
          console.log(`❌ ${label.name}: ${result.error}`);
          results.failed++;
        }
      } else {
        console.log(`✅ ${label.name}`);
        results.created++;
      }
    } catch (error) {
      console.log(`❌ ${label.name}: ${error.message}`);
      results.failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Created: ${results.created}`);
  console.log(`⏭️  Existing: ${results.existing}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`${'='.repeat(50)}`);
}

main().catch(console.error);
