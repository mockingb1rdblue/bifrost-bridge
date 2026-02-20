/**
 * Bulk update Linear issue metadata for all Fly.io migration issues
 * Sets priorities, labels, milestones, and dependencies
 */

import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new LinearClient(process.env.LINEAR_API_KEY!, 'https://api.linear.app/graphql');
const TEAM_ID = process.env.LINEAR_TEAM_ID!;

// Metadata mapping for all 32 issues
const metadata = [
  // Infrastructure (P2 High)
  {
    id: 'BIF-70',
    priority: 2,
    labels: ['infrastructure', 'month-1'],
    milestone: null,
    blockedBy: [],
  },
  {
    id: 'BIF-71',
    priority: 2,
    labels: ['infrastructure', 'month-1'],
    milestone: null,
    blockedBy: ['BIF-70'],
  },
  {
    id: 'BIF-72',
    priority: 2,
    labels: ['infrastructure', 'month-1'],
    milestone: null,
    blockedBy: ['BIF-70'],
  },
  {
    id: 'BIF-73',
    priority: 2,
    labels: ['infrastructure', 'month-1'],
    milestone: null,
    blockedBy: ['BIF-70'],
  },

  // Sprites - MONTH 2 PRIORITY (P2 High)
  {
    id: 'BIF-74',
    priority: 2,
    labels: ['sprites', 'month-2', 'research'],
    milestone: 'Month 2',
    blockedBy: [],
  },
  {
    id: 'BIF-75',
    priority: 2,
    labels: ['sprites', 'month-2', 'design'],
    milestone: 'Month 2',
    blockedBy: ['BIF-74'],
  },
  {
    id: 'BIF-76',
    priority: 2,
    labels: ['sprites', 'month-2', 'implementation'],
    milestone: 'Month 2',
    blockedBy: ['BIF-84'],
  },
  {
    id: 'BIF-77',
    priority: 2,
    labels: ['sprites', 'month-2', 'implementation'],
    milestone: 'Month 2',
    blockedBy: ['BIF-76'],
  },
  {
    id: 'BIF-78',
    priority: 2,
    labels: ['sprites', 'month-2', 'implementation'],
    milestone: 'Month 2',
    blockedBy: ['BIF-77'],
  },
  {
    id: 'BIF-79',
    priority: 3,
    labels: ['sprites', 'month-2', 'optimization'],
    milestone: 'Month 2',
    blockedBy: ['BIF-77'],
  },
  {
    id: 'BIF-80',
    priority: 3,
    labels: ['sprites', 'month-2', 'optimization'],
    milestone: 'Month 2',
    blockedBy: ['BIF-77'],
  },
  {
    id: 'BIF-81',
    priority: 3,
    labels: ['sprites', 'month-2', 'testing'],
    milestone: 'Month 2',
    blockedBy: ['BIF-80'],
  },

  // Agent Runners (P2-P3)
  {
    id: 'BIF-82',
    priority: 2,
    labels: ['agent-runners', 'infrastructure'],
    milestone: null,
    blockedBy: [],
  },
  {
    id: 'BIF-83',
    priority: 2,
    labels: ['agent-runners', 'infrastructure'],
    milestone: null,
    blockedBy: ['BIF-82'],
  },
  {
    id: 'BIF-84',
    priority: 3,
    labels: ['agent-runners', 'integration'],
    milestone: null,
    blockedBy: [],
  },
  {
    id: 'BIF-85',
    priority: 3,
    labels: ['agent-runners', 'integration'],
    milestone: null,
    blockedBy: ['BIF-84'],
  },

  // Event Store (P2)
  {
    id: 'BIF-86',
    priority: 2,
    labels: ['event-store', 'infrastructure'],
    milestone: null,
    blockedBy: ['BIF-72'],
  },
  {
    id: 'BIF-87',
    priority: 2,
    labels: ['event-store', 'database'],
    milestone: null,
    blockedBy: [],
  },
  {
    id: 'BIF-88',
    priority: 2,
    labels: ['event-store', 'api'],
    milestone: null,
    blockedBy: ['BIF-87'],
  },
  {
    id: 'BIF-89',
    priority: 2,
    labels: ['event-store', 'security'],
    milestone: null,
    blockedBy: ['BIF-72'],
  },
  {
    id: 'BIF-90',
    priority: 2,
    labels: ['event-store', 'deployment'],
    milestone: null,
    blockedBy: ['BIF-86', 'BIF-88', 'BIF-89'],
  },

  // Security (P2)
  {
    id: 'BIF-91',
    priority: 2,
    labels: ['security', 'authentication'],
    milestone: null,
    blockedBy: ['BIF-88'],
  },
  { id: 'BIF-92', priority: 2, labels: ['security', 'secrets'], milestone: null, blockedBy: [] },
  {
    id: 'BIF-93',
    priority: 2,
    labels: ['security', 'networking'],
    milestone: null,
    blockedBy: ['BIF-89', 'BIF-73'],
  },
  { id: 'BIF-94', priority: 2, labels: ['security', 'hardening'], milestone: null, blockedBy: [] },

  // Testing (P3)
  { id: 'BIF-95', priority: 3, labels: ['testing', 'e2e'], milestone: null, blockedBy: ['BIF-85'] },
  {
    id: 'BIF-96',
    priority: 3,
    labels: ['testing', 'load-test'],
    milestone: null,
    blockedBy: ['BIF-90'],
  },
  { id: 'BIF-97', priority: 3, labels: ['testing', 'monitoring'], milestone: null, blockedBy: [] },

  // Autoscaling - MONTH 3 (P3)
  {
    id: 'BIF-98',
    priority: 3,
    labels: ['autoscaling', 'month-3'],
    milestone: 'Month 3',
    blockedBy: [],
  },
  {
    id: 'BIF-99',
    priority: 3,
    labels: ['autoscaling', 'month-3'],
    milestone: 'Month 3',
    blockedBy: ['BIF-98'],
  },
  {
    id: 'BIF-100',
    priority: 3,
    labels: ['autoscaling', 'month-3', 'cost-optimization'],
    milestone: 'Month 3',
    blockedBy: ['BIF-99'],
  },

  // Security Hardening (P1 URGENT!)
  {
    id: 'BIF-101',
    priority: 1,
    labels: ['security', 'urgent', 'dx-improvement'],
    milestone: null,
    blockedBy: [],
  },
];

