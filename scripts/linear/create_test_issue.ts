import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const client = new LinearClient(process.env.LINEAR_API_KEY!, 'https://api.linear.app/graphql');
const teamId = process.env.LINEAR_TEAM_ID!;
const projectId = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d'; // Bifrost v3

async function createTestIssue() {
  const title = 'BIF-TEST: Define VERSION in worker-bees config';
  const description = `**Priority**: P3 | **Estimate**: 15 min

## Objective
Validate the Sluagh Swarm's autonomous execution capability.

## Task
Add a \`VERSION\` constant to \`workers/worker-bees/src/config/index.ts\`.

\`\`\`typescript
export const VERSION = '1.0.0';
\`\`\`

## Acceptance Criteria
- [ ] \`VERSION\` constant exists in the config file.
- [ ] Code passes linting.
- [ ] A Pull Request is created against \`hee-haw\`.
`;

  const result = await client.createIssue({
    teamId,
    title,
    description,
    projectId,
  });

  console.log(`✅ Created test issue: ${result.identifier}`);
  return result.identifier;
}

createTestIssue().catch(console.error);
