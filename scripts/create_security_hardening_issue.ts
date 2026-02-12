import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new LinearClient(process.env.LINEAR_API_KEY!, 'https://api.linear.app/graphql');
const teamId = process.env.LINEAR_TEAM_ID!;
const projectId = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d';

async function createHardeningIssue() {
  const title = '[SEC-001] Harden Linear Authentication - Prevent Key/Secret Confusion';
  const description = `**Priority**: P0 (URGENT) | **Estimate**: 60 min

## Problem
During bulk issue creation, the script conflated authentication keys:
- Used \`PROXY_API_KEY\` (webhook secret \`lin_wh_*\`) as API auth key
- Should have used \`LINEAR_API_KEY\` (\`lin_api_*\`) for API calls
- Circuit breaker activated due to 401 errors from wrong key type

## Solution: Runtime Key Validation

**File**: \`src/linear-client.ts\`

**Implementation**:
1. Add key type detection in constructor:
\`\`\`typescript
if (apiKey.startsWith('lin_wh_')) {
  throw new LinearAuthenticationError(
    'Webhook secret detected! Use LINEAR_API_KEY (lin_api_*), not LINEAR_WEBHOOK_SECRET (lin_wh_*)'
  );
}
if (!apiKey.startsWith('lin_api_')) {
  logger.warn('API key does not match expected pattern (lin_api_*)');
}
\`\`\`

2. Add .env validation script:
\`\`\`bash
# scripts/validate_env.ts
- Check LINEAR_API_KEY starts with 'lin_api_'
- Check LINEAR_WEBHOOK_SECRET starts with 'lin_wh_'  
- Check PROXY_API_KEY doesn't start with 'lin_wh_'
\`\`\`

3. Update CLI helper (src/cli.ts getLinearClient):
\`\`\`typescript
// Clear comment explaining key usage:
// LINEAR_API_KEY: For API calls to Linear
// LINEAR_WEBHOOK_SECRET: For verifying incoming webhooks  
// PROXY_API_KEY: For authenticating to linear-proxy (if using proxy)
\`\`\`

## Acceptance Criteria
- [ ] Constructor throws error if webhook secret passed as API key
- [ ] New \`scripts/validate_env.ts\` validates all Linear keys
- [ ] Run validation in \`npm start\` hook (pre-flight check)
- [ ] Clear inline comments in cli.ts explaining each key's purpose
- [ ] Update README with key usage table

## Dependencies
None - standalone security hardening

## Testing
- Try passing webhook secret → should fail fast with clear error
- Run validate_env.ts → should pass with current .env
- Manually swap keys → should catch and report misconfigurations`;

  const result = await client.createIssue({
    teamId,
    title,
    description,
    projectId
  });

  console.log(`✅ Created security hardening issue: ${result.identifier}`);
  console.log(`   Title: ${title}`);
  console.log(`   URL: https://linear.app/issue/${result.identifier}`);
}

createHardeningIssue().catch(console.error);
