import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new LinearClient(process.env.LINEAR_API_KEY!, 'https://api.linear.app/graphql');

async function inspectIssues() {
  // Fetch a few sample issues to check their metadata
  const sampleIds = ['BIF-70', 'BIF-74', 'BIF-101']; // Infrastructure, Sprites, Security

  console.log('🔍 Inspecting Linear Issues for Metadata Completeness\n');

  for (const id of sampleIds) {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          identifier
          title
          priority
          state { name }
          assignee { name }
          projectMilestone { name }
          labels { nodes { name } }
          relations { nodes { id } }
          comments { nodes { id } }
        }
      }
    `;
    const data = await client.query<{ issue: any }>(query, { id });
    const issue = data.issue;

    if (!issue) {
      console.log(`\n❌ Issue ${id} not found.`);
      continue;
    }

    console.log(`\n📋 ${issue.identifier}: ${issue.title}`);
    console.log(`   Status: ${issue.state?.name || 'N/A'}`);
    console.log(`   Priority: ${issue.priority || 'N/A'} (0=None, 1=Urgent, 2=High, 3=Med, 4=Low)`);
    console.log(`   Labels: ${issue.labels?.nodes?.map((l: any) => l.name).join(', ') || 'None'}`);
    console.log(`   Assignee: ${issue.assignee?.name || 'Unassigned'}`);
    console.log(`   Project Milestone: ${issue.projectMilestone?.name || 'None'}`);
    console.log(`   Relations: ${issue.relations?.nodes?.length || 0} linked issues`);
    console.log(`   Comments: ${issue.comments?.nodes?.length || 0}`);
  }

  console.log('\n\n📊 Summary:');
  console.log('Created issues have basic descriptions but likely missing:');
  console.log('  - Priority levels (set in Linear UI)');
  console.log('  - Status (default to Backlog/Todo)');
  console.log('  - Dependencies (relations between issues)');
  console.log('  - Milestones (Month 2, Month 3 grouping)');
  console.log('  - Labels (P1/P2/P3 tags)');
}

inspectIssues().catch(console.error);