async function updateMetadata() {
  console.log('🔧 Bulk updating Linear issue metadata for 32 issues\n');

  let updated = 0;
  let failed = 0;

  for (const item of metadata) {
    try {
      console.log(`Updating ${item.id}...`);

      // Note: This is pseudocode - actual Linear GraphQL mutations would be needed
      // The Linear SDK may not expose all these fields directly
      // You may need to use raw GraphQL queries

      // For now, just log what would be updated
      console.log(
        `  Priority: ${item.priority} (${['None', 'Urgent', 'High', 'Medium', 'Low'][item.priority]})`,
      );
      console.log(`  Labels: ${item.labels.join(', ')}`);
      console.log(`  Milestone: ${item.milestone || 'None'}`);
      console.log(`  Blocked by: ${item.blockedBy.join(', ') || 'None'}`);

      updated++;
    } catch (error) {
      console.error(`✗ Failed to update ${item.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Updated: ${updated}/32`);
  console.log(`❌ Failed: ${failed}/32`);
  console.log('\n⚠️  NOTE: This is a template script.');
  console.log('Linear API updates require:');
  console.log('1. Creating labels in Linear UI first (month-1, month-2, sprites, etc.)');
  console.log('2. Creating milestones (Month 2, Month 3)');
  console.log('3. Using Linear GraphQL mutations (not exposed in current LinearClient)');
  console.log(
    '\nRecommend: Manual updates via Linear UI or enhance LinearClient with update methods.',
  );
}

updateMetadata().catch(console.error);
