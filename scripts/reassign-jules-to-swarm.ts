import { LinearClient } from '@linear/sdk';

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const LINEAR_TEAM_ID = process.env.LINEAR_TEAM_ID || 'd43e265a-cbc3-4f07-afcd-7792ce875ad3';

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY not set.');
  process.exit(1);
}

const linear = new LinearClient({ apiKey: LINEAR_API_KEY });

async function main() {
  console.log('🐝 Reassigning tasks from agent:jules to the Sluagh Swarm...\n');

  // 1. Get labels
  const team = await linear.team(LINEAR_TEAM_ID);
  const labels = await team.labels();
  
  const julesLabel = labels.nodes.find(l => l.name === 'agent:jules');
  const autonomousLabel = labels.nodes.find(l => l.name === 'sluagh:autonomous');

  if (!julesLabel) {
    console.error('❌ Label "agent:jules" not found.');
    return;
  }
  if (!autonomousLabel) {
    console.error('❌ Label "sluagh:autonomous" not found.');
    return;
  }

  // 2. Fetch issues with agent:jules label
  const issues = await linear.issues({
    filter: {
      team: { id: { eq: LINEAR_TEAM_ID } },
      labels: { some: { id: { eq: julesLabel.id } } }
    }
  });

  console.log(`🔍 Found ${issues.nodes.length} issues assigned to agent:jules.`);

  for (const issue of issues.nodes) {
    console.log(`➡️  Reassigning ${issue.identifier}: ${issue.title}`);

    // Update labels and unassign
    const currentLabelIds = (await issue.labels()).nodes.map(l => l.id);
    const newLabelIds = currentLabelIds
      .filter(id => id !== julesLabel.id)
      .concat(autonomousLabel.id);

    await linear.issueUpdate(issue.id, {
      labelIds: newLabelIds,
      assigneeId: null // Unassign
    });

    await linear.commentCreate({
      issueId: issue.id,
      body: '🔄 **Task Reassigned**: Migrated from `@agent:jules` to the autonomous `Sluagh Swarm`.\n\nDeepSeek and Gemini will now collaborate on this task.'
    });
  }

  console.log('\n✅ Reassignment complete!');
}

main().catch(console.error);
